# Insights to reporting handoff

POST `/api/reporting/generate` to the existing local server (`npm run gemini`). Reporting requires no Gemini key and makes no external AI calls: the agent composes an evidence-linked draft deterministically. The insights agent can use its own model independently.

Use `schemas/reporting-input.schema.json`, `schemas/insights.schema.json` and `schemas/reporting-output.schema.json` in this skill. An executable example lives in `frontend/tests/fixtures/reporting-input.json`. It is a small TTPL example, not a reconciled or approved full financial statement.

`insights` is null when unavailable. Otherwise it contains `schema_version`, `scope_id`, `period`, `input_signature`, `summary`, `findings`. The signature must equal the request's snapshot signature. Findings include unique `id`, `category`, `severity`, `text`, `record_refs`, `source_refs`, and optional `recommendation` (null if absent). These references must exist in the reporting package. The upstream producer must check factual and causal support; this contract checks traceability, not truth of arbitrary prose.

Financial records contain decimal strings, currency/count units, original source scale, time basis and comparison role. Ratios and KPIs can be added later through a versioned contract; the first prototype reports monetary amounts and headcount without assuming stakeholder-unconfirmed KPI formulas. No profit is inferred when a reported profit record is absent.

Currency/scale confirmation is a finance responsibility. A NEEDS_REVIEW input also needs a reviewer and review reason. For consolidated scopes, `consolidated` must be true and the caller must provide a genuine consolidated snapshot; a sum alone is not evidence of accounting consolidation.

The Management Reports screen imports insights JSON, generates company drafts from validated submissions, persists draft history locally, and exports JSON/Markdown or prints PDF. Reporting drafts do not automatically approve or replace the existing group report. JSON validation on both client and server provides prototype integrity, not authenticated financial authorization.


## Native Financial Insight Agent output

The Management Reports importer also accepts the collaborator's `financial-insight-agent/schemas/insight-result.schema.json` format. Generate Company scope insights for the exact submission, download the result, select that submission in Reporting Agent, confirm units, and import it. `src/services/insightHandoff.js` checks the report ID, period, computed metric evidence and known source references before mapping fields. Wrong-submission or unsupported evidence is rejected; group insights are not relabelled as company insights. Native insights must still be reviewed by finance. Prepared frontend consolidation fixtures never masquerade as validated inputs for either real agent.
