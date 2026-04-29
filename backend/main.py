
from fastapi import FastAPI, Request, Body, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import asyncio
import zipfile
import shutil

from .config import config, ApiConfig
from .memory import memory
from .agent import agent
from .mcp_manager import mcp_manager

app = FastAPI()

# Get the directory of the current file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI_DIR = os.path.join(BASE_DIR, "ui")

# Serve static files (CSS, JS)
app.mount("/static", StaticFiles(directory=UI_DIR), name="static")

templates = Jinja2Templates(directory=UI_DIR)

@app.on_event("startup")
async def startup_event():
    # Load default MCP configuration
    asyncio.create_task(mcp_manager.reload_config(config.mcp_config_str))

    # Download default skills if they don't exist
    import urllib.request
    from .tools import install_skill

    skills_dir = os.path.join(config.workspace_dir, "skills")

    def download_and_install_skill(url, folder_name, zip_name):
        target_dir = os.path.join(skills_dir, folder_name)
        if not os.path.exists(target_dir):
            try:
                print(f"Downloading {zip_name} from {url}...")
                zip_path = os.path.join(config.workspace_dir, zip_name)
                urllib.request.urlretrieve(url, zip_path)
                print(f"Extracting {zip_name}...")
                install_skill(zip_path)
                os.remove(zip_path)
                print(f"Successfully installed {folder_name}")
            except Exception as e:
                print(f"Failed to download/install {folder_name}: {e}")

    # Start downloads in a background thread to avoid blocking startup
    def init_skills():
        download_and_install_skill(
            "https://github.com/LeoYeAI/openclaw-master-skills/archive/refs/heads/main.zip",
            "openclaw-master-skills-main",
            "openclaw-master-skills.zip"
        )
        download_and_install_skill(
            "https://github.com/obra/superpowers/archive/refs/heads/main.zip",
            "superpowers-main",
            "superpowers.zip"
        )

    import threading
    threading.Thread(target=init_skills, daemon=True).start()

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"request": request})

@app.get("/api/status")
async def get_status():
    return {"status": "ok", "message": "Backend is running"}

class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    async def generate():
        async for chunk in agent.chat(request.session_id, request.message):
            yield f"data: {json.dumps(chunk)}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/api/chat/stop")
async def chat_stop_endpoint(request: Request):
    data = await request.json()
    session_id = data.get("session_id")
    if session_id:
        session = memory.get_session(session_id)
        session.is_cancelled = True
        memory.save_session(session_id)
        return {"status": "ok", "message": "Session marked for cancellation"}
    raise HTTPException(status_code=400, detail="session_id required")

@app.get("/api/sessions")
async def get_sessions():
    sessions = []
    for session_id, session in memory.sessions.items():
        # Get preview from first user message, or default title
        title = "New Session"
        for msg in session.messages:
            if msg.role == "user":
                title = msg.content[:30] + ("..." if len(msg.content) > 30 else "")
                break

        sessions.append({
            "id": session_id,
            "title": title,
            "message_count": len(session.messages),
            "config_id": session.config_id
        })
    # Sort descending by id assuming id has timestamp
    sessions.sort(key=lambda x: x["id"], reverse=True)
    return {"sessions": sessions}

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session = memory.get_session(session_id)
    return {
        "history": memory.get_history(session_id),
        "config_id": session.config_id,
        "model_id": session.model_id
    }

class ConfigUpdate(BaseModel):
    api_key: str
    base_url: str
    models: str
    system_prompt: str
    mcp_config_str: str
    skills_config_str: str
    workspace_dir: str

@app.get("/api/config")
async def get_config():
    # Return backwards compatible config representation
    return {
        "api_key": config.api_key,
        "base_url": config.base_url,
        "models": config.models,
        "system_prompt": config.system_prompt,
        "mcp_config_str": config.mcp_config_str,
        "skills_config_str": config.skills_config_str,
        "workspace_dir": config.workspace_dir
    }

@app.post("/api/config")
async def update_config(update: ConfigUpdate):
    # This edits the active config or creates a default if none exists
    config.api_key = update.api_key
    config.base_url = update.base_url
    config.models = update.models
    config.system_prompt = update.system_prompt
    config.workspace_dir = update.workspace_dir
    config.skills_config_str = update.skills_config_str

    if config.mcp_config_str != update.mcp_config_str:
        config.mcp_config_str = update.mcp_config_str
        # Start reload task in background
        asyncio.create_task(mcp_manager.reload_config(config.mcp_config_str))

    # Persist the configuration changes
    config.save_config()

    return {"status": "ok"}

# Multi-API Config endpoints
@app.get("/api/configs")
async def get_configs():
    safe_configs = []
    for c in config.configs:
        masked_key = ""
        if c.api_key:
            if len(c.api_key) > 8:
                masked_key = c.api_key[:4] + "..." + c.api_key[-4:]
            else:
                masked_key = "***"

        safe_configs.append({
            "id": c.id,
            "label": c.label,
            "api_key_masked": masked_key,
            "base_url": c.base_url,
            "models": c.models
        })

    return {
        "configs": safe_configs,
        "active_config_id": config.active_config_id
    }

class AddApiConfig(BaseModel):
    label: str
    api_key: str
    base_url: str
    models: str

@app.post("/api/configs/add")
async def add_api_config(new_config: AddApiConfig):
    api_config = ApiConfig(
        label=new_config.label,
        api_key=new_config.api_key,
        base_url=new_config.base_url,
        models=new_config.models
    )
    config.configs.append(api_config)
    config.save_config()
    return {"status": "ok", "id": api_config.id}

class SwitchApiConfig(BaseModel):
    config_id: str
    session_id: Optional[str] = None

@app.post("/api/configs/switch")
async def switch_api_config(request: SwitchApiConfig):
    if not config.get_config_by_id(request.config_id):
        raise HTTPException(status_code=404, detail="Configuration not found")

    # If session_id is provided, switch it for the session
    if request.session_id:
        session = memory.get_session(request.session_id)
        session.config_id = request.config_id
        memory.save_session(request.session_id)

    # Also set it as the global active config
    config.active_config_id = request.config_id
    config.save_config()

    return {"status": "ok"}


class SwitchSessionModel(BaseModel):
    model_id: str

@app.post("/api/sessions/{session_id}/model")
async def switch_session_model(session_id: str, request: SwitchSessionModel):
    session = memory.get_session(session_id)
    session.model_id = request.model_id
    memory.save_session(session_id)
    return {"status": "ok"}

class SudoUpdate(BaseModel):
    sudo_password: str

@app.post("/api/sudo")
async def update_sudo(update: SudoUpdate):
    config.sudo_password = update.sudo_password
    return {"status": "ok"}

@app.post("/api/skills/upload")
async def upload_skill(file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="File must be a .zip")

    skills_dir = os.path.join(config.workspace_dir, "skills")
    os.makedirs(skills_dir, exist_ok=True)

    # Sanitize the filename to prevent path traversal
    safe_filename = os.path.basename(file.filename)
    zip_path = os.path.join(config.workspace_dir, safe_filename)

    try:
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Use our existing tool logic to extract
        from .tools import install_skill
        result = install_skill(zip_path)

        # Clean up the zip file
        os.remove(zip_path)

        return {"status": "ok", "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
