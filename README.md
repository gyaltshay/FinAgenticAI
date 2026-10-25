# FinAgenticAI

Prototype for an Agentic AI System for Automated Financial Reporting and Insights.

## Project folders

- frontend: React user interface.
- frontend/server: Current Node.js API, Python workbook validation, financial calculations, insights/report generation, and PostgreSQL/MinIO adapters.
- data: Local sample financial reports.
- docs: Project requirements and documentation.

## Prototype workflow

Company upload -> Versioned validation -> All-company readiness -> Consolidation -> Analysis -> Final management report -> DHI approval and publication -> Company-specific approved results.

Original workbooks are stored in MinIO before deterministic Python validation. PostgreSQL stores user profiles, companies, reporting periods, submission metadata, validation status, and original-workbook references. Detailed financial/agent results and approval/publication results remain browser-local. Gemini produces evidence-checked insights and optional finding explanations; it cannot decide validation status.

## Current status

The two-role frontend, versioned workbook storage, and PostgreSQL metadata persistence are implemented. Both storage services run in Docker with persistent volumes. The application still uses prototype authentication and browser-based cycle orchestration. Migration to FastAPI, LangGraph/Temporal integration, Superset dashboards, and shared agent-result persistence remain pending.

See [frontend setup](frontend/README.md), [MinIO setup](docs/LOCAL_STORAGE_SETUP.md), and [PostgreSQL setup](docs/POSTGRESQL_SETUP.md). Teammates need their own private environment files and MinIO license; credentials, licenses, Docker volume data, and local downloads are excluded from Git. GitHub Pages serves the frontend only; the local backend and Docker services must run separately.
