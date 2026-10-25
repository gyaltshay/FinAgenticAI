CREATE SCHEMA IF NOT EXISTS finagenticai;
CREATE TABLE IF NOT EXISTS finagenticai.workspace_revision (
 id integer PRIMARY KEY CHECK (id=1), revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO finagenticai.workspace_revision(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS finagenticai.companies (
 id text PRIMARY KEY, name text NOT NULL, sector text NOT NULL,
 active boolean NOT NULL, reporting boolean NOT NULL,
 record jsonb NOT NULL, ordinal integer NOT NULL
);
CREATE TABLE IF NOT EXISTS finagenticai.users (
 id text PRIMARY KEY, email text NOT NULL, name text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','subsidiary')),
 company_id text REFERENCES finagenticai.companies(id), active boolean NOT NULL,
 record jsonb NOT NULL, ordinal integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON finagenticai.users(lower(email));
CREATE TABLE IF NOT EXISTS finagenticai.reporting_periods (
 id text PRIMARY KEY, label text NOT NULL UNIQUE,
 open_date date NOT NULL, deadline date NOT NULL,
 state text NOT NULL CHECK(state IN ('Open','Closed')),
 record jsonb NOT NULL, ordinal integer NOT NULL, CHECK(open_date<=deadline)
);
CREATE TABLE IF NOT EXISTS finagenticai.submissions (
 id text PRIMARY KEY, company_id text NOT NULL REFERENCES finagenticai.companies(id),
 period_label text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 filename text NOT NULL, validation_status text,
 original_workbook jsonb, record jsonb NOT NULL, ordinal integer NOT NULL,
 UNIQUE(company_id,period_label,revision)
);
CREATE INDEX IF NOT EXISTS submissions_company_period ON finagenticai.submissions(company_id,period_label);
COMMENT ON TABLE finagenticai.submissions IS 'Submission metadata and original MinIO references only. No financial values, validation findings, insights or generated reports.';
COMMENT ON TABLE finagenticai.users IS 'Prototype user profiles only; application password authentication is not implemented.';
