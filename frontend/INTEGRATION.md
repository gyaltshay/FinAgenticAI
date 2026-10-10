# Revised frontend integration contract

This frontend implements the agreed two-role monthly reporting workflow using local demo records. No backend, database, AI service, storage service, or external notifications are connected. Existing styling, branding, TTPL reference fixtures, and local logo assets are retained.

## Authoritative frontend modules

- `src/services/cycle.js`: versioned submissions, period membership, global readiness, processing stages, immutable final-report snapshots, approval and company publication.
- `src/hooks/useReportingCycle.js`: local persistence and simulated asynchronous validation/processing. Replace this adapter with server requests and polling/event updates when APIs exist.
- `src/hooks/auth.js`: two-role mock authentication context and route permissions.
- `src/pages/CyclePages.jsx`: company/admin dashboards, monitoring, readiness, version history, validation, approved results, analysis, management review and notifications.
- `src/pages/AdministrationPages.jsx`: company/sector/group assignments, users, period configuration.
- `src/pages/FinancePages.jsx`: the existing reusable company insight view is used for approved snapshots. Its older consolidation/management components are not routed in the revised application.
- `src/services/reports.js`: existing fixture generation, metric formatting inputs and exports; its legacy v2 uploader is not the revised submission workflow.
- `src/services/api.js`: unused future HTTP adapter with placeholder contracts below.

## Business invariants

1. Every upload creates a new submission ID and incremented company/period version. Earlier versions remain in history.
2. Validation (`Pending`, `Validating`, `Passed`, `Failed`), period processing, and final approval are distinct.
3. Every required company's latest version must pass validation before processing starts. The same gate applies to company, sector, group and whole-DHI analysis.
4. Required company IDs and sector/group assignments freeze on the period's first opening. Reopening preserves them. Company deactivation affects future periods; existing obligations and approved history remain intact. User deactivation blocks that user's demo login.
5. Completed processing produces a final management-report version with exact input signatures and frozen company snapshots.
6. Only DHI Finance/Admin can approve or request revision. Rejection requires remarks; approval requires confirmation.
7. Approval records the approver/time and publishes included company snapshots in the same action. There is no separate Publish operation.
8. A new correction invalidates a pending draft and triggers fresh processing after global readiness is restored. It never inherits an older approval.
9. Company users see no financial analysis until an approved snapshot exists for their own submission version. Older approved snapshots remain available as labelled history.
10. Opening dates and Open/Closed status control submissions. The deadline is displayed for monitoring; late submission remains possible while a period is explicitly Open.

## State models

Workspace: `companies`, `users`, `reports`, `periods`, `currentPeriod`, `cycles`, `finalReports`, `notifications`, `audit`.

Submission: `id`, `company`, `period`, `revision`, `file`, `date`, `submittedAt`, `validationStatus`, `issues`, `data` and uploaded-by metadata. Financial fields are predefined fixtures in this demo.

Period: `id`, `period`, `openDate`, `deadline`, `state`, `requiredCompanyIds`, frozen `assignments`, `frozenAt`.

Processing: Waiting → Data standardization → Sector consolidation → Group consolidation → Whole-DHI consolidation → KPI calculation → Anomaly detection → AI insight generation → Management report generation → Awaiting approval.

Final report: `id`, `periodId`, `period`, `version`, `status`, `signature`, immutable `companySnapshots`, aggregate `data`, `summary`, `generatedAt`, optional revision remarks, `approver`, `approvedAt`.

Final states: Pending Approval, Revision Required, Approved, Superseded. Approved is also the publication state. Old approved versions remain unchanged.

Notifications include audience, company scope, reporting period, timestamp and per-user read markers.

## Proposed FastAPI contracts

| Endpoint | Purpose |
|---|---|
| POST `/auth/login`, GET `/auth/me`, POST `/auth/logout` | Real authentication, identity and authorized scope |
| GET/POST `/companies`, PUT `/companies/{id}` | Company, sector/group, activation and logo master data |
| GET/POST `/users`, PUT `/users/{id}` | User identities, two roles and activation |
| GET/POST `/periods`, PUT `/periods/{id}` | Submission windows and frozen required membership |
| GET/POST `/reports`, GET `/reports/{id}` | Versioned submissions; POST uses multipart Excel and period/company IDs |
| GET `/periods/{id}/readiness` | Required/latest valid versions and blocking companies |
| GET `/periods/{id}/processing` | Controlled stage/job states |
| GET `/consolidation?period=...` | Ready, processed snapshots with company/sector/group/whole-DHI scopes |
| GET `/periods/{id}/management-reports` | Final report versions and their input manifests |
| POST `/management-reports/{id}/regenerate` | Revise/regenerate from current valid versions |
| POST `/management-reports/{id}/review` | Reject with remarks, or atomically approve and publish |
| GET `/me/approved-results` | Only the authenticated company's approved immutable snapshots |
| GET `/notifications`, POST `/notifications/{id}/read` | Scoped updates and read state |
| POST `/reminders` | Authorized reminder request |
| GET `/audit` | Durable authorized audit history |

Backend approval must verify the latest version signature inside a transaction and prevent stale/concurrent approval. Scope and permissions must be enforced on the server, not trusted from the selected frontend role. The company result endpoint must never return other companies' data or unapproved results.

Upload handlers must store originals in MinIO, normalize validated records into PostgreSQL, and return version IDs. LangGraph/Qwen can replace simulated processing and prewritten narrative content; operational scheduling can use Temporal. Superset integration remains deferred. Production consolidation needs agreed accounting mappings, ownership adjustments, eliminations and reconciliation checks. The demo only sums fixtures.

## Local storage and migration

The revised workspace uses `finagenticai.workspace.v3`. Available v2 submission records are migrated without deleting the old v2 key. Legacy drafts are retained but cannot be treated as valid approvals under the new rules. Previously overwritten v2 submission revisions cannot be reconstructed.

The demo session stores only a user ID under `finagenticai.session.v3`. Passwords and financial-file contents are not persisted. Company metadata and demo users are local fixtures. Approval/processing state survives refresh; interrupted processing restarts from the latest valid manifest, and interrupted validation requires resubmission.

## Demo and branding

The readiness page has an explicitly labelled, confirmed demo control to create successful fixture versions for outstanding companies. This avoids uploading 23 files to demonstrate the cycle. It operates only on an opened period and is not a production validation bypass.

New uploads accept `.xlsx` and `.xls`; PDF is a future-support placeholder, as requested in the revised specification. Historical PDF metadata from the earlier demo can remain in history.

Official logos are local assets. Company sectors/ownership follow the supplied reference and need reporting-date verification. WCCL remains a historical entry and the undefined digital-asset partnership remains outside reporting targets. TTPL August data is a reference fixture; other-company figures are synthetic, not actual financial results.
