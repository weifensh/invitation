# LLM Chatbot

This project is a full-stack LLM chatbot with a separated frontend and backend, supporting multiple model providers, contextual conversation, streaming output, and more.

## Directory Structure

- `backend/`  Backend (FastAPI + SQLAlchemy)
  - `app/`      Main application directory
    - `main.py`         FastAPI entry point
    - `models.py`       ORM data models
    - `schemas.py`      Pydantic validation models
    - `routers/`        Routers (chat, model_providers, settings, users)
    - `auth.py`         Authentication
    - `database.py`     Database connection
  - `requirements.txt`  Backend dependencies
  - `chatbot.db`        sqlite database (ignored by .gitignore, not versioned)

- `frontend/` Frontend (React + Ant Design)
  - `src/components/`   Main UI components (MainArea, Sidebar)
  - `src/api/`          Frontend API wrappers
  - `src/pages/`        Page-level components (Login)
  - `public/`           Static assets
  - `package.json`      Frontend dependencies

## Environment Setup

### Backend

1. Go to the backend directory and install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Start the FastAPI service (default port 8000):

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   > The database file `backend/chatbot.db` will be created automatically. **Do not add it to git.**

### Frontend

1. Go to the frontend directory and install dependencies:

   ```bash
   npm install
   ```

2. Start the development server (default port 3000):

   ```bash
   npm start
   ```

   - Proxy is configured. Frontend requests to `/chat`, `/auth`, `/model_providers`, `/settings` will be forwarded to `http://localhost:8000`.

## Main Features

- CRUD for multiple model providers and models
- Chat context automatically includes history, LLM can fully understand the conversation
- Supports both streaming and non-streaming message output
- User login and token validation
- LLM parameters (temperature, max_tokens, stream) are configurable

## Main API Endpoints (Partial)

- `/auth/login` User login
- `/chat/histories` Chat history management
- `/chat/histories/{history_id}/messages` Chat messages (supports streaming and non-streaming)
- `/model_providers/` Model provider management
- `/settings/` User LLM parameter settings

## Version Control Recommendations

- `backend/chatbot.db` is in `.gitignore` and should not be versioned
- `frontend/node_modules/` is ignored
- Only source code, configuration, and dependency files need to be committed

## Other

- Frontend is based on Create React App, supports hot reload, unit testing, etc.
- Backend supports CORS for easy local development
- For production deployment, adjust CORS, database, and other configurations as needed

---

For detailed development documentation or API reference, please check the source code or open an issue. 