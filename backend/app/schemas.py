from pydantic import BaseModel, EmailStr
from typing import Optional, List
import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime.datetime
    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    username: str
    password: str

class ModelProviderBase(BaseModel):
    name: str
    api_host: str
    api_key: str

class ModelProviderCreate(ModelProviderBase):
    pass

class ModelProviderOut(ModelProviderBase):
    id: int
    created_at: datetime.datetime
    class Config:
        orm_mode = True

class ModelBase(BaseModel):
    name: str

class ModelCreate(ModelBase):
    provider_id: int

class ModelOut(ModelBase):
    id: int
    provider_id: int
    class Config:
        orm_mode = True

class ChatHistoryBase(BaseModel):
    title: str

class ChatHistoryCreate(ChatHistoryBase):
    pass

class ChatHistoryOut(ChatHistoryBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    class Config:
        orm_mode = True

class ChatMessageBase(BaseModel):
    sender: str
    content: str
    model_id: Optional[int] = None
    provider_id: Optional[int] = None

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessageOut(ChatMessageBase):
    id: int
    created_at: datetime.datetime
    class Config:
        orm_mode = True

class ChatSettingBase(BaseModel):
    temperature: float
    max_tokens: int
    stream: bool

class ChatSettingUpdate(ChatSettingBase):
    pass

class ChatSettingOut(ChatSettingBase):
    id: int
    class Config:
        orm_mode = True

class GenerateTitleRequest(BaseModel):
    content: str

class GenerateTitleResponse(BaseModel):
    title: str
