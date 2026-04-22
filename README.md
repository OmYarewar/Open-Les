<div align="center">
  <img src="https://lucide.dev/icons/cpu.svg" width="100" height="100" alt="Open-Les Logo">
  <h1>🌟 Open-Les</h1>
  <p><b>An Autonomous, Self-Evolving AI Harness & Agent GUI.</b></p>
  <br/>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-00a393)](https://fastapi.tiangolo.com/)
  [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-38B2AC)](https://tailwindcss.com/)
</div>

---

## 🚀 What is Open-Les?
**Open-Les** is not just another Chat UI. It is an **Autonomous AI Harness** inspired by the tool-calling powers of `claw-code` and the cognitive architecture of `hermes-agent`. 

Open-Les is built with a unique architecture that allows the AI to **rewrite its own source code while it runs.** 

By wrapping a dynamic Python/FastAPI backend and a Tailwind web frontend inside a lightweight launcher executable, the AI can read its own code, suggest improvements, write the files to disk, and restart itself to evolve its own UI and logic. 

## ✨ Key Features
- 🧠 **Self-Evolution Tools:** Built-in capabilities (`read_file`, `write_file`, `execute_terminal_command`, `restart_harness`) that give the AI root access to its own architecture.
- 🔌 **Universal API Compatibility:** Connect to any OpenAI-compatible endpoint (OpenRouter, vLLM, LMStudio, Ollama, etc.) via the gorgeous Settings UI.
- 💾 **Persistent Memory:** Seamlessly manages multi-turn conversation context across sessions using local JSON-backed storage.
- 🎨 **Evolving UI:** The frontend is standard HTML/JS/Tailwind CSS—the AI can easily understand, modify, and improve the UI you interact with!

## 📦 Getting Started

### Option 1: Standalone Executable (No Python Required)
You can simply download the standalone executable and run it immediately!
1. Head over to the [Releases Tab](https://github.com/OmYarewar/Open-Les/releases) and download the latest executable.
2. Ensure you extract the `.exe` alongside the `backend/` and `ui/` folders if you want the AI to be able to rewrite itself!
3. Run the executable.

### Option 2: Run from Source
1. **Clone the repo:**
   ```bash
   git clone https://github.com/OmYarewar/Open-Les.git
   cd Open-Les
   ```
2. **Install Dependencies:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
3. **Run the Harness:**
   ```bash
   chmod +x run.sh
   ./run.sh
   ```

## 🛠️ How It Works Under The Hood
When you run Open-Les, it starts a local FastAPI backend and serves a web interface in a native desktop window (via `pywebview` or simply a browser). The LLM inside is hooked up to system-level tools. 

If you tell the AI: *"Make the background of the chat blue instead of dark gray."*
1. It uses `read_file` to look at `ui/index.html`.
2. It uses `write_file` to update the Tailwind classes.
3. It uses `restart_harness` to reboot the server and boom—you have a blue background.

---
<p align="center"><i>"Code that writes code. GUIs that build themselves."</i></p>
