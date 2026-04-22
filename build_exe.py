import subprocess
import sys
import os

def build():
    print("Installing PyInstaller...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    print("Building executable...")
    # --onefile creates a single .exe
    # --windowed removes the console window
    # Note: We do NOT bundle the ui/ or backend/ folders into the exe.
    # The exe expects them to be alongside it, allowing self-evolution!
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onefile",
        "--windowed",
        "launcher.py"
    ]
    subprocess.check_call(cmd)
    print("Build complete. Find the executable in the 'dist' folder.")

if __name__ == "__main__":
    build()
