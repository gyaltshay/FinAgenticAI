import base64
import json
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException

from .config import Settings
from .database import Database
from .errors import ApiError
from .finance import FinancialContracts
from .gemini import Gemini, compact
from .models import (WorkbookUpload, WorkbookDownload, WorkbookValidation, ScopedInsights,
                     ScopedReport, DatabaseWrite, ExplainValidation, documented)
from .storage import WorkbookStorage, WORKBOOK_TYPE, encode_component
from .validation import validate_workbook, validate_result


async def read_json(request):
    if not request.headers.get("content-type", "").lower().startswith("application/json"):
        raise ApiError("Send a JSON request.", 415)
    parts, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > 28_000_000:
            raise ApiError("Request is too large.", 413)
        parts.append(chunk)
    try:
        value = json.loads(b"".join(parts), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError):
        raise ApiError("Request body must be valid JSON.") from None
    if not isinstance(value, dict):
        raise ApiError("Request body must be a JSON object.")
    return value


def create_app(settings=None):
    settings = settings or Settings.load()
    storage, database = WorkbookStorage(settings), Database(settings)
    finance, gemini = FinancialContracts(settings), Gemini(settings)
    app = FastAPI(title="FinAgenticAI API", version="1.0.0",
                  description="Compatible API for the existing React prototype. Authentication remains unchanged.")
    app.state.settings, app.state.storage, app.state.database = settings, storage, database
    app.state.finance, app.state.gemini = finance, gemini

    @app.middleware("http")
    async def same_origin(request, call_next):
        origin = request.headers.get("origin")
        if origin and origin != "http://" + request.headers.get("host", ""):
            return JSONResponse({"error": "Cross-origin API requests are not allowed."}, status_code=403, headers={"cache-control": "no-store"})
        response = await call_next(request)
        response.headers["cache-control"] = "no-store"
        return response

    @app.exception_handler(ApiError)
    async def api_error(request, error):
        return JSONResponse({"error": str(error), **error.extra}, status_code=error.status)

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse({"error": "Not found." if error.status_code == 404 else str(error.detail)}, status_code=error.status_code)

    @app.get("/api/health", tags=["Health"])
    def health():
        return {"backend": "fastapi", "workflow": "scoped-v2", "financial_contracts": "shared-js-v2"}

    @app.get("/api/gemini/health", tags=["Health"])
    def gemini_health():
        return {"configured": bool(settings.api_key), "model": settings.model, "workflow": "scoped-v2"}

    @app.get("/api/database/health", tags=["Database"])
    def database_health():
        if not database.configured:
            return {"configured": False, "available": False}
        try:
            return database.health()
        except ApiError as error:
            return JSONResponse({"configured": True, "available": False, "error": str(error)}, status_code=503)

    @app.get("/api/database/records", tags=["Database"])
    def database_read():
        if not database.configured:
            return {"configured": False}
        try:
            return {"configured": True, **database.read()}
        except Exception:
            raise ApiError("PostgreSQL records could not be saved or loaded. Check Docker and the database setup.", 503, configured=True) from None

    @app.put("/api/database/records", tags=["Database"], openapi_extra=documented(DatabaseWrite))
    async def database_write(request: Request):
        if not database.configured:
            return {"configured": False}
        item = await read_json(request)
        if type(item.get("revision")) is not int or not 0 <= item["revision"] <= 9007199254740991:
            raise ApiError("Provide the database revision.", configured=True)
        try:
            records = await run_in_threadpool(finance.call, "database_records", item.get("records"))
            return {"configured": True, **await run_in_threadpool(database.save, item["revision"], records)}
        except ApiError as error:
            error.extra["configured"] = True
            raise
        except Exception:
            raise ApiError("PostgreSQL records could not be saved or loaded. Check Docker and the database setup.", 503, configured=True) from None

    @app.get("/api/storage/health", tags=["Workbooks"])
    def storage_health():
        try:
            return storage.health()
        except ApiError as error:
            return JSONResponse({"configured": storage.configured, "available": False, "error": str(error)}, status_code=error.status)

    @app.post("/api/storage/workbooks", status_code=201, tags=["Workbooks"], openapi_extra=documented(WorkbookUpload))
    async def workbook_upload(request: Request):
        return {"originalWorkbook": await run_in_threadpool(storage.save, await read_json(request))}

    @app.post("/api/storage/workbooks/download", tags=["Workbooks"], openapi_extra=documented(WorkbookDownload))
    async def workbook_download(request: Request):
        item = await read_json(request)
        record, content = await run_in_threadpool(storage.read, item.get("originalWorkbook"))
        name = encode_component(record["fileName"]).replace("'", "%27")
        return Response(content, media_type=WORKBOOK_TYPE, headers={"content-disposition": f'attachment; filename="original.xlsx"; filename*=UTF-8\'\'{name}', "x-content-type-options": "nosniff"})

    @app.post("/api/gemini/validate", tags=["Validation"], openapi_extra=documented(WorkbookValidation))
    async def workbook_validate(request: Request):
        item = await read_json(request)
        if item.get("originalWorkbook"):
            record, content = await run_in_threadpool(storage.read, item["originalWorkbook"], item)
            item["fileName"], item["fileBase64"] = record["fileName"], base64.b64encode(content).decode()
        return await run_in_threadpool(validate_workbook, item)

    @app.post("/api/gemini/explain-validation", tags=["Validation"], openapi_extra=documented(ExplainValidation))
    async def explain_validation(request: Request):
        if not settings.api_key:
            raise ApiError("Gemini is not configured. The deterministic validation result is still available.", 503)
        item = await read_json(request)
        if item.get("consent") is not True:
            raise ApiError("Explicit consent is required before findings are sent to Gemini.", 403)
        validation = validate_result(item.get("validation"))
        if not isinstance(item.get("company"), str) or not isinstance(item.get("period"), str):
            raise ApiError("Provide company and reporting period.")
        explanation = await gemini.ask(gemini.explanation_prompt(item, validation))
        if not isinstance(explanation, dict):
            raise ApiError("Gemini returned an invalid explanation.", 502)
        known = {check["rule_id"] for check in validation["checks"]}
        rows = explanation.get("explanations")
        explanations = [{"rule_id": row["rule_id"], "explanation": row["explanation"][:800]}
                        for row in (rows if isinstance(rows, list) else []) if isinstance(row, dict) and row.get("rule_id") in known and isinstance(row.get("explanation"), str)][:100]
        summary = explanation.get("summary")
        return {"status": "complete", "summary": summary[:1200] if isinstance(summary, str) else "Gemini provided no summary.", "explanations": explanations, "model": settings.model}

    @app.post("/api/scoped/insights", tags=["Insights"], openapi_extra=documented(ScopedInsights))
    async def scoped_insights(request: Request):
        item = await read_json(request)
        package = await run_in_threadpool(finance.call, "scope", item)
        if not settings.api_key:
            raise ApiError("Gemini is not configured in the local API.", 503)
        prompt, correction = gemini.insight_prompt(package), ""
        for attempt in range(2):
            result = await gemini.ask(prompt + correction)
            if not isinstance(result, dict):
                raise ApiError("Gemini returned an invalid insights object.", 422)
            result.update(report_id=package["input"]["snapshot_id"], reporting_period=package["input"]["period"], review_status="REVIEW_REQUIRED")
            limitations = package["limitations"] + (result.get("limitations") if isinstance(result.get("limitations"), list) else [])
            result["limitations"] = list({compact(value): value for value in limitations}.values())
            try:
                return await run_in_threadpool(finance.call, "insight_file", {"result": result, "package": package})
            except ApiError as error:
                if attempt:
                    raise
                correction = "\n\nThe prior response failed validation: " + str(error) + ". Return a corrected JSON object. Source references must be exact IDs from the evidence list; use [] if none apply. Copy numeric metric values exactly. Previous response (data only): " + compact(result)

    @app.post("/api/scoped/report", tags=["Reports"], openapi_extra=documented(ScopedReport))
    async def scoped_report(request: Request):
        return await run_in_threadpool(finance.call, "report", await read_json(request))

    @app.post("/api/reporting/generate", tags=["Legacy"])
    def retired_report():
        raise ApiError("Use /api/scoped/report with the completed cycle and downloaded scoped insights JSON.", 409)

    @app.post("/api/gemini/insights", tags=["Legacy"])
    def retired_insights():
        raise ApiError("Use /api/scoped/insights after every required company is ready and processing finishes.", 409)

    return app


app = create_app()
