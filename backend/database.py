"""Use the existing schema and transaction rules. Never migrate/reset on startup."""
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from .errors import ApiError


class Database:
    def __init__(self, settings):
        self.settings = settings
        self.configured = settings.database_configured

    def connect(self):
        if not self.configured:
            raise ApiError("PostgreSQL is not configured.", 503)
        return psycopg.connect(**self.settings.database_connection, row_factory=dict_row)

    def health(self):
        try:
            with self.connect() as conn:
                conn.execute("SELECT revision FROM finagenticai.workspace_revision WHERE id=1").fetchone()
        except Exception:
            raise ApiError("PostgreSQL is unavailable or its schema is not initialized. Check Docker and run npm run database:setup.", 503) from None
        return {"configured": True, "available": True}

    @staticmethod
    def read_with(conn):
        revision = conn.execute("SELECT revision FROM finagenticai.workspace_revision WHERE id=1").fetchone()["revision"]
        if revision == 0:
            return {"revision": 0, "records": None}
        records = {}
        for name, table in [("companies", "companies"), ("users", "users"), ("periods", "reporting_periods"), ("submissions", "submissions")]:
            records[name] = [row["record"] for row in conn.execute(f"SELECT record FROM finagenticai.{table} ORDER BY ordinal,id").fetchall()]
        return {"revision": revision, "records": records}

    def read(self):
        with self.connect() as conn:
            conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            return self.read_with(conn)

    def save(self, revision, records):
        if type(revision) is not int or not 0 <= revision <= 9007199254740991:
            raise ApiError("Provide the database revision.")
        with self.connect() as conn:
            current = conn.execute("SELECT revision FROM finagenticai.workspace_revision WHERE id=1 FOR UPDATE").fetchone()["revision"]
            if revision != current:
                raise ApiError("Database records changed in another tab or browser. Reload before making further changes.", 409)
            existing = self.read_with(conn)
            if existing["records"]:
                for name in ("companies", "users", "periods", "submissions"):
                    incoming = {row["id"]: row for row in records[name]}
                    for old in existing["records"][name]:
                        row = incoming.get(old["id"])
                        if row is None:
                            raise ApiError("Existing database records cannot be removed by a browser reset. Reload to restore the records.", 409)
                        if name == "submissions" and (any(old.get(field) != row.get(field) for field in ("company", "period", "revision", "file")) or
                                (old.get("originalWorkbook") and old["originalWorkbook"].get("accessToken") != (row.get("originalWorkbook") or {}).get("accessToken"))):
                            raise ApiError("An existing submission version and its original workbook cannot be replaced.", 409)
            for ordinal, c in enumerate(records["companies"]):
                conn.execute("INSERT INTO finagenticai.companies(id,name,sector,active,reporting,record,ordinal) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,sector=EXCLUDED.sector,active=EXCLUDED.active,reporting=EXCLUDED.reporting,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal",
                             (c["id"], c["name"], c["sector"], c["active"], c["reporting"], Jsonb(c), ordinal))
            for ordinal, u in enumerate(records["users"]):
                conn.execute("INSERT INTO finagenticai.users(id,email,name,role,company_id,active,record,ordinal) VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,role=EXCLUDED.role,company_id=EXCLUDED.company_id,active=EXCLUDED.active,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal",
                             (u["id"], u["email"], u["name"], u["role"], None if u["role"] == "admin" else u["company"], u["active"], Jsonb(u), ordinal))
            for ordinal, p in enumerate(records["periods"]):
                conn.execute("INSERT INTO finagenticai.reporting_periods(id,label,open_date,deadline,state,record,ordinal) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET label=EXCLUDED.label,open_date=EXCLUDED.open_date,deadline=EXCLUDED.deadline,state=EXCLUDED.state,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal",
                             (p["id"], p["period"], p["openDate"], p["deadline"], p["state"], Jsonb(p), ordinal))
            for ordinal, r in enumerate(records["submissions"]):
                conn.execute("INSERT INTO finagenticai.submissions(id,company_id,period_label,revision,filename,validation_status,original_workbook,record,ordinal) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET validation_status=EXCLUDED.validation_status,original_workbook=EXCLUDED.original_workbook,record=EXCLUDED.record,ordinal=EXCLUDED.ordinal",
                             (r["id"], r["company"], r["period"], r["revision"], r["file"], r.get("validationStatus"), Jsonb(r["originalWorkbook"]) if r.get("originalWorkbook") else None, Jsonb(r), ordinal))
            conn.execute("UPDATE finagenticai.workspace_revision SET revision=revision+1,updated_at=now() WHERE id=1")
        return {"revision": revision + 1, "records": records}
