# Scoped insights to reporting handoff

The normal workflow is: complete all required company validations and processing, choose Company/Sector/Group and entity in Analysis & Insights, generate insights, then select the same scope/entity in Management Reports for direct generation. JSON download/import is optional. Admin reviews and confirms approval to release results to company dashboards. There is no separate prepared-cycle review page. The internal completed-cycle snapshot supports scope selection, not an additional report-review screen.

## Contracts

- `schemas/scoped-insights-file.schema.json` defines the downloadable v2 envelope with scope, entity, period, snapshot ID, scoped signature, included company submission versions, sources, data origin and the native Financial Insight Agent result.
- `schemas/reporting-input.schema.json` defines the normalized financial input assembled from the matching snapshot. `PREPARED` and `data_origin` explicitly identify samples; these are not validation-agent outcomes.
- `schemas/reporting-output.schema.json` defines report drafts.
- Legacy `insights.schema.json` remains an internal normalized findings contract. Legacy unbound company JSON is not accepted by the normal scoped upload field; regenerate/download from the current insights screen.

## Implementation

`src/services/completedCycle.js` gates access using readiness, current snapshot validity and processing completion. `shared/scopedReports.mjs` selects frozen members, aggregates base-currency figures with decimal addition, computes descriptive metrics, constructs evidence references and checks uploaded files. All three scopes share this code on client and server.

POST `/api/scoped/insights` with `{cycle, scope}`. Gemini receives selected aggregate metrics and source IDs, including limitations identifying prepared records. It returns one validated scoped insights file. Invalid evidence can trigger one corrective retry; persistent failures return an error, not fabricated findings.

POST `/api/scoped/report` with `{cycle, insightFile}`. The server reconstructs the financial input and checks scope, period, snapshot, versions, signature, sources and metric evidence before generating the report. It does not use financial values uploaded in an insights file as replacements for snapshot values.

Scope signatures detect accidental changes and stale files; they are not authorization credentials. Backend authentication, durable snapshot storage and transactional validation remain future production work. The current app stores snapshots and history in the browser. Old single-company API routes return 409 and direct callers to the completed-cycle workflow.

A new submission correction closes both screens until reprocessing and invalidates old insight files. Group/sector membership follows frozen cycle assignments. New insights do not publish a report. JSON, Markdown and browser Print/Save PDF are available for drafts.


## Human approval and company publication

`src/services/managementReports.js` saves drafts in workspace `managementReports`, assigns per-scope/period versions, and gates approval against active Admin identity, the current snapshot and the latest report version. Duplicate generation reopens an existing matching report. Rejection requires a reason. Approval creates immutable `publishedResults` per included company and notifications in the same state update. Company reports expose their approved content; sector/group approvals expose a derived own-company financial view without other companies' figures or aggregate narrative. `cycle.js` uses those publications for dashboard results and submission approval status. Historical approvals remain available after corrections, but a corrected submission cannot inherit them.

`scopedInsightStore.js` manages current saved insight files shared by both screens. `ReportDocument.jsx` renders draft and approved documents. `useReportingCycle.js` synchronizes workspace storage changes into other open tabs so company views update after approval. Timed processing advances in an Admin tab. These are prototype browser-state guarantees, not production server authorization.
