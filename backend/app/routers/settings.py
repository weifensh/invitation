from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from .. import models, schemas, database, auth

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("sub")
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/", response_model=schemas.ChatSettingOut)
def get_settings(db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    settings = db.query(models.ChatSetting).filter(models.ChatSetting.user_id == user.id).first()
    if not settings:
        # 默认配置
        settings = models.ChatSetting(user_id=user.id, temperature=0.7, max_tokens=2048, stream=True)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/", response_model=schemas.ChatSettingOut)
def update_settings(update: schemas.ChatSettingUpdate, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    settings = db.query(models.ChatSetting).filter(models.ChatSetting.user_id == user.id).first()
    if not settings:
        settings = models.ChatSetting(user_id=user.id, **update.dict())
        db.add(settings)
    else:
        for k, v in update.dict().items():
            setattr(settings, k, v)
    db.commit()
    db.refresh(settings)
    return settings
