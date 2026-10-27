import base64
import hashlib
import hmac
import json
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import Settings, ROOT
from backend.errors import ApiError
from backend.storage import WorkbookStorage, b64url
from backend.validation import validate_workbook

sys.path.insert(0, str(ROOT / "frontend/tests"))
from test_ttpl_validation import workbook_bytes


@pytest.fixture
def client():
    return TestClient(create_app(Settings({"FINAGENTIC_DATABASE_DISABLED": "1"})))


def test_health_docs_and_legacy_contracts(client):
    assert client.get("/api/health").json()["backend"] == "fastapi"
    assert client.get("/api/gemini/health").json()["workflow"] == "scoped-v2"
    assert client.get("/api/database/records").json() == {"configured": False}
    assert client.get("/api/database/health").json() == {"configured": False, "available": False}
    assert client.get("/docs").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    for path in ["/api/storage/workbooks", "/api/gemini/validate", "/api/scoped/insights", "/api/scoped/report", "/api/database/records"]:
        assert path in paths
    assert client.post("/api/reporting/generate").status_code == 409
    assert client.post("/api/gemini/insights").status_code == 409
    assert client.get("/missing").json() == {"error": "Not found."}


def test_origin_and_json_errors_keep_frontend_error_shape(client):
    assert client.get("/api/health", headers={"origin": "http://untrusted.example"}).status_code == 403
    assert client.get("/api/health", headers={"origin": "http://testserver"}).status_code == 200
    assert client.post("/api/gemini/validate", content="{}", headers={"content-type": "text/plain"}).status_code == 415
    assert client.post("/api/gemini/validate", content="{", headers={"content-type": "application/json"}).status_code == 400
    assert client.post("/api/gemini/validate", json=[]).status_code == 400
    response = client.post("/api/gemini/validate", json={})
    assert response.status_code == 400 and isinstance(response.json()["error"], str)
    assert client.post("/api/gemini/validate", content=" " * 28_000_001, headers={"content-type": "application/json"}).status_code == 413


def test_direct_python_validation_matches_existing_cli_exactly(client):
    content = workbook_bytes()
    item = {"submissionId": "native-parity", "company": "TTPL", "period": "August 2026", "version": 3,
            "fileName": "synthetic.xlsx", "fileBase64": base64.b64encode(content).decode()}
    payload = {"submission_id": item["submissionId"], "company_id": item["company"], "period_id": item["period"],
               "version": item["version"], "file_name": item["fileName"], "file_base64": item["fileBase64"]}
    process = subprocess.run([sys.executable, str(ROOT / "frontend/server/validate_ttpl_workbook.py")],
                             input=json.dumps(payload).encode(), stdout=subprocess.PIPE, check=True)
    expected = json.loads(process.stdout)
    assert validate_workbook(item) == expected
    response = client.post("/api/gemini/validate", json=item)
    assert response.status_code == 200 and response.json() == expected


def test_invalid_scopes_and_missing_model_do_not_generate_outputs(client):
    assert client.post("/api/scoped/insights", json={}).status_code == 422
    assert client.post("/api/scoped/report", json={}).status_code == 422
    assert client.post("/api/gemini/explain-validation", json={}).status_code == 503


class FakeS3:
    def __init__(self):
        self.objects = {}

    def put_object(self, **item):
        assert item["IfNoneMatch"] == "*"
        assert item["Key"] not in self.objects
        self.objects[item["Key"]] = item["Body"]

    def get_object(self, **item):
        import io
        return {"Body": io.BytesIO(self.objects[item["Key"]])}


@pytest.fixture
def storage(tmp_path):
    settings = Settings({"MINIO_ENDPOINT": "http://127.0.0.1:9000", "MINIO_BUCKET": "unit-test", "MINIO_ROOT_USER": "test", "MINIO_ROOT_PASSWORD": "test-only"}, tmp_path)
    return WorkbookStorage(settings, client=FakeS3())


def test_storage_keeps_separate_versions_and_exact_original_bytes(storage):
    item = {"submissionId": "submission", "company": "TTPL", "period": "August 2026", "version": 1,
            "uploadedBy": "Unit test", "fileName": "Original report.xlsx", "fileBase64": base64.b64encode(b"PK\x03\x04synthetic").decode()}
    first = storage.save(item)
    second = storage.save({**item, "version": 2})
    assert first["key"] != second["key"] and "/v2/" in second["key"]
    assert storage.read(first, item)[1] == base64.b64decode(item["fileBase64"])
    with pytest.raises(ApiError) as error:
        storage.read(first, {**item, "version": 2})
    assert error.value.status == 409
    with pytest.raises(ApiError):
        storage.read({**first, "accessToken": "invalid.receipt"})
    storage.client.objects[first["key"]] = b"changed"
    with pytest.raises(ApiError) as error:
        storage.read(first)
    assert error.value.status == 502


def test_storage_accepts_an_existing_node_receipt_without_rewriting_it(storage):
    record = {"id": "legacy-id", "bucket": storage.bucket, "key": "originals/legacy/original.xlsx", "size": 4, "sha256": hashlib.sha256(b"PK\x03\x04").hexdigest()}
    payload = b64url(json.dumps(record, ensure_ascii=False, separators=(",", ":")).encode())
    signature = b64url(hmac.new(storage.signing_key, payload.encode(), hashlib.sha256).digest())
    receipt = {**record, "accessToken": payload + "." + signature}
    storage.client.objects[record["key"]] = b"PK\x03\x04"
    assert storage.read(receipt)[1] == b"PK\x03\x04"


def test_unconfigured_or_failed_storage_never_reports_success(storage):
    with pytest.raises(ApiError):
        storage.save({})
    with pytest.raises(ApiError) as error:
        storage.read({})
    assert error.value.status == 403
