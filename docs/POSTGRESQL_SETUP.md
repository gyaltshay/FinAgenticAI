# Local PostgreSQL integration

## What is stored

The `finagenticai` database uses a dedicated `finagenticai_app` login and the `finagenticai` schema:

| Table | Contents |
| --- | --- |
| `companies` | Company identities, logos, sectors, group assignments and active/reporting flags |
| `users` | Names, emails, roles, company assignments and account status |
| `reporting_periods` | Reporting windows, frozen required companies and assignments |
| `submissions` | Submission IDs, company/period/version, filename, upload details, validation status and MinIO receipt/object reference |
| `workspace_revision` | Revision used to reject conflicting browser saves |

Only explicitly selected metadata fields are accepted. Financial values, detailed validation findings, Gemini explanations, insights, generated reports and approval/publication results keep their existing browser storage behavior. Raw workbooks stay in MinIO. User profiles are stored, but password authentication remains the existing frontend prototype; this phase does not store application passwords or authenticate users on the server.

## Start the services

The existing Windows PostgreSQL service referenced missing server files, so this project uses a separate official PostgreSQL 17 Docker container. It does not repair or replace the Windows installation. Credentials are in ignored `.env.database.local` at the repository root; `.env.database.example` contains placeholders only.

From `D:\FinAgenticAI`:

```powershell
docker compose --env-file .env.database.local -f compose.database.yaml up -d
```

From `D:\FinAgenticAI\frontend`:

```powershell
npm install
npm run database:setup
npm run gemini
npm run dev
```

Setup uses `PGADMIN_USER` and `PGADMIN_PASSWORD` only to create the dedicated role/database if absent. It refuses an existing database owned by another role and does not reset existing role passwords. Tables are initialized transactionally without deleting existing records. The running API connects using `PGUSER` and `PGPASSWORD`, which belong to the non-superuser application role.

Docker publishes port 5432 on localhost only. Data persists in `finagenticai-database_postgres-data`; do not remove this volume or run `down --volumes` when keeping the data. Keep Docker running for both PostgreSQL and MinIO.

The example configuration pins the tested official PostgreSQL 17 Alpine image digest. On this workstation, stalled Docker downloads required loading the same verified official image through a local archive; the local configuration pins its verified image ID. No PostgreSQL image contents were changed. If rebuilding on another computer or after removing the local image, use the registry reference from `.env.database.example`.

## Application behavior

The first browser to connect to an empty database imports its current administrative records and submission metadata. This preserves existing upload references. Later browser sessions load these database records and merge them with any matching local agent results. Changes to companies, users, periods and submission details synchronize automatically; financial results never enter these metadata writes.

Saves use one database transaction and an expected revision. Conflicting saves are rejected with a message to reload; they never overwrite newer records silently. Submission identity, company, period, version, filename and an already stored original reference cannot be replaced. Existing database rows cannot be removed by resetting a browser. Database outages show an error; local changes stay in browser storage and ordinary failed saves retry. Reload after a conflict to load current database metadata.

Records from another browser may have a validation status and a downloadable original, while detailed agent output remains unavailable in that browser. This is intentional for the current phase. Shared agent results, server-side authentication/authorization, and central revision allocation per company/period are not implemented. Concurrent browsers can propose the same version number; the database rejects the conflicting snapshot rather than merging it automatically. Reload before resubmitting a correction from a stale browser.

## Inspect with pgAdmin or psql

Connect to host `127.0.0.1`, port `5432`, database `finagenticai`, username `finagenticai_app`, and the `PGPASSWORD` value in `.env.database.local`.

```sql
SELECT id, name, sector, active FROM finagenticai.companies;
SELECT name, email, role, company_id FROM finagenticai.users;
SELECT label, open_date, deadline, state FROM finagenticai.reporting_periods;
SELECT company_id, period_label, revision, filename,
       original_workbook->>'key' AS minio_object_key
FROM finagenticai.submissions
ORDER BY company_id, period_label, revision;
```

`GET /api/database/health` checks availability. `GET /api/database/records` loads metadata. `PUT /api/database/records` accepts `{revision,records}`. These are local prototype endpoints, not an authenticated deployment. GitHub Pages alone cannot run or reach this local database API. Never place database credentials in `VITE_` variables or frontend code.

`npm test` covers projection and validation. `node tests/database-browser.mjs` uses a uniquely named temporary test database and synthetic workbook, checks real transactions and browser persistence, then removes only its own test database and workbook. `FINAGENTIC_DATABASE_DISABLED=1` disables PostgreSQL in isolated non-database QA scripts; leave it unset in the application.
