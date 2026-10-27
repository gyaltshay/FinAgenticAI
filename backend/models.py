"""Request descriptions for OpenAPI; domain checks preserve legacy error contracts."""
from typing import Any
from pydantic import BaseModel


class WorkbookUpload(BaseModel):
    submissionId: str
    company: str
    period: str
    version: int
    uploadedBy: str
    fileName: str
    fileBase64: str


class WorkbookDownload(BaseModel):
    originalWorkbook: dict[str, Any]


class WorkbookValidation(BaseModel):
    submissionId: str | None = None
    company: str
    period: str
    version: int = 1
    originalWorkbook: dict[str, Any] | None = None
    fileName: str | None = None
    fileBase64: str | None = None


class ScopedInsights(BaseModel):
    cycle: dict[str, Any]
    scope: dict[str, str]


class ScopedReport(BaseModel):
    cycle: dict[str, Any]
    insightFile: dict[str, Any]


class DatabaseWrite(BaseModel):
    revision: int
    records: dict[str, Any]


class ExplainValidation(BaseModel):
    consent: bool
    company: str
    period: str
    validation: dict[str, Any]


def documented(model):
    return {"requestBody": {"required": True, "content": {"application/json": {"schema": model.model_json_schema()}}}}
