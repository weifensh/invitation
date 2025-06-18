from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import users, chat, model_providers, settings

app = FastAPI()

# 添加 CORS 支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境可用，生产建议指定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(users.router, prefix="/auth", tags=["auth"])
app.include_router(model_providers.router, prefix="/model_providers", tags=["model_providers"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
