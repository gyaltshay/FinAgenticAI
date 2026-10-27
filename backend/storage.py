"""S3 storage compatible with existing Node-issued workbook receipts."""
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import boto3
from botocore.config import Config

from .errors import ApiError

WORKBOOK_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_WORKBOOK = 20 * 1024 * 1024


def encode_component(text):
    return quote(text, safe="~!*'()-._")


def b64url(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


class WorkbookStorage:
    def __init__(self, settings, client=None):
        v = settings.values
        self.bucket = v.get("MINIO_BUCKET")
        self.configured = bool(self.bucket and v.get("MINIO_ENDPOINT") and
                               (v.get("MINIO_ACCESS_KEY") or v.get("MINIO_ROOT_USER")) and
                               (v.get("MINIO_SECRET_KEY") or v.get("MINIO_ROOT_PASSWORD")))
        key_path = settings.root / ".local/minio/receipt-signing.key"
        key_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with key_path.open("xb") as file:
                file.write(os.urandom(48))
        except FileExistsError:
            pass
        self.signing_key = key_path.read_bytes()
        if len(self.signing_key) < 32:
            raise RuntimeError("Storage receipt signing key is invalid.")
        self.client = client
        if self.configured and self.client is None:
            self.client = boto3.client(
                "s3", endpoint_url=v["MINIO_ENDPOINT"], region_name="us-east-1",
                aws_access_key_id=v.get("MINIO_ACCESS_KEY") or v["MINIO_ROOT_USER"],
                aws_secret_access_key=v.get("MINIO_SECRET_KEY") or v["MINIO_ROOT_PASSWORD"],
                config=Config(connect_timeout=5, read_timeout=20, retries={"max_attempts": 2},
                              s3={"addressing_style": "path"}, request_checksum_calculation="when_required"),
            )

    def required(self):
        if not self.configured:
            raise ApiError("Workbook storage is not configured. Start MinIO and configure .env.storage.local.", 503)

    def sign(self, payload):
        return b64url(hmac.new(self.signing_key, payload.encode(), hashlib.sha256).digest())

    def verify(self, receipt):
        self.required()
        token = receipt.get("accessToken") if isinstance(receipt, dict) else None
        if not isinstance(token, str) or len(token) > 5000:
            raise ApiError("A valid original-workbook receipt is required.", 403)
        try:
            payload, signature = token.split(".")
            if not hmac.compare_digest(signature.encode(), self.sign(payload).encode()):
                raise ValueError()
            record = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
            if record["bucket"] != self.bucket or record["id"] != receipt.get("id") or not record["key"].startswith("originals/"):
                raise ValueError()
        except (ValueError, KeyError, TypeError, binascii.Error):
            raise ApiError("Original-workbook access denied.", 403) from None
        return record

    def health(self):
        self.required()
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            raise ApiError("Workbook storage is unavailable. Check Docker, MinIO, and the upload bucket.", 503) from None
        return {"configured": True, "available": True}

    def save(self, item):
        self.required()
        for field in ("submissionId", "company", "period", "uploadedBy"):
            value = item.get(field)
            if not isinstance(value, str) or not value.strip() or len(value.encode("utf-16-le")) // 2 > 160:
                raise ApiError("Provide submission, company, period, and uploader details.")
        if type(item.get("version")) is not int or not 0 < item["version"] <= 9007199254740991:
            raise ApiError("Provide a positive submission version.")
        name = item.get("fileName")
        if not isinstance(name, str) or len(name.encode("utf-16-le")) // 2 > 240 or re.search(r"[\x00-\x1f]", name) or not name.lower().endswith(".xlsx"):
            raise ApiError("Choose an .xlsx workbook with a valid filename.")
        raw = item.get("fileBase64")
        if not isinstance(raw, str) or not raw or len(raw) > 27962028 or re.search(r"[^A-Za-z0-9+/=]", raw):
            raise ApiError("The workbook data is invalid or exceeds 20 MB.")
        try:
            content = base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            raise ApiError("The workbook encoding is invalid.") from None
        if not content or len(content) > MAX_WORKBOOK:
            raise ApiError("Choose a non-empty workbook up to 20 MB.", 413)
        if base64.b64encode(content).decode() != raw:
            raise ApiError("The workbook encoding is invalid.")
        if not content.startswith(b"PK\x03\x04"):
            raise ApiError("The selected file is not an XLSX archive.")
        identity = str(uuid.uuid4())
        record = {"id": identity, "bucket": self.bucket,
                  "key": "originals/" + "/".join(encode_component(item[k].strip()) for k in ("company", "period", "submissionId")) + f"/v{item['version']}/{identity}/original.xlsx",
                  "submissionId": item["submissionId"], "company": item["company"], "period": item["period"],
                  "version": item["version"], "fileName": re.split(r"[\\/]", name)[-1], "size": len(content),
                  "sha256": hashlib.sha256(content).hexdigest(), "uploadedBy": item["uploadedBy"],
                  "uploadedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")}
        metadata = {"submission-id": encode_component(record["submissionId"]), "company": encode_component(record["company"]),
                    "period": encode_component(record["period"]), "version": str(record["version"]),
                    "original-filename": encode_component(record["fileName"]), "uploaded-by": encode_component(record["uploadedBy"]),
                    "uploaded-at": record["uploadedAt"], "sha256": record["sha256"]}
        try:
            self.client.put_object(Bucket=self.bucket, Key=record["key"], Body=content, ContentType=WORKBOOK_TYPE,
                                   IfNoneMatch="*", Metadata=metadata)
        except Exception:
            raise ApiError("The original workbook could not be stored. Check that MinIO is running, then submit again.", 503) from None
        payload = b64url(json.dumps(record, ensure_ascii=False, separators=(",", ":")).encode())
        return {**record, "accessToken": payload + "." + self.sign(payload)}

    def read(self, receipt, expected=None):
        record = self.verify(receipt)
        if expected is not None and any(record[field] != expected.get(field) for field in ("submissionId", "company", "period", "version")):
            raise ApiError("The stored workbook belongs to a different submission version.", 409)
        try:
            body = self.client.get_object(Bucket=self.bucket, Key=record["key"])["Body"]
            try:
                content = body.read(MAX_WORKBOOK + 1)
            finally:
                body.close()
        except Exception:
            raise ApiError("The original workbook is unavailable. Check MinIO and try again.", 503) from None
        if len(content) != record["size"] or hashlib.sha256(content).hexdigest() != record["sha256"]:
            raise ApiError("The stored workbook failed its integrity check.", 502)
        return record, content
