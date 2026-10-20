# FinAgenticAI

Prototype for an Agentic AI System for Automated Financial Reporting and Insights.

## Project folders

- frontend: React user interface.
- backend: FastAPI, extraction, validation, KPI calculations, and LangGraph/Qwen integration.
- data: Local sample financial reports.
- docs: Project requirements and documentation.

## Prototype workflow

Company upload -> Versioned validation -> All-company readiness -> Consolidation -> Analysis -> Final management report -> DHI approval and publication -> Company-specific approved results.

The frontend keeps browser-local accounts and demo reporting-cycle stages. Company workbook uploads use the local Gemini API server to run deterministic Python validation; Gemini can explain findings but cannot decide validation status.

## Current status

The revised two-role frontend is implemented in `frontend/`, with submission version history, all-company readiness, browser-local processing stages, DHI review and approval/publication, and company-specific approved results. Company/user/period management, notifications, audit history, official local logos, and responsive styling are retained. The local upload validator runs deterministic workbook checks and returns the configured JSON Schema result; Gemini only explains findings after consent. See `frontend/README.md` for local setup and `frontend/INTEGRATION.md` for future backend contracts.
