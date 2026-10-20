# FinAgenticAI: Standardized Financial Reporting Schema

**Project:** Agentic AI System for Automated Financial Reporting and Insights (DHI subsidiaries)
**Phase:** Validation (Validation Agent + Consolidation Agent input contract)
**Schema version:** `1.0.0-draft`
**Status:** Draft for review with Thimphu TechPark Limited (TTPL) / DHI Finance

---

## 0. How to use this document

This schema is the **single reference** that every monthly report submitted by a DHI subsidiary is mapped to *before* validation and consolidation. The flow is:

```
Uploaded file (Excel / PDF)  ->  Extraction  ->  Mapping to this schema  ->  Validation rules (Section 7)  ->  Consolidation
        (MinIO)                  (Ingestion)       (canonical fields)          (Validation Agent)            (Consolidation Agent)
```

Design principles (taken from the proposal):

1. **Deterministic validation.** All numeric checks (totals, balances, variances) are done by Python functions, never by the LLM. The LLM is only used for extraction support and explaining errors.
2. **One canonical vocabulary.** "Sales", "Revenue", and "Operating Revenue" all map to a single field (`revenue`). Semantic alignment is solved first, arithmetic second.
3. **Traceability.** Every stored value keeps a pointer back to its source file, sheet/page, and cell/region, so any figure in a report can be traced to evidence.
4. **Human in the loop.** Rules produce `ERROR`, `WARNING`, or `INFO` findings; only a human can override a blocking `ERROR`.

> **Items marked `[CONFIRM]` must be verified with TTPL/DHI Finance** against the actual monthly templates before this schema is frozen. The proposal does not include the real templates, so field lists below follow standard income statement / balance sheet / cash flow structure plus the sectors named in the proposal.

---

## 1. Frontend alignment

The frontend (`https://gyaltshay.github.io/FinAgenticAI/`) is a client-rendered app, so its form fields and labels could not be read when this file was prepared. This section therefore ties the schema to the frontend features **stated in the proposal** (Presentation Layer, Figure 2) and leaves a table for you to confirm field-by-field.

| Frontend feature (per proposal) | Schema element it relies on |
|---|---|
| Login and access | `users`, `user_company_access` (Section 6) |
| Report upload | `submissions`, `submission_files` |
| Submission status and deadlines | `submissions.status`, `reporting_periods.submission_deadline` |
| KPI dashboard, charts, trends | `kpi_values` (Section 5) |
| Anomaly view | `findings` (Section 7.7) with `category = 'ANOMALY'` |
| Generated reports | `generated_reports` |

### 1.1 Frontend field confirmation `[CONFIRM]`

Fill this in from the live UI so that the upload form and the schema never drift apart.

| Frontend input / label | Schema field | Required? | Notes |
|---|---|---|---|
| Company (dropdown) | `submissions.company_id` | Yes | Should be restricted to the user's assigned companies |
| Reporting month / year | `submissions.period_id` | Yes | Must be a valid `YYYY-MM` |
| File upload (Excel / PDF) | `submission_files.*` | Yes | See file rules in 2.3 |
| Reporting basis (e.g. Unaudited / Management) | `submissions.reporting_basis` | `[CONFIRM]` | |
| Remarks / comments | `submissions.submitter_remarks` | No | |
| *(add any other fields you see)* | | | |

### 1.2 Suggested frontend refinements

Collecting these at upload time lets the Validation Agent catch problems *before* extraction, instead of after.

1. **Declare the period and currency on the form** and cross-check against what is found inside the file (rule `V-STR-05`, `V-STR-06`).
2. **Declare the reporting scale** (`UNITS`, `THOUSANDS`, `MILLIONS`). Scale mismatches are the most common cause of silent 1000x errors.
3. **Show validation results per submission** using the `findings` structure (severity, rule ID, field, message, suggested fix), so the company user sees exactly what to correct.
4. **Status labels** in the UI should match the status enum in Section 2.4.
5. **Resubmission** should create a new `version` rather than overwrite (see `submissions.version`).

---

## 2. Submission and file metadata

### 2.1 Reporting period

