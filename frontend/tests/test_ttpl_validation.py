import base64
import io
import json
import sys
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

SERVER_DIR = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(SERVER_DIR))
import validate_ttpl_workbook as validator


def text_cell(ref, value):
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'


def number_cell(ref, value):
    return f'<c r="{ref}"><v>{value}</v></c>'


def formula_cell(ref, formula, cached):
    return f'<c r="{ref}"><f>{escape(formula)}</f><v>{cached}</v></c>'


def sheet_xml(rows):
    row_xml = []
    max_row = 0
    max_col = 0
    for row_number, cells in rows.items():
        max_row = max(max_row, row_number)
        entries = []
        for col_number, cell in cells.items():
            max_col = max(max_col, col_number)
            entries.append(cell)
        row_xml.append(f'<row r="{row_number}">' + "".join(entries) + "</row>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<dimension ref="A1:{validator.coordinate(max_row, max_col)}"/>'
        '<sheetData>' + "".join(row_xml) + '</sheetData></worksheet>'
    )


def workbook_bytes(*, missing=(), revenue=100, ppr_revenue=100, expense=80, ppr_expense=80, variance=10, scale_heading=True, omit_revenue_label=False):
    sheets = {
        "Month Financials": {
            1: {1: text_cell("A1", "Metric"), 2: text_cell("B1", "Actual"), 3: text_cell("C1", "Plan"), 4: text_cell("D1", "Variance (Actual - Plan)"), 5: text_cell("E1", "In Nu (Millions)" if scale_heading else "Nu")},
            2: {1: text_cell("A2", "Revenues" if not omit_revenue_label else "Sales"), 2: number_cell("B2", revenue), 3: number_cell("C2", 90), 4: formula_cell("D2", "B2-C2", variance)},
            3: {1: text_cell("A3", "Expenses"), 2: number_cell("B3", expense), 3: number_cell("C3", 90), 4: formula_cell("D3", "B3-C3", expense - 90)},
            4: {1: text_cell("A4", "Margin"), 2: number_cell("B4", revenue - expense), 3: number_cell("C4", 10)},
            5: {1: text_cell("A5", "EBT"), 2: number_cell("B5", -90833), 3: number_cell("C5", -1)},
            6: {1: text_cell("A6", "Net Profit After Tax"), 2: number_cell("B6", -90833), 3: number_cell("C6", -1)},
            7: {1: text_cell("A7", "Operating Efficiency"), 2: number_cell("B7", 0.8), 3: number_cell("C7", 0.8)},
            8: {1: text_cell("A8", "Total Headcount"), 2: number_cell("B8", 10), 3: number_cell("C8", 10)},
        },
        "Monthly PPR": {
            1: {1: text_cell("A1", "Business Line"), 2: text_cell("B1", "Actual"), 3: text_cell("C1", "Plan")},
            2: {1: text_cell("A2", "Total")},
            3: {1: text_cell("A3", "Revenue"), 2: number_cell("B3", ppr_revenue), 3: number_cell("C3", 90)},
            4: {1: text_cell("A4", "Expense"), 2: number_cell("B4", ppr_expense), 3: number_cell("C4", 90)},
            5: {1: text_cell("A5", "Commercial Space"), 2: number_cell("B5", 40)},
            6: {1: text_cell("A6", "Product Factory"), 2: number_cell("B6", 20)},
            7: {1: text_cell("A7", "Center for ICT Excellence"), 2: number_cell("B7", 10)},
            8: {1: text_cell("A8", "BITC Operation"), 2: number_cell("B8", 10)},
            9: {1: text_cell("A9", "Others"), 2: number_cell("B9", 20)},
        },
        "Monthly Expense LBL": {
            1: {1: text_cell("A1", "Expense Lines"), 2: text_cell("B1", "Actual Expense"), 3: text_cell("C1", "Plan Expense")},
            2: {1: text_cell("A2", "Total Expense"), 2: number_cell("B2", expense), 3: number_cell("C2", 90)},
        },
        "Unusual extra": {1: {1: text_cell("A1", "Extra source information")}},
    }
    for name in missing:
        sheets.pop(name, None)
    workbook_xml_sheets = []
    relationships = []
    for index, name in enumerate(sheets, 1):
        escaped_name = escape(name, {'"': '&quot;'})
        workbook_xml_sheets.append(f'<sheet name="{escaped_name}" sheetId="{index}" r:id="rId{index}"/>')
        relationships.append(f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>')
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + "".join(workbook_xml_sheets) + "</sheets></workbook>")
        archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + "".join(relationships) + "</Relationships>")
        for index, rows in enumerate(sheets.values(), 1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml(rows))
    return output.getvalue()


