import webview
import threading
import uvicorn
from backend.main import app
import os
import sys

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == '__main__':
    # Start the backend server in a separate thread
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    # In actual Windows .exe this will launch a native window using Edge/Trident
    # In this container env, we simply wait
    try:
        webview.create_window('AI Harness', 'http://127.0.0.1:8000', width=1200, height=800)
        webview.start()
    except Exception as e:
        print(f"Warning: pywebview failed to start ({e}). Server is still running at http://127.0.0.1:8000")
        t.join()