| Field | Type | Required | Rule |
|---|---|---|---|
| `period_id` | string `YYYY-MM` | Yes | e.g. `2026-12` |
| `fiscal_year` | integer | Yes | `[CONFIRM]` DHI fiscal year (assumed calendar year, Jan to Dec) |
| `month_number` | integer 1 to 12 | Yes | Month within the fiscal year |
| `period_end_date` | date | Yes | Last day of the month |
| `submission_deadline` | date | Yes | Set by DHI Finance per period |

### 2.2 Submission header (extracted from the file *and* declared on the form)

| Field | Type | Required | Description |
|---|---|---|---|
| `company_id` | string | Yes | Canonical company code (Section 3) |
| `company_name_as_reported` | string | Yes | Name exactly as written in the file (for mismatch detection) |
| `period_id` | string | Yes | Period covered |
| `currency` | string (ISO 4217) | Yes | `BTN` expected; anything else triggers `V-STR-06` |
| `scale` | enum | Yes | `UNITS`, `THOUSANDS`, `MILLIONS` |
| `reporting_basis` | enum | `[CONFIRM]` | `MANAGEMENT`, `UNAUDITED`, `AUDITED` |
| `prepared_by` | string | No | |
| `submitted_at` | timestamp | Yes | System-generated |
| `version` | integer | Yes | Starts at 1, increments per resubmission |

### 2.3 File rules

| Rule | Value |
|---|---|
| Accepted types | `.xlsx`, `.xls`, `.pdf` (`.csv` optional) `[CONFIRM]` |
| Max size | `[CONFIRM]` (suggest 20 MB) |
| Storage | MinIO, path `reports/{company_id}/{period_id}/v{version}/{filename}` |
| Integrity | SHA-256 hash stored per file to detect duplicate uploads |
| Preferred format | Excel (structured). PDF is accepted but flagged for lower extraction confidence (risk T1) |

### 2.4 Submission status lifecycle

```
PENDING -> SUBMITTED -> EXTRACTING -> VALIDATING -> VALIDATION_FAILED -> (company resubmits -> SUBMITTED, version+1)
                                          |
                                          v
                                    VALIDATED -> APPROVED -> CONSOLIDATED
```

| Status | Meaning |
|---|---|
| `PENDING` | Period open, nothing received (Notification Agent sends reminders) |
| `SUBMITTED` | File received and stored |
| `EXTRACTING` | Ingestion in progress |
| `VALIDATING` | Rules are running |
| `VALIDATION_FAILED` | At least one `ERROR` finding; sent back to the company |
| `VALIDATED` | No blocking errors (warnings may remain) |
| `APPROVED` | Human reviewer has approved it for consolidation |
| `CONSOLIDATED` | Included in sector/group totals |

---

## 3. Master data

### 3.1 Companies

The proposal states DHI holds stakes in 24 portfolio companies (11 fully owned, 5 controlled, 8 linked). The company register should be loaded from DHI, not typed by hand.

| Field | Type | Description |
|---|---|---|
| `company_id` | string (PK) | Short stable code, e.g. `CMP001` `[CONFIRM naming]` |
| `company_name` | string | Official name |
| `sector` | enum | See 3.2 |
| `ownership_type` | enum | `FULLY_OWNED`, `CONTROLLED`, `LINKED` |
| `ownership_pct` | decimal(5,2) | DHI shareholding, used for consolidation weighting `[CONFIRM]` |
| `is_active` | boolean | |
| `reporting_template_id` | string | Which template this company uses (Section 4.6) |

### 3.2 Sectors

`ENERGY_RESOURCES` (hydropower, mining), `FINANCIAL_SERVICES` (banking, insurance), `COMMUNICATION_TRANSPORT` (telecom, aviation), `MANUFACTURING`, `REAL_ESTATE_CONSTRUCTION`, `TRADING`. `[CONFIRM]` exact list against DHI's own classification.

---

## 4. Canonical financial data schema

### 4.1 Conventions (apply to every field)

