# FinAgenticAI frontend

React/Vite frontend with the two-role financial-reporting workflow. Company uploads are parsed locally by the deterministic Python TTPL workbook validator. Gemini receives only validation findings and cell references for an advisory explanation, and only after per-upload consent. Consolidation and report-generation stages remain prototype workflow simulations.

## Run

```powershell
cd D:\FinAgenticAI\frontend
npm.cmd install
npm.cmd run dev
```

Open the printed local URL. Choose DHI Finance Officer/Admin or Company Finance Officer, use the selected demo account email, and enter any non-empty test password. Deactivated demo users cannot sign in.

## Workflow

Company users: dashboard → upload `.xlsx` → deterministic workbook validation → finance review or correction when findings require it → wait for all required submissions → wait for DHI approval → view only their own approved results.

DHI Finance/Admin: monitor submissions → inspect readiness blockers → automatic processing once all required latest versions are valid → view analysis/insights → review the final management report → approve and publish together, or request revision and regenerate.

Every correction creates a new version. Final approval records exact included submission versions, approver and approval time. Older approved snapshots remain accessible as history. New versions require fresh approval.

Company and user administration support add/edit/activation. Reporting-period administration supports opening date, deadline and Open/Closed state. Company requirements and assignments freeze at first opening.

Legacy demo records migrate as pending and cannot make a reporting cycle ready. The consolidation and report-generation stages are still browser-local prototype workflows.

## Presentation

The interface uses a charcoal navigation rail, cool white reporting surfaces, one self-hosted Inter font, and a continuous sector-grouped monitoring ledger. The header shows DHI's logo for the administrator and the corresponding company logo for finance officers. Statuses use clock, check, error, shield, and progress symbols rather than colored-dot rectangles. Prototype labels and decorative headings/footers have been removed from working screens. Source fixtures, state transitions, access rules, persistence, and all controls remain unchanged. `src/interface.css` and the shared status/header components provide presentation only. The Inter font license is included beside its font asset.

Company users cannot access Admin pages or financial results before approval in this browser-based demo. Production deployment still needs server-side authentication, authorization, and secure report storage.

## GitHub Pages

The live demo is https://gyaltshay.github.io/FinAgenticAI/ . GitHub Pages serves the prepared static files at the repository root. Source code remains in `frontend/`.

After changing the frontend, run `npm.cmd run build:pages` from `frontend/`, then commit and push the updated source and generated root files. The script builds for the `/FinAgenticAI/` URL and copies the HTML, assets, and logos to the site root. Local `npm.cmd run dev` still uses the normal `/` path.

## Checks

```powershell
npm.cmd test
npm.cmd run build
```

`tests/cycle.test.mjs` checks readiness, frozen period membership, version-specific approvals, corrections, stale drafts, publication scope and submission-window rules. Existing fixture/calculation tests remain in `tests/workflow.test.mjs`.

`tests/browser-smoke.mjs` tests the revised end-to-end UI, role guards, management forms, rejection/regeneration, automatic publication, historical approvals, persistence and mobile navigation. It uses host-specific bundled Playwright and Microsoft Edge paths; update these paths on another machine.

## Structure

- `src/App.jsx`: existing visual shell with revised role-specific navigation.
- `src/pages/CyclePages.jsx`: reporting workflow and approval screens.
- `src/pages/AdministrationPages.jsx`: companies, users, and reporting periods.
- `src/services/cycle.js`: the revised domain rules.
- `src/hooks/useReportingCycle.js`: browser-local persistence and simulation adapter.
- `src/hooks/auth.js`: mock auth context and route permissions.
- `src/services/api.js`: future FastAPI HTTP adapter, currently unused.
- `public/logos/`: retained DHI and company logos.

The revised workspace migrates available records from the earlier demo without deleting its storage key. Legacy fixture statuses are reset to pending because they are not real validation results. The local upload validator is connected; authentication and durable report storage remain browser-local.


## Gemini insights (local development)

The Analysis & Insights page can request a financial summary from Gemini. The API key stays in this local backend and is never exposed to Vite client code. Each request sends the selected period, analysis scope, and aggregate metrics to Google Gemini. On report upload, Python validates the workbook locally. With consent, the server sends deterministic findings and relevant cell references—not the workbook—to Gemini for plain-language explanation. Gemini does not decide validation status, normalize monetary values, or run arithmetic rules. The upload validator supports `.xlsx` only.

