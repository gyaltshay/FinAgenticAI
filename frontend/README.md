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
