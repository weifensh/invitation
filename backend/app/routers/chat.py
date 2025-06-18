from fastapi import APIRouter, Depends, HTTPException, Query, Header, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from .. import models, schemas, database, auth
from typing import List, Optional
from datetime import datetime
import requests
from fastapi.responses import StreamingResponse
import json
from ..database import SessionLocal

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_token_from_header_or_query(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(database.get_db)
):
    # Try to get token from header first
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif not token:
        raise HTTPException(status_code=401, detail="Token not provided")
    
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    username = payload.get("sub")
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/histories", response_model=List[schemas.ChatHistoryOut])
def list_histories(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_token_from_header_or_query)
):
    histories = db.query(models.ChatHistory).filter(models.ChatHistory.user_id == user.id).order_by(models.ChatHistory.updated_at.desc()).all()
    # 防御性修复：自动补齐 updated_at 为 None 的数据
    for h in histories:
        if h.updated_at is None:
            h.updated_at = h.created_at
            db.commit()
    return histories

@router.post("/histories", response_model=schemas.ChatHistoryOut)
def create_history(
    history: schemas.ChatHistoryCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_token_from_header_or_query)
):
    now = datetime.utcnow()
    db_history = models.ChatHistory(**history.dict(), user_id=user.id, created_at=now, updated_at=now)
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history

@router.put("/histories/{history_id}", response_model=schemas.ChatHistoryOut)
def update_history(
    history_id: int,
    history: schemas.ChatHistoryCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_token_from_header_or_query)
):
    db_history = db.query(models.ChatHistory).filter(models.ChatHistory.id == history_id, models.ChatHistory.user_id == user.id).first()
    if not db_history:
        raise HTTPException(status_code=404, detail="History not found")
    db_history.title = history.title
    db.commit()
    db.refresh(db_history)
    return db_history

@router.delete("/histories/{history_id}")
def delete_history(
    history_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_token_from_header_or_query)
):
    db_history = db.query(models.ChatHistory).filter(models.ChatHistory.id == history_id, models.ChatHistory.user_id == user.id).first()
    if not db_history:
        raise HTTPException(status_code=404, detail="History not found")
    db.delete(db_history)
    db.commit()
    return {"ok": True}

@router.get("/histories/{history_id}/messages")
def list_messages(
    history_id: int,
    stream: bool = Query(False),
    sender: str = Query(None),
    content: str = Query(None),
    model_id: int = Query(None),
    provider_id: int = Query(None),
    temperature: float = Query(0.7),
    max_tokens: int = Query(2048),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_token_from_header_or_query),
    background_tasks: BackgroundTasks = None
):
    db_history = db.query(models.ChatHistory).filter(models.ChatHistory.id == history_id, models.ChatHistory.user_id == user.id).first()
    if not db_history:
        raise HTTPException(status_code=404, detail="History not found")

    if not stream:
        return db.query(models.ChatMessage).filter(models.ChatMessage.history_id == history_id).order_by(models.ChatMessage.created_at).all()

    provider_obj = db.query(models.ModelProvider).filter(models.ModelProvider.id == provider_id).first()
    model_obj = db.query(models.Model).filter(models.Model.id == model_id).first()
    if not provider_obj or not model_obj:
        raise HTTPException(status_code=400, detail="模型或供应商不存在")

    provider = {
        "api_host": provider_obj.api_host,
        "api_key": provider_obj.api_key
    }
    model = {
        "name": model_obj.name
    }

    db_message = models.ChatMessage(sender=sender, content=content, history_id=history_id)
    db.add(db_message)
    db_history.updated_at = db_message.created_at
    db.commit()
    db.refresh(db_message)

    ai_reply_holder = {"reply": ""}

    def event_stream():
        ai_reply = ""
        try:
            api_host = provider["api_host"].rstrip("/")
            url = f"{api_host}/v1/chat/completions"
            headers = {"Authorization": f"Bearer {provider['api_key']}"}
            data = {
                "model": model["name"],
                "messages": [{"role": "user", "content": content}],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }
            print(f"[SSE] 请求LLM: {url}, data={data}")
            with requests.post(url, headers=headers, json=data, stream=True, timeout=120) as resp:
                for line in resp.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data:'):
                            line = line[len('data:'):].lstrip()
                        if line == '[DONE]':
                            break
                        try:
                            payload = json.loads(line)
                            delta = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            ai_reply += delta
                            print(f"[SSE] 累计AI delta: {delta}")
                        except Exception as e:
                            print(f"[SSE] delta解析异常: {e}, line={line}")
                        # 关键：始终加data:前缀
                        yield f"data: {line}\n\n"
        except Exception as e:
            print("[SSE] error:", e)
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        print(f"[SSE] yield: [DONE], ai_reply=<{ai_reply}>")
        yield "data: [DONE]\n\n"
        # --- 关键：流式结束后同步保存AI回复 ---
        if ai_reply.strip():
            print(f"[SSE] 保存AI消息到DB: {ai_reply}")
            db_ai = SessionLocal()
            try:
                db_history2 = db_ai.query(models.ChatHistory).filter(models.ChatHistory.id == history_id).first()
                db_reply = models.ChatMessage(sender="ai", content=ai_reply, history_id=history_id)
                db_ai.add(db_reply)
                db_history2.updated_at = db_reply.created_at
                db_ai.commit()
                db_ai.refresh(db_reply)
            finally:
                db_ai.close()
        else:
            print("[SSE] AI回复内容为空，不保存")

    if background_tasks is not None:
        background_tasks.add_task(event_stream)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/histories/{history_id}/messages", response_model=schemas.ChatMessageOut)