| Convention | Rule |
|---|---|
| Currency | All values stored in `BTN` |
| Scale | Normalised to **full Ngultrum (units)** at ingestion; original scale kept in the header |
| Numeric type | `NUMERIC(20,2)`. Never floating point |
| Signs | Revenue, income, assets, liabilities, equity: **positive**. Expenses and costs: **positive magnitudes** (subtraction is done by formulas). Losses appear as negative `net_profit` |
| Missing vs zero | `NULL` = not reported; `0` = reported as zero. They are not interchangeable |
| Value basis | Each flow field is stored as **monthly** *and* **year-to-date (YTD)**. `[CONFIRM]` which basis each subsidiary reports and flag the other as derived |
| Provenance | Every value carries `source_file_id`, `source_location`, `extraction_method` (`EXCEL_CELL`, `PDF_TABLE`, `LLM_ASSISTED`), `confidence` (0 to 1) |

### 4.2 Income statement (`income_statement`)

| Canonical field | Type | Req. | Common aliases (for mapping) | Formula / note |
|---|---|---|---|---|
| `revenue` | numeric | Yes | Sales, Turnover, Operating Revenue, Revenue from Operations | Core top line |
| `other_operating_income` | numeric | No | Other Income (operating) | |
| `cost_of_sales` | numeric | Yes* | Cost of Goods Sold, COGS, Direct Costs, Cost of Revenue | *Not applicable to some financial-services entities |
| `gross_profit` | numeric | Derived | Gross Margin | `revenue - cost_of_sales` |
| `employee_expenses` | numeric | No | Staff Costs, Salaries and Wages, Personnel Expenses | |
| `depreciation_amortisation` | numeric | No | Depreciation, D&A | |
| `other_operating_expenses` | numeric | No | Administrative Expenses, Operating Expenses, Selling and Distribution | |
| `total_operating_expenses` | numeric | Yes | Total Expenses (before finance cost) | Sum of operating expense lines |
| `operating_profit` | numeric | Derived | EBIT, Profit from Operations | `gross_profit + other_operating_income - total_operating_expenses` |
| `finance_income` | numeric | No | Interest Income (non-bank), Investment Income | |
| `finance_costs` | numeric | No | Interest Expense, Borrowing Costs | |
| `profit_before_tax` | numeric | Yes | PBT, Profit Before Taxation | |
| `income_tax_expense` | numeric | No | Tax, Corporate Income Tax, Current + Deferred Tax | |
| `net_profit` | numeric | Yes | Net Income, Profit After Tax, PAT, Profit for the Period | `profit_before_tax - income_tax_expense` |

**Financial-services extension** (`income_statement_fs`, banks and insurers):
`interest_income`, `interest_expense`, `net_interest_income` (derived), `fee_commission_income`, `provision_for_loan_losses`, `claims_incurred` (insurers), `premium_income` (insurers).

### 4.3 Balance sheet (`balance_sheet`)

| Canonical field | Type | Req. | Common aliases | Formula / note |
|---|---|---|---|---|
| `cash_and_equivalents` | numeric | Yes | Cash and Bank Balances, Cash at Bank | |
| `trade_receivables` | numeric | No | Accounts Receivable, Debtors | |
| `inventories` | numeric | No | Stock, Inventory | |
| `other_current_assets` | numeric | No | Prepayments, Advances | |
| `total_current_assets` | numeric | Yes | Current Assets | Sum of current asset lines |
| `property_plant_equipment` | numeric | No | PPE, Fixed Assets, Capital Work in Progress (if combined) | |
| `intangible_assets` | numeric | No | | |
| `long_term_investments` | numeric | No | Investments in Associates / Subsidiaries | |
| `other_non_current_assets` | numeric | No | | |
| `total_non_current_assets` | numeric | Yes | Non-Current Assets | |
| `total_assets` | numeric | Yes | | `total_current_assets + total_non_current_assets` |
| `trade_payables` | numeric | No | Accounts Payable, Creditors | |
| `short_term_borrowings` | numeric | No | Short-Term Loans, Overdraft, Current Portion of LT Debt | |
| `other_current_liabilities` | numeric | No | Accruals, Provisions (current) | |
| `total_current_liabilities` | numeric | Yes | Current Liabilities | |
| `long_term_borrowings` | numeric | No | Long-Term Loans, Debentures | |
| `other_non_current_liabilities` | numeric | No | Deferred Tax Liability, Provisions (non-current) | |
| `total_non_current_liabilities` | numeric | Yes | | |
| `total_liabilities` | numeric | Yes | | `total_current_liabilities + total_non_current_liabilities` |
| `share_capital` | numeric | No | Paid-up Capital | |
| `retained_earnings` | numeric | No | Accumulated Profit, Reserves and Surplus | |
| `other_equity` | numeric | No | Other Reserves | |
| `total_equity` | numeric | Yes | Shareholders' Funds, Net Worth | |
| `total_liabilities_and_equity` | numeric | Yes | | Must equal `total_assets` |