def validate(data):
    return validator.run_validation({"file_name": "test.xlsx", "file_base64": base64.b64encode(data).decode(), "submission_id": "test-report", "company": "TTPL", "period": "August 2026", "version": 1})


def matching_schema_shape(result):
    schema = json.loads((Path(__file__).resolve().parents[2] / ".agents/skills/validation-agent/schemas/validation-result.schema.json").read_text(encoding="utf-8"))
    assert set(result).issubset(schema["properties"])
    assert all(key in result for key in schema["required"])
    assert result["validation_status"] in schema["properties"]["validation_status"]["enum"]
    check_schema = schema["properties"]["checks"]["items"]
    for item in result["checks"]:
        assert set(item).issubset(check_schema["properties"])
        assert all(key in item for key in check_schema["required"])
        assert item["status"] in check_schema["properties"]["status"]["enum"]
        assert item["severity"] in check_schema["properties"]["severity"]["enum"]
        if item["source_evidence"] is not None:
            assert set(item["source_evidence"]).issubset(check_schema["properties"]["source_evidence"]["properties"])


class TTPLValidationTests(unittest.TestCase):
    def test_required_and_unexpected_sheets_are_reported(self):
        result = validate(workbook_bytes(missing=("Monthly Expense LBL",)))
        self.assertIn("Monthly Expense LBL", result["workbook"]["sheets_missing"])
        self.assertIn("Unusual extra", result["workbook"]["unexpected_sheets"])
        self.assertTrue(any(item["rule_id"] == "FILE-002" and item["severity"] == "ERROR" for item in result["checks"]))
        self.assertEqual(result["validation_status"], "FAIL")

    def test_missing_draft_label_is_a_review_finding(self):
        result = validate(workbook_bytes(omit_revenue_label=True))
        self.assertTrue(any(item["rule_id"] == "COMP-002" for item in result["checks"]))
        self.assertEqual(result["validation_status"], "NEEDS_REVIEW")

    def test_parenthesized_negative_is_parsed_without_changing_source(self):
        self.assertEqual(validator.parse_number("(90,833)"), -90833)
        self.assertEqual(validator.parse_number("0"), 0)

    def test_variance_formula_cached_value_is_checked_against_recomputed_value(self):
        result = validate(workbook_bytes(variance=15))
        item = next(item for item in result["checks"] if item["rule_id"] == "CALC-003" and item["field"] == "Revenues")
        self.assertEqual(item["actual_value"]["raw_value"], "15")
        self.assertEqual(item["recomputed_value"], 10)
        self.assertEqual(item["difference"], 5)
        self.assertEqual(item["status"], "FAIL")

    def test_cross_sheet_total_mismatch_is_reported(self):
        result = validate(workbook_bytes(revenue=100, ppr_revenue=95))
        self.assertTrue(any(item["rule_id"] == "RECON-001" and item["severity"] == "ERROR" for item in result["checks"]))

    def test_ambiguous_millions_scale_is_flagged_without_rescaling(self):
        result = validate(workbook_bytes(scale_heading=True, revenue=13_688_890))
        self.assertTrue(any(item["rule_id"] == "DATA-003" for item in result["checks"]))
        scale = next(item for item in result["checks"] if item["rule_id"] == "DATA-003")
        self.assertEqual(scale["actual_value"]["scale"], "MILLIONS")
        self.assertEqual(result["scale_status"], "REVIEW_REQUIRED")

    def test_cell_provenance_keeps_source_and_parsed_values_separate(self):
        result = validate(workbook_bytes())
        evidence = next(item for item in result["checks"] if item["rule_id"] == "SOURCE-EVIDENCE" and item["sheet"] == "Month Financials" and item["cell"] == "B5")
        self.assertEqual(evidence["source_evidence"]["workbook"], "test.xlsx")
        self.assertEqual(evidence["actual_value"]["original_label"], "EBT")
        self.assertEqual(evidence["actual_value"]["raw_value"], "-90833")
        self.assertEqual(evidence["actual_value"]["parsed_value"], -90833)
        self.assertIsNone(evidence["actual_value"]["formula"])

    def test_result_matches_supplied_json_schema_shape(self):
        result = validate(workbook_bytes())
        matching_schema_shape(result)
        self.assertEqual(result["report_id"], "test-report")


if __name__ == "__main__":
    unittest.main()
