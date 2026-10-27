"""Run from any working directory using the project virtual environment."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if __name__ == "__main__":
    import uvicorn
    from backend.config import Settings

    settings = Settings.load()
    port = int(settings.values.get("FINAGENTIC_API_PORT") or settings.values.get("GEMINI_PORT") or "3001")
    uvicorn.run("backend.app:app", host="127.0.0.1", port=port, access_log=False, proxy_headers=False)
