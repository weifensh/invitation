from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from .. import models, schemas, database, auth
from typing import List, Optional
from datetime import datetime
import requests
from fastapi.responses import StreamingResponse
import json

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
    user: models.User = Depends(get_token_from_header_or_query)
):
    db_history = db.query(models.ChatHistory).filter(models.ChatHistory.id == history_id, models.ChatHistory.user_id == user.id).first()
    if not db_history:
        raise HTTPException(status_code=404, detail="History not found")

    if not stream:
        return db.query(models.ChatMessage).filter(models.ChatMessage.history_id == history_id).order_by(models.ChatMessage.created_at).all()

    # 只提取用到的字段，避免ORM对象失效
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

    # 1. 存储用户消息
    db_message = models.ChatMessage(sender=sender, content=content, history_id=history_id)
    db.add(db_message)
    db_history.updated_at = db_message.created_at
    db.commit()
    db.refresh(db_message)

    def event_stream():
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
                        print("[SSE] yield:", line)
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            line = line[6:]
                        # 只推送纯JSON字符串
                        yield f"{line}\n\n" if line.strip() else ""
        except Exception as e:
            print("[SSE] error:", e)
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        print("[SSE] yield: [DONE]")
        yield "data: [DONE]\n\n"

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
