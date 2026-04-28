
import os
import json
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import uuid

DEFAULT_MCP_CONFIG = json.dumps({
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}, indent=2)

CONFIG_FILE_PATH = os.path.join(os.getcwd(), 'data', 'config.json')

class ApiConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Default"
    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"

class AppConfig(BaseModel):
    # Backwards compatible properties, will map to configs list
    configs: List[ApiConfig] = Field(default_factory=list)
    active_config_id: Optional[str] = None

    # Legacy fields mapping
    @property
    def api_key(self) -> str:
        active = self.get_active_config()
        return active.api_key if active else os.getenv("OPENAI_API_KEY", "")

    @api_key.setter
    def api_key(self, value: str):
        active = self.get_active_config()
        if active:
            active.api_key = value

    @property
    def base_url(self) -> str:
        active = self.get_active_config()
        return active.base_url if active else os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    @base_url.setter
    def base_url(self, value: str):
        active = self.get_active_config()
        if active:
            active.base_url = value

    @property
    def model(self) -> str:
        active = self.get_active_config()
        return active.model if active else os.getenv("MODEL_ID", "gpt-4o-mini")

    @model.setter
    def model(self, value: str):
        active = self.get_active_config()
        if active:
            active.model = value

    system_prompt: str = Field(default="You are a world-class AI harness agent. You have the power to do anything in the user's system via terminal access. You should assist the user using the available tools, including self-optimization using the Meta-Harness methodology.")

    mcp_config_str: str = Field(default=DEFAULT_MCP_CONFIG)
    skills_config_str: str = Field(default="{}")
    sudo_password: str = Field(default="")
    workspace_dir: str = Field(default=os.getcwd())

    def __init__(self, **data):
        super().__init__(**data)
        self.load_config()
        self._ensure_default_config()

    def _ensure_default_config(self):
        if not self.configs:
            self.configs.append(ApiConfig(
                label="Default",
                api_key=os.getenv("OPENAI_API_KEY", ""),
                base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                model=os.getenv("MODEL_ID", "gpt-4o-mini")
            ))
        if not self.active_config_id:
            self.active_config_id = self.configs[0].id

    def get_active_config(self) -> Optional[ApiConfig]:
        if not self.active_config_id and not self.configs:
            return None
        for c in self.configs:
            if c.id == self.active_config_id:
                return c
        if self.configs:
            self.active_config_id = self.configs[0].id
            return self.configs[0]
        return None

    def get_config_by_id(self, config_id: str) -> Optional[ApiConfig]:
        for c in self.configs:
            if c.id == config_id:
                return c
        return None

    def load_config(self):
        if os.path.exists(CONFIG_FILE_PATH):
            try:
                with open(CONFIG_FILE_PATH, 'r') as f:
                    data = json.load(f)

                    # Migration from old format
                    if "api_key" in data and "configs" not in data:
                        migrated_config = ApiConfig(
                            label="Default (Migrated)",
                            api_key=data.get("api_key", ""),
                            base_url=data.get("base_url", "https://api.openai.com/v1"),
                            model=data.get("model", "gpt-4o-mini")
                        )
                        self.configs = [migrated_config]
                        self.active_config_id = migrated_config.id

                    for key, value in data.items():
                        # Skip old legacy fields
                        if key in ["api_key", "base_url", "model"] and "configs" not in data:
                            continue
                        if hasattr(self, key):
                            try:
                                if key == "configs":
                                    self.configs = [ApiConfig(**c) if isinstance(c, dict) else c for c in value]
                                else:
                                    setattr(self, key, value)
                            except Exception as e:
                                pass # ignore property setting errors during load
            except Exception as e:
                print(f"Error loading config from {CONFIG_FILE_PATH}: {e}")

    def save_config(self):
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
            with open(CONFIG_FILE_PATH, 'w') as f:
                # Exclude sudo_password from persistent storage for security
                dump = self.model_dump(exclude={"sudo_password"})

                # Make sure properties aren't dumped, Pydantic handles this mostly, but let's be sure
                json.dump(dump, f, indent=2)
        except Exception as e:
            print(f"Error saving config to {CONFIG_FILE_PATH}: {e}")

config = AppConfig()