def create_message(
    history_id: int,
    message: schemas.ChatMessageCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_token_from_header_or_query)
):
    db_history = db.query(models.ChatHistory).filter(
        models.ChatHistory.id == history_id,
        models.ChatHistory.user_id == user.id
    ).first()
    if not db_history:
        raise HTTPException(status_code=404, detail="History not found")

    provider = db.query(models.ModelProvider).filter(models.ModelProvider.id == message.provider_id).first()
    model = db.query(models.Model).filter(models.Model.id == message.model_id).first()
    if not provider or not model:
        raise HTTPException(status_code=400, detail="模型或供应商不存在")

    temperature = getattr(message, 'temperature', 0.7)
    max_tokens = getattr(message, 'max_tokens', 2048)
    stream = getattr(message, 'stream', False)

    # 1. 存储用户消息
    db_message = models.ChatMessage(sender=message.sender, content=message.content, history_id=history_id)
    db.add(db_message)
    db_history.updated_at = db_message.created_at
    db.commit()
    db.refresh(db_message)

    if stream:
        def event_stream():
            try:
                api_host = provider.api_host.rstrip("/")
                url = f"{api_host}/v1/chat/completions"
                headers = {"Authorization": f"Bearer {provider.api_key}"}
                data = {
                    "model": model.name,
                    "messages": [{"role": "user", "content": message.content}],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                }
                with requests.post(url, headers=headers, json=data, stream=True, timeout=120) as resp:
                    for line in resp.iter_lines():
                        if line and line.startswith(b"data: "):
                            yield line.decode() + "\n"
            except Exception as e:
                yield f"data: {{\"error\": \"{str(e)}\"}}\n"
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    else:
        # 2. 调用 OpenAI 兼容 LLM
        try:
            api_host = provider.api_host.rstrip("/")
            url = f"{api_host}/v1/chat/completions"
            headers = {"Authorization": f"Bearer {provider.api_key}"}
            data = {
                "model": model.name,
                "messages": [{"role": "user", "content": message.content}],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False,
            }
            resp = requests.post(url, headers=headers, json=data, timeout=60)
            resp.raise_for_status()
            reply = resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            reply = f"LLM调用失败: {e}"

        # 3. 存储 LLM 回复
        db_reply = models.ChatMessage(sender="ai", content=reply, history_id=history_id)
        db.add(db_reply)
        db_history.updated_at = db_reply.created_at
        db.commit()
        db.refresh(db_reply)
        return db_reply
