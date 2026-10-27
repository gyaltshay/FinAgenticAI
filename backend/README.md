# FastAPI backend

FastAPI serves the existing React API contracts on `127.0.0.1:3001`. PostgreSQL and MinIO use the existing private configuration, database schema, buckets, object keys and receipt signing key. Starting this backend never creates, migrates, clears or reseeds a database and never modifies stored originals.

## Install

From the repository root on Windows:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
```

On Linux/macOS use `python3 -m venv backend/.venv` and `backend/.venv/bin/python -m pip install -r backend/requirements.lock.txt`. Node.js is still required for the React toolchain and the existing shared financial contracts. The original standard-library validator remains in `frontend/server/validate_ttpl_workbook.py`; FastAPI imports and calls it directly.

Use `requirements.txt` to resolve compatible dependencies if updating the tested lock deliberately. Keep the virtual environment out of Git.

## Run

Start the existing PostgreSQL and MinIO Docker services. From `frontend/`:

```powershell
npm run api
npm run dev
```

`npm run gemini` is retained as an alias for the FastAPI launcher. The website stays at `http://127.0.0.1:5173`; API documentation is at `http://127.0.0.1:3001/docs`. The new `GET /api/health` identifies the backend; existing `/api/gemini/health` keeps its previous response contract.

The same private files are read: `frontend/.env.local` for Gemini, `.env.database.local` for PostgreSQL and `.env.storage.local` for MinIO. Environment variables override file values. No keys or passwords are copied into frontend builds. Optional `.env.backend.local` may set `FINAGENTIC_API_PORT` and `NODE_EXECUTABLE`. `FINAGENTIC_PYTHON` can select another Python executable for the npm launcher. `GEMINI_PORT` is supported for existing test scripts.

## Migration boundaries

- HTTP routing, origin checks, request limits, error responses and OpenAPI: FastAPI.
- Workbook uploads, integrity checks and original downloads: native Python/boto3.
- PostgreSQL reads, optimistic revision checks, immutable original references and transactional writes: native Python/psycopg using the existing schema.
- Workbook validation: direct call to the existing Python validator, with unchanged rules and JSON Schema.
- Gemini calls, consent checks, retries and prompts: Python/httpx.
- Scoped financial calculations, evidence validation, snapshot signatures, report composition and the metadata projection: the exact existing JavaScript modules, called through `finance_worker.mjs` over stdin/stdout. The worker is not an HTTP server and receives no database/S3/Gemini credentials. Retaining these shared routines avoids changing financial outputs or invalidating saved insight files during the API migration. A later pure-Python port would require separate parity tests.

Authentication, agent orchestration, report approvals and storage scope are unchanged by this migration. It does not add production authentication, LangGraph, Temporal or shared agent-result persistence.

## Verify

From the root:

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
```

The frontend browser scripts use FastAPI and use isolated ports/databases and synthetic workbooks. Run `node tests/storage-browser.mjs`, `node tests/database-browser.mjs` and `node tests/scoped-browser.mjs` from `frontend/`. Keep tests isolated; never point a temporary-database cleanup routine at the real application database.

`npm run database:setup` calls `python -m backend.manage setup`. It creates the dedicated role/database only when absent and applies the existing schema without deleting records. Database QA adapters are restricted to disposable `finagenticai_check_*` databases.
