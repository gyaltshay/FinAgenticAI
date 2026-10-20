# TTPL Financial Report Validation Rules (Reference Draft)

## Purpose and limitation
These rules are a starting point for validating monthly TTPL financial workbooks. The blank template was reconstructed from a report summary, not from the verified original Excel workbook. Do not claim exact cell-level fidelity until the original workbook has been inspected.

## Expected sheet names
- `Month Financials`
- `Monthly PPR`
- `Monthly Expense LBL`

Compare names exactly. Report unexpected extra sheets separately; do not automatically reject them unless TTPL confirms that only these sheets are allowed.

## Source limitations requiring caution
- Exact cell addresses, formulas, merged ranges, hidden rows/columns, named ranges, number formats, and all row/column headings have not been verified.
- Currency/scale is ambiguous: some sheets may say “In Nu (Millions)” while values appear to be raw Nu. Flag for review; never silently rescale.
- Reported total expenses were Nu 13,779,723 and plan Nu 15,440,832. Actual minus plan is -Nu 1,661,109, but the summary described Nu 1,661,110 below plan and a cached variance of -Nu 1,856,693 in one location. Keep source and recomputed values separately and flag mismatch.
- EBT and net profit after tax were both shown as (Nu 90,833), but no separate tax line was visible in the summary. Flag for human confirmation rather than assuming an error.
- Do not infer segment-margin formulas unless TTPL confirms the mapping and included components.

## Rule catalogue

### File and workbook structure
- `FILE-001`: File is readable as an approved Excel format.
- `FILE-002`: Required sheets exist: `Month Financials`, `Monthly PPR`, `Monthly Expense LBL`.
- `FILE-003`: Report unexpected/missing sheets, hidden sheets, hidden rows/columns, merged cells, named ranges, formula cells, and workbook dimensions as observations. Fail only where an approved rule defines expected behavior.
- `FILE-004`: Record filename, reporting period, sheet names, dimensions, and extraction warnings.

### Completeness
- `COMP-001`: Reporting period is present and consistent across sheets where repeated.
- `COMP-002`: Required metric and business-line labels are present.
- `COMP-003`: Required numeric values are present where expected; distinguish zero from blank.
- `COMP-004`: Required formulas exist only after the original formula cells are confirmed.
- `COMP-005`: Preserve source coordinates and raw values for every extracted field.

### Data types and values
- `DATA-001`: Financial values are numeric or in an approved numeric-text format.
- `DATA-002`: Parse percentages consistently; unusual values should be flagged, not automatically rejected based on magnitude alone.
- `DATA-003`: Identify currency and scale. If the label and values seem inconsistent, use `REVIEW_REQUIRED`; never auto-convert without approval.
- `DATA-004`: Parse parentheses as negative values, e.g. `(90,833)` -> `-90833`.
- `DATA-005`: Parse reporting periods consistently.

### Arithmetic (only where definitions are confirmed)
- `CALC-001`: Total revenue equals the sum of included business-line actual revenue.
- `CALC-002`: Total expenses equal the sum of included actual expense values.
- `CALC-003`: Recompute variance using the confirmed convention; if Actual - Plan, calculate actual minus plan.
- `CALC-004`: Recompute prior-year variance using the confirmed convention.
- `CALC-005`: Recompute prior-month variance using the confirmed convention.
- `CALC-006`: Recompute operating efficiency only if its definition is confirmed; the shared summary suggests Expenses / Revenue × 100.
- `CALC-007`: Recompute margins only after their definitions and category mappings are confirmed.

### Cross-sheet reconciliation
- `RECON-001`: Compare total revenue between sheets where the same metric appears.
- `RECON-002`: Compare total expenses between sheets where the same metric appears.
- `RECON-003`: Compare reporting period and currency/scale metadata across sheets.
- `RECON-004`: Compare displayed/cached variances with recomputed values; retain both and flag differences.
- `RECON-005`: If EBT and NPAT are equal and tax treatment is not visible, request human confirmation.

### Review and implementation
- `REVIEW-001`: Large variances are review flags, not proof of incorrect data.
- `REVIEW-002`: Flag ambiguous labels, missing evidence, and uncertain row mappings.
- `REVIEW-003`: Deterministic code performs arithmetic; the LLM explains results but must not calculate authoritative totals or change source values.
- `REVIEW-004`: Human review is required before unresolved material issues are approved or a final report is released.

## Implementation requirements
1. Use deterministic workbook parsing and Python validators for sheet checks, cell extraction, formulas, and arithmetic.
2. Capture workbook, sheet, cell coordinate, source label, raw value, parsed value, and formula where available.
3. Keep source, recomputed value, and difference separate.
4. Use statuses: `PASS`, `FAIL`, `WARNING`, `REVIEW_REQUIRED`, `NOT_CHECKED`.
5. Never overwrite the source workbook.
6. Do not add exact cell-address rules until the original TTPL workbook is inspected.