**Financial-services extension** (`balance_sheet_fs`): `loans_and_advances`, `customer_deposits`, `non_performing_loans`, `capital_adequacy_ratio_pct`, `insurance_contract_liabilities`.

### 4.4 Cash flow statement (`cash_flow`)

| Canonical field | Type | Req. | Common aliases | Formula / note |
|---|---|---|---|---|
| `net_cash_from_operating` | numeric | Yes | Cash from Operations | |
| `net_cash_from_investing` | numeric | Yes | | |
| `net_cash_from_financing` | numeric | Yes | | |
| `net_change_in_cash` | numeric | Derived | Net Increase / (Decrease) in Cash | Sum of the three above |
| `opening_cash` | numeric | Yes | Cash at Beginning of Period | |
| `closing_cash` | numeric | Yes | Cash at End of Period | `opening_cash + net_change_in_cash` |
| `capital_expenditure` | numeric | No | Purchase of PPE, Capex | |
| `dividends_paid` | numeric | No | | Relevant to DHI dividend reporting |

> `[CONFIRM]` whether subsidiaries submit a monthly cash flow at all. If not, `cash_flow` becomes optional and rules `V-XST-03` and `V-ARI-04` are skipped for that company.

### 4.5 Sector-specific operational metrics (`sector_metrics`)

Stored as key/value rows so new metrics need no schema change. Initial set `[CONFIRM]`:

| Sector | `metric_key` | Unit | Example use |
|---|---|---|---|
| Energy (hydropower) | `generation_mwh` | MWh | Revenue-per-unit sanity check |
| Energy (hydropower) | `plant_availability_pct` | % | Anomaly context |
| Communication (telecom) | `subscribers_count` | count | ARPU KPI |
| Financial services | `non_performing_loan_pct` | % | Risk flag |
| Mining / Manufacturing | `production_volume` | tonnes / units | Cost per unit |
| Any | `headcount` | count | Staff cost per head |

### 4.6 Template mapping (`field_mappings`)

How a subsidiary's own labels reach the canonical fields. This is the table the Consolidation Agent relies on, and it is data, not code, so DHI Finance can extend it without a redeploy.

| Field | Type | Description |
|---|---|---|
| `mapping_id` | PK | |
| `company_id` | FK | `NULL` = applies to all companies (global alias) |
| `source_label` | string | Label as written, normalised (lower-case, trimmed) |
| `canonical_field` | string | e.g. `revenue` |
| `statement` | enum | `INCOME`, `BALANCE`, `CASHFLOW`, `SECTOR` |
| `created_by` | enum | `SEED`, `LLM_PROPOSED`, `HUMAN_APPROVED` |
| `confidence` | decimal | |

**Rule:** an LLM-proposed mapping is **never used for consolidation** until a human sets it to `HUMAN_APPROVED`. Unmapped labels raise finding `V-STR-04`.

---

## 5. KPI definitions (`kpi_values`)

Calculated by deterministic functions after validation. These feed the dashboard. `[CONFIRM]` the exact KPI list DHI management requires.

