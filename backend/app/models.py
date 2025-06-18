from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    email = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    providers = relationship("ModelProvider", back_populates="user")
    histories = relationship("ChatHistory", back_populates="user")
    settings = relationship("ChatSetting", back_populates="user", uselist=False)

class ModelProvider(Base):
    __tablename__ = "model_providers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    api_host = Column(String)
    api_key = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", back_populates="providers")
    models = relationship("Model", back_populates="provider")

class Model(Base):
    __tablename__ = "models"
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("model_providers.id"))
    name = Column(String)
    provider = relationship("ModelProvider", back_populates="models")

class ChatHistory(Base):
    __tablename__ = "chat_histories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", back_populates="histories")
    messages = relationship("ChatMessage", back_populates="history")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    history_id = Column(Integer, ForeignKey("chat_histories.id"))
    sender = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    history = relationship("ChatHistory", back_populates="messages")

class ChatSetting(Base):
    __tablename__ = "chat_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    temperature = Column(Float, default=1.0)
    max_tokens = Column(Integer, default=2048)
    stream = Column(Boolean, default=False)
    user = relationship("User", back_populates="settings")
