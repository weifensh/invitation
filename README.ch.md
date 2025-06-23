# LLM Chatbot

本项目为前后端分离的 LLM 聊天机器人，支持多模型供应商、上下文对话、流式输出等功能。

## 目录结构

- `backend/`  后端（FastAPI + SQLAlchemy）
  - `app/`      主应用目录
    - `main.py`         FastAPI 启动入口
    - `models.py`       ORM 数据模型
    - `schemas.py`      Pydantic 校验模型
    - `routers/`        路由（chat, model_providers, settings, users）
    - `auth.py`         认证相关
    - `database.py`     数据库连接
  - `requirements.txt`  后端依赖
  - `chatbot.db`        sqlite 数据库（已被 .gitignore 忽略，不纳入版本管理）

- `frontend/` 前端（React + Ant Design）
  - `src/components/`   主要 UI 组件（MainArea, Sidebar）
  - `src/api/`          前端 API 封装
  - `src/pages/`        页面级组件（Login）
  - `public/`           静态资源
  - `package.json`      前端依赖

## 环境准备

### 后端

1. 进入 backend 目录，安装依赖：

   ```bash
   pip install -r requirements.txt
   ```

2. 启动 FastAPI 服务（默认端口 8000）：

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   > 数据库文件 `backend/chatbot.db` 会自动创建。**无需纳入 git 管理**。

### 前端

1. 进入 frontend 目录，安装依赖：

   ```bash
   npm install
   ```

2. 启动开发服务器（默认端口 3000）：

   ```bash
   npm start
   ```

   - 已配置代理，前端请求 `/chat` `/auth` `/model_providers` `/settings` 会自动转发到 `http://localhost:8000`。

## 主要功能

- 支持多模型供应商和模型的增删改查
- 聊天上下文自动携带历史消息，LLM 能完整理解对话
- 支持流式和非流式消息输出
- 用户登录、token 校验
- LLM 参数（temperature, max_tokens, stream）可配置

## 主要 API 路径（部分）

- `/auth/login` 用户登录
- `/chat/histories` 聊天历史管理
- `/chat/histories/{history_id}/messages` 聊天消息（支持流式和非流式）
- `/model_providers/` 模型供应商管理
- `/settings/` 用户 LLM 参数设置

## 版本管理建议

- `backend/chatbot.db` 已加入 `.gitignore`，不应纳入版本管理
- `frontend/node_modules/` 已忽略
- 仅需提交源码、配置、依赖文件

## 其他

- 前端基于 Create React App，支持热更新、单元测试等
- 后端支持 CORS，便于本地联调
- 如需生产部署，请根据实际环境调整 CORS、数据库等配置

---

如需详细开发文档或接口说明，请查阅源码或补充 issue。