| KPI key | Formula | Unit |
|---|---|---|
| `gross_margin_pct` | `gross_profit / revenue * 100` | % |
| `operating_margin_pct` | `operating_profit / revenue * 100` | % |
| `net_margin_pct` | `net_profit / revenue * 100` | % |
| `revenue_growth_mom_pct` | `(revenue_t - revenue_t-1) / revenue_t-1 * 100` | % |
| `revenue_growth_yoy_pct` | vs same month prior year | % |
| `current_ratio` | `total_current_assets / total_current_liabilities` | ratio |
| `quick_ratio` | `(total_current_assets - inventories) / total_current_liabilities` | ratio |
| `debt_to_equity` | `(short_term_borrowings + long_term_borrowings) / total_equity` | ratio |
| `return_on_equity_pct` | `net_profit (annualised) / total_equity * 100` | % |
| `return_on_assets_pct` | `net_profit (annualised) / total_assets * 100` | % |
| `interest_cover` | `operating_profit / finance_costs` | ratio |

All divisions guard against a zero or `NULL` denominator, returning `NULL` (never `0` or an error).

---

## 6. Relational schema (PostgreSQL)

```sql
-- Master data
CREATE TABLE companies (
  company_id          TEXT PRIMARY KEY,
  company_name        TEXT NOT NULL,
  sector              TEXT NOT NULL,
  ownership_type      TEXT NOT NULL CHECK (ownership_type IN ('FULLY_OWNED','CONTROLLED','LINKED')),
  ownership_pct       NUMERIC(5,2),
  reporting_template_id TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE reporting_periods (
  period_id           TEXT PRIMARY KEY,              -- 'YYYY-MM'
  fiscal_year         INT  NOT NULL,
  month_number        INT  NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  period_end_date     DATE NOT NULL,
  submission_deadline DATE NOT NULL
);

CREATE TABLE users (
  user_id       UUID PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('COMPANY_USER','FINANCE_TEAM','MANAGEMENT','ADMIN'))
);

CREATE TABLE user_company_access (
  user_id    UUID REFERENCES users(user_id),
  company_id TEXT REFERENCES companies(company_id),
  PRIMARY KEY (user_id, company_id)
);

-- Submissions
CREATE TABLE submissions (
  submission_id     UUID PRIMARY KEY,
  company_id        TEXT NOT NULL REFERENCES companies(company_id),
  period_id         TEXT NOT NULL REFERENCES reporting_periods(period_id),
  version           INT  NOT NULL DEFAULT 1,
  status            TEXT NOT NULL,                    -- see Section 2.4
  currency          TEXT NOT NULL DEFAULT 'BTN',
  scale             TEXT NOT NULL CHECK (scale IN ('UNITS','THOUSANDS','MILLIONS')),
  reporting_basis   TEXT,
  submitted_by      UUID REFERENCES users(user_id),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitter_remarks TEXT,
  UNIQUE (company_id, period_id, version)
);

CREATE TABLE submission_files (
  file_id        UUID PRIMARY KEY,
  submission_id  UUID NOT NULL REFERENCES submissions(submission_id),
  object_key     TEXT NOT NULL,                       -- MinIO path
  file_name      TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     BIGINT NOT NULL,
  sha256         CHAR(64) NOT NULL
);

-- Canonical statements (one row per submission; provenance kept in value_provenance)
CREATE TABLE income_statement (
  submission_id UUID PRIMARY KEY REFERENCES submissions(submission_id),
  basis TEXT NOT NULL CHECK (basis IN ('MONTHLY','YTD')),
  revenue NUMERIC(20,2), other_operating_income NUMERIC(20,2), cost_of_sales NUMERIC(20,2),
  gross_profit NUMERIC(20,2), employee_expenses NUMERIC(20,2),
  depreciation_amortisation NUMERIC(20,2), other_operating_expenses NUMERIC(20,2),
  total_operating_expenses NUMERIC(20,2), operating_profit NUMERIC(20,2),
  finance_income NUMERIC(20,2), finance_costs NUMERIC(20,2),
  profit_before_tax NUMERIC(20,2), income_tax_expense NUMERIC(20,2), net_profit NUMERIC(20,2)
);
-- NOTE: if a company reports both MONTHLY and YTD, change the PK to (submission_id, basis).

CREATE TABLE balance_sheet (
  submission_id UUID PRIMARY KEY REFERENCES submissions(submission_id),
  cash_and_equivalents NUMERIC(20,2), trade_receivables NUMERIC(20,2), inventories NUMERIC(20,2),
  other_current_assets NUMERIC(20,2), total_current_assets NUMERIC(20,2),
  property_plant_equipment NUMERIC(20,2), intangible_assets NUMERIC(20,2),
  long_term_investments NUMERIC(20,2), other_non_current_assets NUMERIC(20,2),
  total_non_current_assets NUMERIC(20,2), total_assets NUMERIC(20,2),
  trade_payables NUMERIC(20,2), short_term_borrowings NUMERIC(20,2),
  other_current_liabilities NUMERIC(20,2), total_current_liabilities NUMERIC(20,2),
  long_term_borrowings NUMERIC(20,2), other_non_current_liabilities NUMERIC(20,2),
  total_non_current_liabilities NUMERIC(20,2), total_liabilities NUMERIC(20,2),
  share_capital NUMERIC(20,2), retained_earnings NUMERIC(20,2), other_equity NUMERIC(20,2),
  total_equity NUMERIC(20,2), total_liabilities_and_equity NUMERIC(20,2)
);

CREATE TABLE cash_flow (
  submission_id UUID PRIMARY KEY REFERENCES submissions(submission_id),
  net_cash_from_operating NUMERIC(20,2), net_cash_from_investing NUMERIC(20,2),
  net_cash_from_financing NUMERIC(20,2), net_change_in_cash NUMERIC(20,2),
  opening_cash NUMERIC(20,2), closing_cash NUMERIC(20,2),
  capital_expenditure NUMERIC(20,2), dividends_paid NUMERIC(20,2)
);

CREATE TABLE sector_metrics (
  submission_id UUID REFERENCES submissions(submission_id),
  metric_key    TEXT NOT NULL,
  metric_value  NUMERIC(20,4),
  unit          TEXT,
  PRIMARY KEY (submission_id, metric_key)
);

-- Provenance for every extracted value
CREATE TABLE value_provenance (
  submission_id      UUID REFERENCES submissions(submission_id),
  canonical_field    TEXT NOT NULL,
  source_file_id     UUID REFERENCES submission_files(file_id),
  source_location    TEXT,                            -- e.g. 'Sheet1!C14' or 'p3 table2 row5'
  source_label       TEXT,                            -- label as written in the file
  extraction_method  TEXT NOT NULL CHECK (extraction_method IN ('EXCEL_CELL','PDF_TABLE','LLM_ASSISTED')),
  confidence         NUMERIC(3,2),
  PRIMARY KEY (submission_id, canonical_field)
);

-- Mapping and validation
CREATE TABLE field_mappings (
  mapping_id      UUID PRIMARY KEY,
  company_id      TEXT REFERENCES companies(company_id),  -- NULL = global
  source_label    TEXT NOT NULL,
  canonical_field TEXT NOT NULL,
  statement       TEXT NOT NULL,
  created_by      TEXT NOT NULL CHECK (created_by IN ('SEED','LLM_PROPOSED','HUMAN_APPROVED')),
  confidence      NUMERIC(3,2)
);

CREATE TABLE validation_rules (
  rule_id        TEXT PRIMARY KEY,                    -- e.g. 'V-ARI-01'
  category       TEXT NOT NULL,
  description    TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('ERROR','WARNING','INFO')),
  tolerance_abs  NUMERIC(20,2),
  tolerance_pct  NUMERIC(8,4),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE findings (
  finding_id      UUID PRIMARY KEY,
  submission_id   UUID NOT NULL REFERENCES submissions(submission_id),
  rule_id         TEXT REFERENCES validation_rules(rule_id),
  category        TEXT NOT NULL,                      -- VALIDATION | ANOMALY
  severity        TEXT NOT NULL,
  field_name      TEXT,
  expected_value  NUMERIC(20,2),
  actual_value    NUMERIC(20,2),
  message         TEXT NOT NULL,
  suggested_fix   TEXT,
  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','OVERRIDDEN')),
  overridden_by   UUID REFERENCES users(user_id),
  override_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kpi_values (
  submission_id UUID REFERENCES submissions(submission_id),
  kpi_key       TEXT NOT NULL,
  kpi_value     NUMERIC(20,6),
  PRIMARY KEY (submission_id, kpi_key)
);
```

