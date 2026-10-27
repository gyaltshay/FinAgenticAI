# FinAgenticAI

Prototype for an Agentic AI System for Automated Financial Reporting and Insights.

## Project folders

- frontend: React user interface.
- backend: FastAPI API, direct Python validation, Python PostgreSQL/S3 clients, Gemini integration, and a compatibility worker for the existing shared financial contracts.
- frontend/server: Shared financial/reporting routines, the active workbook validator, and the database schema used by FastAPI.
- data: Local sample financial reports.
- docs: Project requirements and documentation.

## Prototype workflow

Company upload -> Versioned validation -> All-company readiness -> Consolidation -> Analysis -> Final management report -> DHI approval and publication -> Company-specific approved results.

Original workbooks are stored in MinIO before deterministic Python validation. PostgreSQL stores user profiles, companies, reporting periods, submission metadata, validation status, and original-workbook references. Detailed financial/agent results and approval/publication results remain browser-local. Gemini produces evidence-checked insights and optional finding explanations; it cannot decide validation status.

Once all required company submissions pass validation and cycle processing finishes, an open admin workspace automatically prepares insights and draft reports for each company, sector and group in sequence. Scope selection opens saved results; manual regeneration stays available. Failures pause the queue with a retry action, and saved results are reused after refresh. Approval and publication remain explicit admin actions. This prototype runs the queue in the admin browser; it is not a server background job.

## Current status

The two-role frontend, FastAPI backend, versioned workbook storage, and PostgreSQL metadata persistence are implemented. Both storage services run in Docker with persistent volumes. FastAPI serves the API contracts and preserves the existing financial calculations. The retired Node.js HTTP server and duplicate storage/database adapters have been removed. The application still uses prototype authentication and browser-based cycle orchestration. LangGraph/Temporal integration, Superset dashboards, and shared agent-result persistence remain pending.

See [backend setup](backend/README.md), [frontend setup](frontend/README.md), [MinIO setup](docs/LOCAL_STORAGE_SETUP.md), and [PostgreSQL setup](docs/POSTGRESQL_SETUP.md). Teammates need their own Python environment, private environment files and MinIO license; credentials, licenses, Docker volume data, and local downloads are excluded from Git. GitHub Pages serves the frontend only; the local backend and Docker services must run separately.
