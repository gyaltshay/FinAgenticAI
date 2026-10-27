"""Explicit setup command and a guarded native adapter for disposable QA databases."""
import json
import re
import sys

import psycopg
from psycopg import sql

from .config import Settings
from .database import Database
from .errors import ApiError
from .finance import FinancialContracts


def setup(settings):
    values = settings.values
    connection = settings.database_connection
    user, name = connection["user"], connection["dbname"]
    admin_user = values.get("PGADMIN_USER", "postgres")
    if not settings.database_configured or not values.get("PGADMIN_PASSWORD") or values["PGADMIN_PASSWORD"].startswith("replace-with-"):
        raise ApiError("Complete .env.database.local before running setup.")
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,50}", name) or not re.fullmatch(r"[a-z][a-z0-9_]{2,50}", user) or user == admin_user:
        raise ApiError("Use a dedicated database and application role.")
    admin_config = {**connection, "dbname": "postgres", "user": admin_user, "password": values["PGADMIN_PASSWORD"]}
    with psycopg.connect(**admin_config, autocommit=True) as admin:
        if not admin.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (user,)).fetchone():
            admin.execute(sql.SQL("CREATE ROLE {} LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE").format(sql.Identifier(user), sql.Literal(connection["password"])))
        existing = admin.execute("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=%s", (name,)).fetchone()
        if existing and existing[0] != user:
            raise ApiError("The existing database belongs to another role; setup will not alter it.")
        if not existing:
            admin.execute(sql.SQL("CREATE DATABASE {} OWNER {}").format(sql.Identifier(name), sql.Identifier(user)))
    schema = settings.root / "frontend/server/migrations/001-core.sql"
    with Database(settings).connect() as app:
        app.execute(schema.read_text(encoding="utf-8"), prepare=False)


def test_records(settings, command, item):
    if not re.fullmatch(r"finagenticai_check_[0-9a-f]{16}", settings.values.get("PGDATABASE", "")):
        raise ApiError("The QA record adapter is restricted to disposable test databases.")
    database = Database(settings)
    if command == "read-test-records":
        return database.read()
    records = FinancialContracts(settings).call("database_records", item.get("records"))
    return database.save(item.get("revision"), records)


def main():
    command = sys.argv[1] if len(sys.argv) == 2 else ""
    try:
        settings = Settings.load()
        if command == "setup":
            setup(settings)
            print("FinAgenticAI database initialized with a dedicated non-superuser application role. Existing records were preserved.")
            return
        if command not in ("read-test-records", "save-test-records"):
            raise ApiError("Unknown database management command.")
        item = json.load(sys.stdin)
        print(json.dumps({"result": test_records(settings, command, item)}, ensure_ascii=False, allow_nan=False))
    except Exception as error:
        message = str(error) if isinstance(error, ApiError) else "Database operation failed. Check the private configuration and PostgreSQL service."
        print(json.dumps({"error": message, "status": getattr(error, "status", 503)}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