---

## 7. Validation rules

Rules run in the order below. A submission cannot move to `VALIDATED` while any `ERROR` is `OPEN`.

**Tolerance:** two values are "equal" if `|a - b| <= max(tolerance_abs, tolerance_pct * |reference|)`. Defaults: `tolerance_abs = 1.00` (BTN, rounding), `tolerance_pct = 0.01%`. Both are configurable per rule in `validation_rules`.

### 7.1 Structure and completeness (`V-STR`)

| ID | Check | Severity |
|---|---|---|
| V-STR-01 | File is readable, not password-protected or corrupt | ERROR |
| V-STR-02 | All **required** canonical fields (Section 4) are present for the company's template | ERROR |
| V-STR-03 | Required statements present (income statement, balance sheet; cash flow if the company's template includes it) | ERROR |
| V-STR-04 | Every source label maps to a canonical field with an approved mapping | WARNING (ERROR if the label carries a numeric value in a required section) |
| V-STR-05 | Period in the file matches the period selected on the form | ERROR |
| V-STR-06 | Currency is `BTN`; declared scale matches the magnitude of values | ERROR |
| V-STR-07 | Company name in the file matches the selected company | ERROR |
| V-STR-08 | Duplicate file (same SHA-256) already submitted for this period | WARNING |

### 7.2 Format and type (`V-FMT`)

| ID | Check | Severity |
|---|---|---|
| V-FMT-01 | Numeric fields contain numbers (no text such as `N/A` or `-` treated as a value; parentheses `(1,200)` parsed as negative) | ERROR |
| V-FMT-02 | No more than 2 decimal places after normalisation | WARNING |
| V-FMT-03 | Dates parse correctly and fall within the period | ERROR |
| V-FMT-04 | Sign convention respected (e.g. `total_assets >= 0`, `cost_of_sales >= 0`) | ERROR |
| V-FMT-05 | Extraction `confidence` below threshold (default 0.80) | WARNING (sent for human review) |

### 7.3 Arithmetic consistency (`V-ARI`)

| ID | Check | Severity |
|---|---|---|
| V-ARI-01 | `gross_profit = revenue - cost_of_sales` | ERROR |
| V-ARI-02 | `operating_profit = gross_profit + other_operating_income - total_operating_expenses` | ERROR |
| V-ARI-03 | `net_profit = profit_before_tax - income_tax_expense` | ERROR |
| V-ARI-04 | `net_change_in_cash = operating + investing + financing` | ERROR |
| V-ARI-05 | `total_current_assets` equals the sum of its component lines (when components given) | ERROR |
| V-ARI-06 | `total_assets = total_current_assets + total_non_current_assets` | ERROR |
| V-ARI-07 | `total_liabilities = total_current_liabilities + total_non_current_liabilities` | ERROR |
| V-ARI-08 | `total_equity = share_capital + retained_earnings + other_equity` (when components given) | ERROR |
| V-ARI-09 | `total_operating_expenses` equals the sum of its component lines | ERROR |

### 7.4 Cross-statement reconciliation (`V-XST`)

| ID | Check | Severity |
|---|---|---|
| V-XST-01 | **Balance sheet balances:** `total_assets = total_liabilities + total_equity` | ERROR |
| V-XST-02 | `total_liabilities_and_equity = total_assets` | ERROR |
| V-XST-03 | `cash_flow.closing_cash = balance_sheet.cash_and_equivalents` | ERROR |
| V-XST-04 | `cash_flow.opening_cash = prior period closing cash` | ERROR |
| V-XST-05 | Change in `retained_earnings` ≈ `net_profit - dividends_paid` (within tolerance) | WARNING |

### 7.5 Temporal consistency (`V-TMP`)

Needs the prior period for the same company.

| ID | Check | Severity |
|---|---|---|
| V-TMP-01 | If YTD is reported: `YTD_t >= YTD_t-1` for revenue and expense lines (YTD cannot shrink within a fiscal year) | ERROR |
| V-TMP-02 | Derived monthly value `= YTD_t - YTD_t-1` is not negative for revenue | ERROR |
| V-TMP-03 | Opening balances equal the prior month's closing balances | ERROR |
| V-TMP-04 | Month-on-month change in any major line exceeds threshold (default ±40%) | WARNING |
| V-TMP-05 | Prior-period figures restated without a remark | WARNING |

### 7.6 Plausibility (`V-PLA`)

| ID | Check | Severity |
|---|---|---|
| V-PLA-01 | Net margin outside plausible band (default -100% to +100%) | WARNING |
| V-PLA-02 | `current_ratio` > 10 or < 0.1 | WARNING |
| V-PLA-03 | Negative `total_equity` | WARNING |
| V-PLA-04 | Suspected scale error: any value is ~1000x the company's trailing 6-month median for that field | ERROR |
| V-PLA-05 | Zero `revenue` for a company that reported revenue in each of the previous 3 months | WARNING |
| V-PLA-06 | Sector metric inconsistent with revenue (e.g. hydropower revenue per MWh far outside historical range) | WARNING |

### 7.7 Anomalies vs validation

`V-PLA` and `V-TMP-04` are **data-quality** warnings raised by the Validation Agent. Business **anomalies** (e.g. a genuine margin collapse) are raised later by the Insights Agent and stored in the same `findings` table with `category = 'ANOMALY'`, so the frontend anomaly view has one source. Detection is rule/statistics based; the LLM only explains.

---

## 8. Validation output contract

The Validation Agent writes one JSON result per submission. The Notification Agent reads it to send follow-up messages, and the frontend renders it directly.

```json
{
  "schema_version": "1.0.0-draft",
  "submission_id": "b3f1c2e0-0000-0000-0000-000000000000",
  "company_id": "CMP001",
  "period_id": "2026-12",
  "version": 1,
  "overall_status": "VALIDATION_FAILED",
  "summary": { "errors": 2, "warnings": 3, "info": 0, "rules_run": 38 },
  "findings": [
    {
      "rule_id": "V-XST-01",
      "severity": "ERROR",
      "field": "balance_sheet.total_assets",
      "expected": 125000000.00,
      "actual": 124500000.00,
      "difference": -500000.00,
      "message": "Total assets do not equal total liabilities plus equity.",
      "suggested_fix": "Check non-current asset lines and equity components.",
      "source_location": "Balance Sheet!C32"
    }
  ],
  "requires_human_review": true
}
```

*(Values above are illustrative only.)*

---

## 9. Standardised extraction template (Excel)

To reduce PDF-extraction risk (T1), provide subsidiaries with a single Excel template whose layout mirrors Section 4 so that mapping is one-to-one.

| Sheet | Contents |
|---|---|
| `Header` | company, period, currency, scale, reporting basis, prepared by |
| `IncomeStatement` | Rows in Section 4.2 order, with columns `Monthly`, `YTD`, `Prior Month`, `Same Month Last Year` |
| `BalanceSheet` | Rows in Section 4.3 order, with columns `Current`, `Prior Month` |
| `CashFlow` | Rows in Section 4.4 order (if applicable) |
| `SectorMetrics` | `metric_key`, `value`, `unit` |

Companies that cannot adopt it keep their own layout and rely on `field_mappings`.

---

## 10. Open questions for TTPL / DHI Finance

1. What are the real monthly templates per subsidiary? (Needed to finalise Sections 4.2 to 4.5.)
2. Is the fiscal year Jan to Dec for all 24 companies?
3. Monthly values, YTD values, or both?
4. Do subsidiaries submit a monthly **cash flow**, or only income statement and balance sheet?
5. Which basis is reported: management accounts, unaudited, audited?
6. Which companies need the financial-services extension (banks, insurers) and which sector metrics are mandatory?
7. Are subsidiary figures consolidated at 100% or weighted by `ownership_pct`? How are `LINKED` (associate) companies treated?
8. Final KPI list and the thresholds DHI considers material for the plausibility rules?
9. Any intra-group balances (loans, dividends, sales between subsidiaries) that must be eliminated on consolidation? A field set for these is not yet in the schema.

---

## 11. Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0-draft | 2026-10-16 | First draft of canonical schema, validation rules and output contract |
