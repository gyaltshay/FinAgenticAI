"""Read the existing private configuration without replacing any credentials."""
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_env(path: Path) -> dict:
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if match:
            value = match[2]
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[match[1]] = value
    return values


@dataclass
class Settings:
    values: dict = field(repr=False)
    root: Path = ROOT

    @classmethod
    def load(cls):
        values = dict(os.environ)
        for path, prefix in [(ROOT / "frontend/.env.local", ""),
                             (ROOT / ".env.storage.local", "MINIO_"),
                             (ROOT / ".env.database.local", "PG"),
                             (ROOT / ".env.backend.local", "")]:
            for key, value in read_env(path).items():
                if key.startswith(prefix) and not values.get(key):
                    values[key] = value
        return cls(values)

    @property
    def database_configured(self):
        return self.values.get("FINAGENTIC_DATABASE_DISABLED") != "1" and all(
            self.values.get(key) for key in ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD")
        ) and not self.values["PGPASSWORD"].startswith("replace-with-")

    @property
    def database_connection(self):
        v = self.values
        return dict(host=v.get("PGHOST"), port=int(v.get("PGPORT", "5432")),
                    dbname=v.get("PGDATABASE"), user=v.get("PGUSER"), password=v.get("PGPASSWORD"),
                    connect_timeout=5, options="-c statement_timeout=15000")

    @property
    def model(self):
        return self.values.get("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()

    @property
    def api_key(self):
        return self.values.get("GEMINI_API_KEY", "")