1. Ensure Python 3 is on PATH as `python` (or set `PYTHON_EXECUTABLE`). Copy .env.example to .env.local in the frontend directory and set GEMINI_API_KEY. Never prefix the key with VITE_.
2. In one terminal, run npm.cmd run gemini from frontend/.
3. In another terminal, run npm.cmd run dev from frontend/.
4. Open Analysis & Insights and choose Generate with Gemini, or consent when uploading an `.xlsx` report.

GitHub Pages is static and cannot run this local API server. A hosted backend with a server-side key is required to enable Gemini on the live Pages site.


## Reporting agent (local prototype)

Start `npm run gemini` and `npm run dev` in separate terminals in this directory. Reporting itself requires no API key and makes no external model calls. Sign in as DHI Finance/Admin and open **Management Reports**.

1. Select the latest passed TTPL submission. For NEEDS_REVIEW, finance must first accept its exceptions with a reason; FAIL/ERROR are blocked.
2. Confirm the underlying currency and source scale, then tick the confirmation box. Do not infer scale from the workbook heading alone.
3. Download the financial input for your teammate. The insights producer returns the structure in `../.agents/skills/reporting-agent/schemas/insights.schema.json`, with matching scope, period, signature and valid evidence references.
4. Import that insights JSON and generate the management draft. Without insights, generation remains available as a partial financial draft.
5. Review the sections and evidence, download JSON or Markdown, or use Print / Save PDF. Draft history is browser-local (30 most recent). New financial versions, changed scale/currency, or changed insights make old drafts stale. This panel does not approve or publish drafts and does not change the existing group-report review controls.

Implementation: `server/reporting.mjs`; contracts and skill: `../.agents/skills/reporting-agent/`; representative TTPL input: `tests/fixtures/reporting-input.json`. The server supports monthly, quarterly, YTD and point-in-time records through its contract; the current UI adapter extracts monthly revenue, expenses, reported profit and headcount plus available comparisons from TTPL's `Month Financials` evidence. Other layouts need explicit mapping. It does not build a full balance sheet, forecasts or intercompany consolidation from missing data. Source amounts are preserved, and absolute comparisons use exact decimal subtraction; ratios and stakeholder-unconfirmed KPI definitions are not guessed.

API: `POST /api/reporting/generate` with the input-schema body; returns `{report, markdown}`. Invalid requests return 422. Structured insights are treated as upstream evidence-linked analysis: schema validation cannot prove their prose is factually correct. The engine uses deterministic report composition, not a second LLM narrative call. This makes it usable while the insights agent is developed independently.

Checks: `npm test`; `node tests/reporting-browser.mjs` with both local servers running. The browser script uses the same workstation Playwright/Edge setup as the existing browser tests and isolated browser storage. GitHub Pages cannot execute this API.


## Restored consolidation frontend and workflow review

Consolidation Readiness is restored in the Admin sidebar (`#readiness`; `#consolidation` is an alias), including the original blocker table, stage list and confirmed Prepare reporting cycle action. Preparation creates browser-only sample submission versions tagged `frontendFixture`; previous versions remain in history. These records survive reload and can drive the simulated group approval flow, but have no fabricated workbook-validation result. Live insights are disabled for scopes containing samples, and the reporting agent only accepts real passed/reviewed validations. Preparation requires an already opened period. No backend consolidation agent or external notification delivery was added.

Workbook summary mappings now prefer Month Financials evidence so repeated PPR/expense totals do not erase the mapped results. Header detection follows the nearest table heading through long sheets and distinguishes dated current, prior-month and prior-year Actuals columns. Source discrepancies still require correction or finance review; this does not certify the original TTPL report as valid. The original August workbook exposes a missing PPR actual at C39 and ambiguous units; neither is silently repaired.

Company insights now identify the company submission ID, can be downloaded as JSON, and can be imported directly into Reporting Agent. The adapter validates native evidence against the selected submission and converts it into the reporting handoff contract. Existing canonical insights JSON remains accepted. Synthetic provider output is used only in automated tests, not inserted into live data.

Workbook validation runs locally without requiring an external model. Users explicitly opt in to send findings to Gemini for explanation. Without that choice, no explanation request is sent. Reset workspace also clears browser-local reporting drafts.

Additional checks: `python -m unittest discover -s tests -p test_ttpl_validation.py` and `node tests/workspace-review.mjs`. The latter starts isolated test servers on ports 5180/3010, uses a separate browser context, tests both roles and live local Python/reporting endpoints, and explicitly mocks the Gemini provider. It covers CRUD, period gates, prepared consolidation, corrections, review, approval, persistence, native insights import and mobile overflow. It does not claim to verify Google Gemini access or Superset embedding.
