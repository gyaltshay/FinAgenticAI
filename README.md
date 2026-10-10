# FinAgenticAI

Prototype for an Agentic AI System for Automated Financial Reporting and Insights.

## Project folders

- frontend: React user interface.
- backend: FastAPI, extraction, validation, KPI calculations, and LangGraph/Qwen integration.
- data: Local sample financial reports.
- docs: Project requirements and documentation.

## Prototype workflow

Company upload -> Versioned validation -> All-company readiness -> Consolidation -> Analysis -> Final management report -> DHI approval and publication -> Company-specific approved results.

The initial frontend uses mock data, with login, dashboard, upload, validation results, financial insights, and report history. Backend integration follows later.

## Current status

The revised two-role frontend is implemented in `frontend/`, with submission version history, all-company readiness, automatic demo processing, DHI review and approval/publication, and company-specific approved results. Company/user/period management, notifications, audit history, official local logos, and responsive styling are retained. See `frontend/README.md` for demo steps and `frontend/INTEGRATION.md` for future backend contracts. Backend and AI services are not connected.
