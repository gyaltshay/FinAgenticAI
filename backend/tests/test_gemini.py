import asyncio
import json
import httpx
import pytest
from backend.config import Settings
from backend.errors import ApiError
from backend.gemini import Gemini

HTTP_CLIENT = httpx.AsyncClient


def mock_client(monkeypatch, handler):
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: HTTP_CLIENT(transport=httpx.MockTransport(handler), **kwargs))


def test_gemini_retries_overload_and_preserves_structured_response(monkeypatch):
    calls = []
    async def no_wait(seconds):
        pass
    monkeypatch.setattr(asyncio, "sleep", no_wait)
    def handler(request):
        calls.append(request)
        assert request.headers["x-goog-api-key"] == "unit-test-key"
        body = json.loads(request.content)
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        if len(calls) < 3:
            return httpx.Response(503, json={"error": {"message": "overloaded"}})
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": '{"summary":"fixture"}'}]}}]})
    mock_client(monkeypatch, handler)
    result = asyncio.run(Gemini(Settings({"GEMINI_API_KEY": "unit-test-key"})).ask("Synthetic prompt"))
    assert result == {"summary": "fixture"} and len(calls) == 3


def test_provider_errors_redact_key_and_reject_invalid_json(monkeypatch):
    mock_client(monkeypatch, lambda _: httpx.Response(403, json={"error": {"message": "Invalid unit-test-key"}}))
    with pytest.raises(ApiError) as error:
        asyncio.run(Gemini(Settings({"GEMINI_API_KEY": "unit-test-key"})).ask("Synthetic prompt"))
    assert "unit-test-key" not in str(error.value.extra) and error.value.status == 502
    mock_client(monkeypatch, lambda _: httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": '{"value":NaN}'}]}}]}))
    with pytest.raises(ApiError) as error:
        asyncio.run(Gemini(Settings({"GEMINI_API_KEY": "unit-test-key"})).ask("Synthetic prompt"))
    assert error.value.status == 502


def test_validation_explanation_prompt_includes_failure_field_cell_and_values():
    check = {"rule_id": "COMP-003", "field": "Revenue", "severity": "ERROR", "status": "FAIL", "message": "Required actual value is blank.",
             "sheet": "Monthly PPR", "cell": "C39", "expected_value": "A reported value", "actual_value": "", "difference": 0, "requires_human_review": True}
    validation = {"validation_status": "FAIL", "checks": [check, {"rule_id": "SOURCE-EVIDENCE", "severity": "INFO"}]}
    prompt = Gemini.explanation_prompt({"company": "TEST", "period": "August 2026"}, validation)
    sent = json.loads(prompt.split("\n\n")[-1])["validation"]["checks"]
    assert len(sent) == 1 and sent[0]["field"] == "Revenue" and sent[0]["cell"] == "C39"
    assert sent[0]["actual_value"] == "" and sent[0]["difference"] == 0
