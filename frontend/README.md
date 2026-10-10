# FinAgenticAI frontend

React/Vite frontend with the revised two-role financial-reporting workflow. Financial data and AI output are predefined fixtures. Excel validation and downstream processing are simulated; files are not read or uploaded.

## Run

```powershell
cd D:\FinAgenticAI\frontend
npm.cmd install
npm.cmd run dev
```

Open the printed local URL. Choose DHI Finance Officer/Admin or Company Finance Officer, use the selected demo account email, and enter any non-empty test password. Deactivated demo users cannot sign in.

## Workflow

Company users: dashboard → upload Excel → immediate simulated validation → correct/re-upload if needed → wait for all required companies → wait for DHI approval → view only their own approved results.

DHI Finance/Admin: monitor submissions → inspect readiness blockers → automatic processing once all required latest versions are valid → view analysis/insights → review the final management report → approve and publish together, or request revision and regenerate.

Every correction creates a new version. Final approval records exact included submission versions, approver and approval time. Older approved snapshots remain accessible as history. New versions require fresh approval.

Company and user administration support add/edit/activation. Reporting-period administration supports opening date, deadline and Open/Closed state. Company requirements and assignments freeze at first opening.

To prepare a complete cycle, sign in as Admin, open Consolidation Readiness, and choose Prepare reporting cycle. This existing control still creates successful mock versions for outstanding companies and shows simulated processing stages; it does not validate real files. Its label has changed, not its behavior.

## Presentation

The interface uses a compact blue, graphite, and gold design with a light sidebar, tabular status strips, consistent line icons, and a restrained reporting layout. Prototype labels and decorative headings/footers have been removed from the working screens. Source fixtures, state transitions, access rules, persistence, and all controls remain unchanged. `src/product.css` and `src/components/productText.js` provide presentation styles and display wording only.

Company users cannot access Admin pages or financial results before approval. The backend must enforce real authentication, confidentiality and transaction rules later; see `INTEGRATION.md`.

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

The revised workspace migrates available records from the earlier demo without deleting its storage key. It cannot restore earlier revisions that the old demo had overwritten. No backend/AI integration has been enabled.
