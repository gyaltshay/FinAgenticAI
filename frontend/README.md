# FinAgenticAI prototype

React/Vite frontend with a FastAPI backend, local Python workbook validation, Gemini insights, frontend consolidation and evidence-linked reporting.

## Run locally

1. Install Node.js and Python 3; run `npm install` in `frontend/`. Create the backend Python environment using [backend setup](../backend/README.md).
2. Copy `.env.example` to `.env.local`, set your own `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.1-flash-lite`. Never use a `VITE_` prefix for the key. `.env.local` is ignored by Git.
3. Set up/start local MinIO using [Local storage setup](../docs/LOCAL_STORAGE_SETUP.md) and PostgreSQL using [Database setup](../docs/POSTGRESQL_SETUP.md). Original workbook uploads require the upload bucket; PostgreSQL stores administrative records and submission references.
4. Run `npm run api` in one terminal (FastAPI on port 3001; `npm run gemini` remains a compatible alias).
5. Run `npm run dev` in another terminal (frontend port 5173).

Select an active role/account and enter a nonempty prototype password. Authentication remains a frontend prototype. User profiles, companies, periods and submission metadata synchronize with PostgreSQL; agent results remain browser-local. The local API is not a production authorization boundary.

## Upload to report workflow

1. Company officers upload `.xlsx` files under an open period. The backend saves the exact original in MinIO with a unique object for every submission version, then Python checks those stored bytes and records source evidence. **Download original** is available in history and validation details. Gemini explanations are optional via an explicit checkbox. Failures need correction. Review findings need a finance review and reason. Originals remain stored even when validation fails.
2. Admin monitors submissions. Required companies and sector/group assignments freeze when the period opens; currently the August cycle has 23 required companies.
3. In **Consolidation Readiness**, the original **Prepare reporting cycle** control can complete blocking companies using marked sample versions. Prior versions remain in history. This is frontend preparation, not actual workbook validation or statutory consolidation.
4. All required latest versions must be ready, and processing must finish, before **Analysis & Insights** or **Management Reports** becomes available. A new correction closes this access until reprocessing.
5. Select **Company**, **Sector** or **Group**, then the entity. Generate insights. They are saved for direct report generation; **Download insights JSON** remains available. Gemini receives selected aggregate metrics and source IDs; prepared data is identified explicitly. The file contains scope, entity, period, snapshot, submission versions, sources, data origin and insights.
6. Open **Management Reports**, select **Report scope** and **Report entity**, then **Generate report**. Matching saved insights are used automatically. **Import insights JSON** remains an optional alternative. Figures come from the same completed snapshot; metadata/evidence mismatches and stale files are rejected. No JSON transfer or financial workbook re-upload is required for direct generation.
7. Review the report and download JSON/Markdown or Print/Save PDF. Drafts and approved versions persist in the workspace. Admin reviews the draft and chooses **Approve report → Confirm approval**. A revision request requires a reason. Outdated or superseded drafts cannot be approved; the old single-company generation route is retired.

Management Reports is the only report-generation and approval screen. Only confirmed approval publishes to company dashboards and Approved Results. Company reports release to that company; sector/group reports release own-company financial views to their frozen member companies. Full aggregate reports remain Admin-only. Company tabs synchronize approvals without requiring a manual refresh. Existing approved history stays available after a correction; the new version requires fresh processing, insights, generation and approval.

## Important limits

- Sample records and real validations remain distinguishable. All scopes can run on the prepared prototype cycle.
- Aggregation is a frontend reporting aid without intercompany eliminations or statutory accounting adjustments.
- Scope financial amounts are normalized to base BTN units from stored snapshots. Exact decimal addition is used for totals; descriptive ratios are deterministic.
- Unknown financial values remain unavailable. The original August workbook still needs source review/correction (including the flagged PPR actual and currency/scale issues). Files are not silently repaired.
- Superset dashboard slots remain placeholders. External notification delivery and backend authentication are not implemented. Raw workbooks persist in MinIO. PostgreSQL stores user profiles, companies, reporting periods and submission metadata/references; financial values and agent/approval results remain browser-local. Resetting browser records does not delete stored originals or database history.
- GitHub Pages hosts only static files and cannot run Python or the Gemini/reporting API. Teammates need local setup or a separately hosted backend.

## Contracts and code

- `../.agents/skills/reporting-agent/SKILL.md`: reporting instructions.
- `../.agents/skills/reporting-agent/schemas/scoped-insights-file.schema.json`: downloaded/uploaded JSON contract.
- `shared/scopedReports.mjs`: scope selection, aggregation, signatures, evidence and import checks.
- `src/services/completedCycle.js`: all-company and processing gate.
- `src/pages/ScopedInsightsPage.jsx`: scoped generation and download.
- `src/components/ReportingAgentPanel.jsx`: scope selection, direct generation, optional JSON import, review and approval.
- `src/services/managementReports.js`: versioning, approval gates and company-specific publication.
- `src/services/scopedInsightStore.js`: matching saved insights for direct generation.
- `server/reporting.mjs`: deterministic report composition and exports.
- `../backend/app.py`: FastAPI routes with the existing validation, storage, database, insight and reporting contracts; interactive documentation at `/docs`.
- `server/validate_ttpl_workbook.py`: deterministic workbook parsing/checks.
- `../backend/storage.py`: native Python MinIO uploads, unique version keys, compatible signed receipts and integrity checks.
- `../backend/database.py` and `server/migrations/001-core.sql`: native PostgreSQL metadata operations using the unchanged schema and transaction/revision rules.
- `shared/database-records.mjs`: explicit metadata projection that excludes all agent results.

The service exposes `POST /api/scoped/insights` (`{cycle,scope}`) and `POST /api/scoped/report` (`{cycle,insightFile}`). Legacy single-company insight/report routes return 409. `FINAGENTIC_API_PORT` or legacy `GEMINI_PORT` selects the API port; `FINAGENTIC_API_URL` sets the Vite development proxy. `GEMINI_API_BASE_URL` optionally selects a trusted model endpoint, used by isolated tests. Its default is Google's Gemini API. Node.js is still used for the exact shared financial contracts through a non-HTTP compatibility worker; the Python validator is called directly.

## Verification and publishing

- `npm test`: calculation, state, contract, evidence and workflow tests.
- From the repository root, `backend/.venv/Scripts/python.exe -m pytest backend/tests -q`: FastAPI contracts, direct-validator parity, storage integrity and Gemini error/retry tests.
- `python -m unittest discover -s tests -p test_ttpl_validation.py`: workbook-validation checks.
- `node tests/scoped-browser.mjs`: isolated browser/API test for all three scopes, stale files, corrections, persistence, mobile and print. It uses a local provider fixture, not real Gemini calls.
- `node tests/workspace-review.mjs`: roles, administration, validation, original readiness controls.
- `node tests/storage-browser.mjs`: live local MinIO and isolated browser/API checks for upload, correction, stored-byte validation, original download, restart persistence and storage failure. Requires running MinIO; creates and removes only synthetic test workbooks.
- `node tests/database-browser.mjs`: live PostgreSQL/MinIO browser test using only its own temporary database and synthetic workbook. Checks metadata persistence, rollback, conflicting saves, and original download in another browser.
- Browser scripts currently use this workstation's bundled Playwright and Edge paths, consistent with the existing QA scripts.
- Browser/API scripts use FastAPI. Native database QA helpers are restricted to disposable test databases.
- `npm run build`: standard Vite build.
- `npm run build:pages`: rebuild static root assets for GitHub Pages at `/FinAgenticAI/`.

Keep API keys and generated dependency/cache folders out of commits.
