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

@router.get("/", response_model=list[schemas.ModelProviderOut])
def list_providers(db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.ModelProvider).filter(models.ModelProvider.user_id == user.id).all()

@router.post("/", response_model=schemas.ModelProviderOut)
def create_provider(provider: schemas.ModelProviderCreate, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    db_provider = models.ModelProvider(**provider.dict(), user_id=user.id)
    db.add(db_provider)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.put("/{provider_id}", response_model=schemas.ModelProviderOut)
def update_provider(provider_id: int, provider: schemas.ModelProviderCreate, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    db_provider = db.query(models.ModelProvider).filter(models.ModelProvider.id == provider_id, models.ModelProvider.user_id == user.id).first()
    if not db_provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    for k, v in provider.dict().items():
        setattr(db_provider, k, v)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.delete("/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    db_provider = db.query(models.ModelProvider).filter(models.ModelProvider.id == provider_id, models.ModelProvider.user_id == user.id).first()
    if not db_provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(db_provider)
    db.commit()
    return {"ok": True}

@router.get("/models")
def list_models(provider_id: int, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    models_list = db.query(models.Model).filter(models.Model.provider_id == provider_id).all()
    return [{"id": m.id, "name": m.name, "provider_id": m.provider_id} for m in models_list]

@router.post("/models", response_model=schemas.ModelOut)
def create_model(model: schemas.ModelCreate, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    db_provider = db.query(models.ModelProvider).filter(models.ModelProvider.id == model.provider_id, models.ModelProvider.user_id == user.id).first()
    if not db_provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    db_model = models.Model(**model.dict())
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@router.delete("/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(database.get_db), user: models.User = Depends(get_current_user)):
    db_model = db.query(models.Model).join(models.ModelProvider).filter(models.Model.id == model_id, models.ModelProvider.user_id == user.id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(db_model)
    db.commit()
    return {"ok": True}
