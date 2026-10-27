"""Preserve tested shared financial signatures and decimal arithmetic during migration."""
import json
import os
import subprocess
from .config import Settings
from .errors import ApiError


class FinancialContracts:
    def __init__(self, settings: Settings):
        self.settings = settings

    def call(self, operation, value):
        # Keep financial inputs off command lines and credentials out of this worker.
        env = {key: value for key, value in os.environ.items()
               if key.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "PATHEXT"}}
        env["NODE_NO_WARNINGS"] = "1"
        try:
            process = subprocess.run(
                [self.settings.values.get("NODE_EXECUTABLE", "node"), str(self.settings.root / "backend/finance_worker.mjs")],
                input=json.dumps({"operation": operation, "input": value}, ensure_ascii=False, allow_nan=False).encode(),
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, env=env,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            result = json.loads(process.stdout)
        except (OSError, subprocess.TimeoutExpired, ValueError):
            raise ApiError("The financial contract worker is unavailable. Check the Node.js runtime.", 503) from None
        if "error" in result:
            raise ApiError(result["error"], result.get("status", 422))
        if process.returncode or "result" not in result:
            raise ApiError("The financial contract worker returned an invalid response.", 502)
        return result["result"]
