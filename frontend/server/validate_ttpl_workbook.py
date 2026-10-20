#!/usr/bin/env python3
"""Deterministic, read-only TTPL workbook inspection for the Gemini API server.

This module uses only Python's standard library. It reads OOXML directly so
formula text and cached source values remain distinct. It never evaluates or
rewrites workbook formulas and never modifies the uploaded workbook.
"""

from __future__ import annotations

import base64
import datetime as dt
from decimal import Decimal, InvalidOperation
import json
import math
import posixpath
import re
import sys
import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from xml.etree import ElementTree as ET


MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
MAX_ENTRIES = 10_000
REQUIRED_SHEETS = ("Month Financials", "Monthly PPR", "Monthly Expense LBL")
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": DOC_REL_NS}


@dataclass
class Cell:
    coordinate: str
    raw_value: Any
    parsed_value: Any
    formula: str | None
    value_type: str
    style_id: int | None = None


@dataclass
class Sheet:
    name: str
    state: str
    cells: dict[str, Cell]
    rows: dict[int, dict[int, Cell]]
    dimensions: str | None
    hidden_rows: list[int]
    hidden_columns: list[dict[str, int]]
    merged_ranges: list[str]


class WorkbookError(ValueError):
    pass


def xml_root(data: bytes, name: str) -> ET.Element:
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise WorkbookError(f"Unsafe XML declaration in {name}.")
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise WorkbookError(f"Malformed XML in {name}.") from exc


def col_number(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference.upper())
    if not letters:
        return 0
    number = 0
    for char in letters.group(0):
        number = number * 26 + ord(char) - 64
    return number


def coordinate(row: int, col: int) -> str:
    name = ""
    while col:
        col, remainder = divmod(col - 1, 26)
        name = chr(65 + remainder) + name
    return f"{name}{row}"


def parse_number(value: Any) -> Decimal | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None
    if not isinstance(value, str):
        return None
    text = value.strip().replace("\u00a0", " ")
    if not text or text in {"—", "–", "-", "n/a", "na"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1].strip()
    text = re.sub(r"(?i)\b(?:Nu\.?|BTN)\b", "", text).strip()
    is_percent = text.endswith("%")
    if is_percent:
        text = text[:-1].strip()
    text = text.replace(",", "").replace(" ", "")
    if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", text):
        return None
    try:
        number = Decimal(text)
    except InvalidOperation:
        return None
    if not number.is_finite():
        return None
    if negative:
        number = -abs(number)
    if is_percent:
        number /= 100
    return number


def normalized_label(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.casefold().replace("\u00a0", " "))


def cell_value(value: Any) -> Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def json_number(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    return value


def style_date_ids(styles_xml: bytes | None) -> set[int]:
    if not styles_xml:
        return set()
    root = xml_root(styles_xml, "xl/styles.xml")
    custom = {}
    for item in root.findall("m:numFmts/m:numFmt", NS):
        custom[int(item.attrib["numFmtId"])] = item.attrib.get("formatCode", "")
    builtin_date_ids = set(range(14, 23)) | {27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58}
    xfs = root.find("m:cellXfs", NS)
    result = set()
    if xfs is not None:
        for index, xf in enumerate(xfs):
            num_id = int(xf.attrib.get("numFmtId", "0"))
            code = custom.get(num_id, "")
            if num_id in builtin_date_ids or (code and re.search(r"(?i)(?:y|d|mmm)", code)):
                result.add(index)
    return result


def parse_ooxml(data: bytes, workbook_name: str) -> tuple[list[Sheet], list[str]]:
    if len(data) > MAX_FILE_BYTES:
        raise WorkbookError("Workbook exceeds the 20 MB upload limit.")
    try:
        archive = zipfile.ZipFile(BytesIO(data))
    except (zipfile.BadZipFile, OSError) as exc:
        raise WorkbookError("The uploaded file is not a readable .xlsx workbook.") from exc
    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_ENTRIES or sum(item.file_size for item in infos) > MAX_ARCHIVE_BYTES:
            raise WorkbookError("Workbook archive expands beyond the supported safety limits.")
        entries = {item.filename for item in infos}
        if "xl/workbook.xml" not in entries:
            raise WorkbookError("Workbook is missing xl/workbook.xml.")

        def read(name: str) -> bytes | None:
            if name not in entries:
                return None
            return archive.read(name)

        workbook_xml = read("xl/workbook.xml") or b""
        rels_xml = read("xl/_rels/workbook.xml.rels") or b""
        workbook = xml_root(workbook_xml, "xl/workbook.xml")
        rels = xml_root(rels_xml, "xl/_rels/workbook.xml.rels")
        targets = {}
        for rel in rels.findall(f"{{{PKG_REL_NS}}}Relationship"):
            target = rel.attrib.get("Target", "")
            if target.startswith("/"):
                resolved = target.lstrip("/")
            else:
                resolved = posixpath.normpath(posixpath.join("xl", target))
            targets[rel.attrib.get("Id", "")] = resolved

        shared = []
        shared_xml = read("xl/sharedStrings.xml")
        if shared_xml:
            shared_root = xml_root(shared_xml, "xl/sharedStrings.xml")
            for item in shared_root.findall("m:si", NS):
                shared.append("".join(part.text or "" for part in item.findall(".//m:t", NS)))

        date_ids = style_date_ids(read("xl/styles.xml"))
        sheets = []
        for sheet_node in workbook.findall("m:sheets/m:sheet", NS):
            name = sheet_node.attrib.get("name", "")
            target = targets.get(sheet_node.attrib.get(f"{{{DOC_REL_NS}}}id", ""))
            if not name or not target or target not in entries:
                raise WorkbookError(f"Cannot resolve worksheet XML for {name or '(unnamed sheet)' }.")
            root = xml_root(read(target) or b"", target)
            dimension_node = root.find("m:dimension", NS)
            sheet_cells: dict[str, Cell] = {}
            rows: dict[int, dict[int, Cell]] = {}
            hidden_rows = []
            hidden_columns = []
            for row_node in root.findall("m:sheetData/m:row", NS):
                row_number = int(row_node.attrib.get("r", "0"))
                if row_node.attrib.get("hidden", "0") == "1":
                    hidden_rows.append(row_number)
                row_cells: dict[int, Cell] = {}
                for node in row_node.findall("m:c", NS):
                    ref = node.attrib.get("r", "")
                    if not ref:
                        continue
                    col = col_number(ref)
                    kind = node.attrib.get("t", "n")
                    style = int(node.attrib["s"]) if node.attrib.get("s", "").isdigit() else None
                    fnode = node.find("m:f", NS)
                    vnode = node.find("m:v", NS)
                    formula = f"={fnode.text}" if fnode is not None and fnode.text is not None else None
                    raw_text = vnode.text if vnode is not None else None
                    raw: Any
                    value_type = kind
                    if kind == "inlineStr":
                        raw = "".join(part.text or "" for part in node.findall(".//m:t", NS))
                        value_type = "string"
                    elif kind == "s":
                        try:
                            raw = shared[int(raw_text or "")]
                        except (ValueError, IndexError):
                            raw = raw_text
                            value_type = "invalid-shared-string"
                        else:
                            value_type = "string"
                    elif kind == "b":
                        raw = raw_text == "1"
                        value_type = "boolean"
                    elif kind == "e":
                        raw = raw_text
                        value_type = "error"
                    elif kind == "str":
                        raw = raw_text
                        value_type = "string"
                    elif raw_text is None:
                        raw = None
                        value_type = "formula-without-cache" if formula else "blank"
                    else:
                        try:
                            numeric = Decimal(raw_text)
                            raw = raw_text
                            value_type = "number"
                            if style in date_ids:
                                parsed = dt.datetime(1899, 12, 30) + dt.timedelta(days=float(numeric))
                                raw = raw_text
                                parsed_value = parsed.date().isoformat()
                                value_type = "date"
                            else:
                                parsed_value = numeric
                        except (ValueError, InvalidOperation, OverflowError):
                            raw = raw_text
                            value_type = "string"
                    if value_type != "date":
                        parsed_value = parse_number(raw) if value_type in {"number", "string"} else raw
                    cell = Cell(ref, raw, parsed_value, formula, value_type, style)
                    sheet_cells[ref] = cell
                    row_cells[col] = cell
                if row_cells:
                    rows[row_number] = row_cells
            for col_node in root.findall("m:cols/m:col", NS):
                if col_node.attrib.get("hidden", "0") == "1":
                    hidden_columns.append({"min": int(col_node.attrib.get("min", "0")), "max": int(col_node.attrib.get("max", "0"))})
            merged = [node.attrib.get("ref", "") for node in root.findall("m:mergeCells/m:mergeCell", NS)]
            sheets.append(Sheet(name, sheet_node.attrib.get("state", "visible"), sheet_cells, rows, dimension_node.attrib.get("ref") if dimension_node is not None else None, hidden_rows, hidden_columns, merged))

        defined = workbook.find("m:definedNames", NS)
        named_ranges = []
        if defined is not None:
            named_ranges = [
                {"name": item.attrib.get("name", ""), "local_sheet_id": item.attrib.get("localSheetId"), "formula": item.text or ""}
                for item in defined.findall("m:definedName", NS)
            ]
        return sheets, named_ranges


def row_text(sheet: Sheet, row_number: int) -> list[tuple[int, Cell]]:
    values = []
    for col, cell in sorted(sheet.rows.get(row_number, {}).items()):
        if isinstance(cell.raw_value, str) and cell.raw_value.strip():
            values.append((col, cell))
    return values


def row_label(sheet: Sheet, row_number: int) -> tuple[int, Cell] | None:
    for col, cell in sorted(sheet.rows.get(row_number, {}).items()):
        if isinstance(cell.raw_value, str) and cell.raw_value.strip():
            if cell.parsed_value is None or cell.value_type == "string":
                return col, cell
    return None


def matches_alias(label: str, aliases: tuple[str, ...]) -> bool:
    normalized = normalized_label(label)
    return normalized in {normalized_label(alias) for alias in aliases}


def label_rows(sheet: Sheet, aliases: tuple[str, ...]) -> list[tuple[int, int, Cell]]:
    found = []
    for row_number in sorted(sheet.rows):
        label = row_label(sheet, row_number)
        if label and matches_alias(str(label[1].raw_value), aliases):
            found.append((row_number, label[0], label[1]))
    return found


def header_context(sheet: Sheet, row_number: int, col: int) -> str:
    chunks = []
    for preceding in range(max(1, row_number - 6), row_number):
        cell = sheet.rows.get(preceding, {}).get(col)
        if cell and isinstance(cell.raw_value, (str, dt.date)):
            chunks.append(str(cell.raw_value))
    return " ".join(chunks).casefold()


def classify_header(header: str) -> str | None:
    text = normalized_label(header)
    if not text:
        return None
    if "variance" in text or "i/(d)" in header.casefold():
        return "variance"
    if "previousmonth" in text or "priormonth" in text:
        return "previous_month"
    if "previousyear" in text or "prioryear" in text or "samesmonthpreviousyear" in text or "samesmonthlastyear" in text:
        return "prior_year"
    if "plan" in text or "budget" in text:
        return "plan"
    if "actual" in text:
        return "actual"
    return None


def data_columns(sheet: Sheet, row_number: int) -> dict[str, list[int]]:
    result: dict[str, list[int]] = {}
    max_col = max((max(row) for row in sheet.rows.values() if row), default=0)
    for col in range(1, max_col + 1):
        context = header_context(sheet, row_number, col)
        role = classify_header(context)
        if role:
            result.setdefault(role, []).append(col)
    return result


def nearest_total_revenue_row(sheet: Sheet, candidates: list[tuple[int, int, Cell]]) -> tuple[int, int, Cell] | None:
    exact = [item for item in candidates if normalized_label(str(item[2].raw_value)) in {"totalrevenue", "revenues"}]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        return None
    contextual = []
    for item in candidates:
        row_number = item[0]
        prior_labels = [normalized_label(str(row_label(sheet, r)[1].raw_value)) for r in range(max(1, row_number - 3), row_number) if row_label(sheet, r)]
        if "total" in prior_labels[-2:]:
            contextual.append(item)
    return contextual[0] if len(contextual) == 1 else None


def finding(rule_id: str, severity: str, message: str, source_location: str = "", suggested_fix: str = "") -> dict[str, Any]:
    return {
        "rule_id": rule_id,
        "severity": severity,
        "field": None,
        "expected": None,
        "actual": None,
        "difference": None,
        "message": message,
        "suggested_fix": suggested_fix,
        "source_location": source_location,
    }


def value_record(workbook_name: str, sheet: Sheet, row_number: int, col: int, label: str | None, cell: Cell | None, role: str | None = None) -> dict[str, Any]:
    return {
        "workbook_name": workbook_name,
        "sheet_name": sheet.name,
        "cell_coordinate": cell.coordinate if cell else coordinate(row_number, col),
        "original_label": label,
        "raw_value": cell.raw_value if cell else None,
        "parsed_value": json_number(cell.parsed_value) if cell else None,
        "formula": cell.formula if cell else None,
        "source_type": cell.value_type if cell else "blank",
        "column_role": role,
    }


DRAFT_LABELS = {
    "Month Financials": {
        "revenue": ("Revenue", "Revenues", "Total Revenue"),
        "expenses": ("Expenses", "Expense", "Total Expenses", "Total Expense"),
        "margin": ("Margin",),
        "ebt": ("EBT", "Earnings Before Tax", "Earnings Before Income Tax"),
        "net_profit_after_tax": ("Net Profit After Tax", "Profit After Tax", "PAT"),
        "operating_efficiency": ("Operating Efficiency", "Operating Efficiency %"),
        "headcount": ("Headcount", "Total Headcount"),
    },
    "Monthly PPR": {
        "commercial_space": ("Commercial Space", "Rental Space"),
        "product_factory": ("Product Factory",),
        "center_for_ict_excellence": ("Center for ICT Excellence", "Centre for ICT Excellence"),
        "bitc_operation": ("BITC Operation", "BITC Operations"),
        "others": ("Others", "Other Income"),
        "total_revenue": ("Total Revenue", "Revenues", "Revenue"),
    },
    "Monthly Expense LBL": {
        "expense_total": ("Total Expense", "Total Expenses", "Total Expense / Margin", "Total Expenses / Margin"),
    },
}


def parse_workbook_input(payload: dict[str, Any]) -> tuple[list[Sheet], list[str], bytes, str]:
    filename = payload.get("file_name")
    encoded = payload.get("file_base64")
    if not isinstance(filename, str) or not filename.strip() or not filename.casefold().endswith(".xlsx"):
        raise WorkbookError("Provide a named .xlsx workbook.")
    if not isinstance(encoded, str):
        raise WorkbookError("Workbook bytes are missing.")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise WorkbookError("Workbook bytes are not valid base64.") from exc
    sheets, named_ranges = parse_ooxml(data, filename)
    return sheets, named_ranges, data, filename


def run_validation(payload: dict[str, Any]) -> dict[str, Any]:
    sheets, named_ranges, data, filename = parse_workbook_input(payload)
    by_name = {sheet.name: sheet for sheet in sheets}
    findings: list[dict[str, Any]] = []
    checks: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    missing = [name for name in REQUIRED_SHEETS if name not in by_name]
    unexpected = [sheet.name for sheet in sheets if sheet.name not in REQUIRED_SHEETS]
    for name in missing:
        findings.append(finding("FILE-002", "ERROR", f"Required worksheet is missing: {name}.", suggested_fix=f"Add or identify the approved worksheet named exactly '{name}'."))
    for name in unexpected:
        findings.append(finding("FILE-003", "WARNING", f"Unexpected worksheet found: {name}. Extra sheets are reported but are not rejected by this draft rule."))

    structure = []
    for sheet in sheets:
        structure.append({
            "name": sheet.name,
            "state": sheet.state,
            "dimension": sheet.dimensions,
            "populated_cell_count": len(sheet.cells),
            "formula_count": sum(cell.formula is not None for cell in sheet.cells.values()),
            "hidden_rows": sheet.hidden_rows,
            "hidden_columns": sheet.hidden_columns,
            "merged_ranges": sheet.merged_ranges,
        })
        if sheet.state != "visible":
            findings.append(finding("FILE-003", "WARNING", f"Worksheet is hidden or otherwise not visible: {sheet.name}."))
        if sheet.hidden_rows or sheet.hidden_columns or sheet.merged_ranges:
            findings.append(finding("FILE-003", "INFO", f"Worksheet structure includes hidden rows/columns or merged ranges: {sheet.name}."))

    required_value_records: dict[str, list[dict[str, Any]]] = {}
    for sheet_name, expected_by_key in DRAFT_LABELS.items():
        sheet = by_name.get(sheet_name)
        if not sheet:
            continue
        for key, aliases in expected_by_key.items():
            matches = []
            for row_number in sorted(sheet.rows):
                label = row_label(sheet, row_number)
                if label and matches_alias(str(label[1].raw_value), aliases):
                    matches.append((row_number, label[0], label[1]))
            if not matches:
                findings.append(finding("COMP-002", "WARNING", f"Draft reference label '{key}' was not found in {sheet_name}; confirm the label mapping against the original TTPL workbook."))
                checks.append({"rule_id": "COMP-002", "status": "REVIEW_REQUIRED", "field": key, "source_value": None, "recomputed_value": None, "difference": None})
                continue
            if len(matches) > 1:
                findings.append(finding("REVIEW-002", "WARNING", f"Draft label '{key}' has multiple possible rows in {sheet_name}; row mapping is ambiguous."))
                checks.append({"rule_id": "COMP-002", "status": "REVIEW_REQUIRED", "field": key, "source_value": None, "recomputed_value": None, "difference": None})
                continue
            row_number, label_col, label_cell = matches[0]
            label_text = str(label_cell.raw_value)
            columns = data_columns(sheet, row_number)
            row_records = []
            for role, cols in columns.items():
                for col in cols:
                    cell = sheet.rows.get(row_number, {}).get(col)
                    record = value_record(filename, sheet, row_number, col, label_text, cell, role)
                    records.append(record)
                    row_records.append(record)
                    if cell is None or cell.raw_value is None or cell.raw_value == "":
                        findings.append(finding("COMP-003", "ERROR", f"Required {role.replace('_', ' ')} value is blank for '{label_text}'.", f"{sheet.name}!{coordinate(row_number, col)}", "Provide the required value or correct the workbook mapping."))
                        checks.append({"rule_id": "COMP-003", "status": "FAIL", "field": key, "source_value": None, "recomputed_value": None, "difference": None})
                    elif role in {"actual", "plan", "previous_month", "prior_year"} and cell.parsed_value is None:
                        findings.append(finding("DATA-001", "ERROR", f"Value for '{label_text}' is not in a recognized numeric or approved numeric-text format.", f"{sheet.name}!{cell.coordinate}", "Provide the value in a supported numeric format; the validator will not correct it automatically."))
            required_value_records[key] = row_records
            if not row_records:
                findings.append(finding("COMP-003", "WARNING", f"No period/value columns could be identified for draft label '{label_text}' in {sheet_name}."))

    # Capture the source label and every non-empty value/formula beside each
    # recognized draft metric, retaining blanks for detected period columns.
    monetary_records = [record for record in records if record.get("column_role") in {"actual", "plan", "previous_month", "prior_year"} and isinstance(record.get("parsed_value"), (int, float))]

    scale_text = " ".join(str(cell.raw_value) for sheet in sheets for cell in sheet.cells.values() if isinstance(cell.raw_value, str)).casefold()
    currency = "BTN" if re.search(r"\bbtn\b", scale_text) else "Nu" if re.search(r"\bnu\.?\b", scale_text) else None
    scale = "MILLIONS" if "million" in scale_text else "THOUSANDS" if "thousand" in scale_text else None
    scale_ambiguous = not scale or (scale == "MILLIONS" and any(abs(Decimal(str(item["parsed_value"]))) >= 1000 for item in monetary_records))
    if not currency or scale_ambiguous:
        findings.append(finding("DATA-003", "WARNING", "Currency or reporting scale is missing or ambiguous. No automatic rescaling was applied.", suggested_fix="Confirm the currency and whether values are full Nu, thousands, or millions."))
        checks.append({"rule_id": "DATA-003", "status": "REVIEW_REQUIRED", "field": "currency_scale", "source_value": {"currency": currency, "scale": scale}, "recomputed_value": None, "difference": None})

    # Reconcile totals only where a unique row and a unique period-matched
    # actual column can be identified by workbook labels and headers.
    def unique_total(sheet_name: str, aliases: tuple[str, ...], context_total: bool = False) -> tuple[Sheet, int, Cell] | None:
        sheet = by_name.get(sheet_name)
        if not sheet:
            return None
        candidates = label_rows(sheet, aliases)
        if sheet_name == "Monthly PPR" and context_total:
            selected = nearest_total_revenue_row(sheet, candidates)
            return (sheet, selected[0], selected[2]) if selected else None
        if len(candidates) != 1:
            return None
        return sheet, candidates[0][0], candidates[0][2]

    def unique_actual(item: tuple[Sheet, int, Cell] | None) -> tuple[Cell | None, str]:
        if not item:
            return None, ""
        sheet, row, _ = item
        cols = data_columns(sheet, row).get("actual", [])
        if len(cols) != 1:
            return None, ""
        cell = sheet.rows.get(row, {}).get(cols[0])
        return cell, f"{sheet.name}!{coordinate(row, cols[0])}"

    metrics = [
        ("revenue", "RECON-001", unique_total("Month Financials", ("Revenues", "Total Revenue", "Revenue")), unique_total("Monthly PPR", ("Total Revenue", "Revenues", "Revenue"), True)),
        ("expenses", "RECON-002", unique_total("Month Financials", ("Expenses", "Total Expenses", "Total Expense")), unique_total("Monthly PPR", ("Expenses", "Total Expenses", "Expense"), True)),
    ]
    for metric, rule_id, left, right in metrics:
        left_cell, left_location = unique_actual(left)
        right_cell, right_location = unique_actual(right)
        if left_cell and right_cell and isinstance(left_cell.parsed_value, Decimal) and isinstance(right_cell.parsed_value, Decimal):
            difference = left_cell.parsed_value - right_cell.parsed_value
            checks.append({"rule_id": rule_id, "status": "PASS" if abs(difference) <= Decimal("0.01") else "FAIL", "field": metric, "source_value": json_number(left_cell.parsed_value), "recomputed_value": json_number(right_cell.parsed_value), "difference": json_number(difference)})
            if abs(difference) > 0.01:
                findings.append(finding(rule_id, "ERROR", f"Cross-sheet {metric} totals differ by {difference} between matching actual columns.", f"{left_location} / {right_location}", "Reconcile the source totals and confirm both rows use the same period, currency, scale, and definition."))
        else:
            checks.append({"rule_id": rule_id, "status": "NOT_CHECKED", "field": metric, "source_value": None, "recomputed_value": None, "difference": None})
            findings.append(finding(rule_id, "WARNING", f"Cross-sheet {metric} reconciliation could not be run because a unique matching total row and actual-period column were not confirmed."))

    # Compare explicit same-row Actual - Plan formulas to a deterministic
    # subtraction of their referenced source values. No formula is executed.
    for sheet in sheets:
        for row_number in sorted(sheet.rows):
            label = row_label(sheet, row_number)
            if not label:
                continue
            roles = data_columns(sheet, row_number)
            actual_cols, plan_cols = roles.get("actual", []), roles.get("plan", [])
            if len(actual_cols) != 1 or len(plan_cols) != 1:
                continue
            actual_cell = sheet.rows.get(row_number, {}).get(actual_cols[0])
            plan_cell = sheet.rows.get(row_number, {}).get(plan_cols[0])
            if not actual_cell or not plan_cell or not isinstance(actual_cell.parsed_value, Decimal) or not isinstance(plan_cell.parsed_value, Decimal):
                continue
            expected = actual_cell.parsed_value - plan_cell.parsed_value
            formula_cells = []
            for cell in sheet.rows.get(row_number, {}).values():
                if not cell.formula:
                    continue
                formula_body = re.sub(r"\s+", "", cell.formula.lstrip("=")).upper()
                refs = lambda col: rf"\$?{re.escape(''.join(ch for ch in coordinate(row_number, col) if ch.isalpha()))}\$?{row_number}"
                if re.fullmatch(refs(actual_cols[0]) + r"-" + refs(plan_cols[0]), formula_body):
                    formula_cells.append(cell)
            for cell in formula_cells:
                if isinstance(cell.parsed_value, Decimal):
                    difference = cell.parsed_value - expected
                    status = "PASS" if abs(difference) <= Decimal("0.01") else "FAIL"
                    checks.append({"rule_id": "CALC-003", "status": status, "field": str(label[1].raw_value), "source_value": json_number(cell.parsed_value), "recomputed_value": json_number(expected), "difference": json_number(difference)})
                    if status == "FAIL":
                        findings.append(finding("CALC-003", "ERROR", f"Cached Actual - Plan variance for '{label[1].raw_value}' differs from deterministic recomputation by {difference}.", f"{sheet.name}!{cell.coordinate}", "Review the source formula and the underlying actual and plan values."))

    # The draft source rules call out EBT=NPAT without visible tax as a review
    # flag. Do this only when both values are uniquely located and numeric.
    financials = by_name.get("Month Financials")
    if financials:
        ebt = label_rows(financials, ("EBT", "Earnings Before Tax", "Earnings Before Income Tax"))
        npat = label_rows(financials, ("Net Profit After Tax", "Profit After Tax", "PAT"))
        if len(ebt) == 1 and len(npat) == 1:
            ebt_roles = data_columns(financials, ebt[0][0])
            npat_roles = data_columns(financials, npat[0][0])
            ea, na = ebt_roles.get("actual", []), npat_roles.get("actual", [])
            ebt_cell = financials.rows.get(ebt[0][0], {}).get(ea[0]) if len(ea) == 1 else None
            npat_cell = financials.rows.get(npat[0][0], {}).get(na[0]) if len(na) == 1 else None
            if ebt_cell and npat_cell and ebt_cell.parsed_value == npat_cell.parsed_value:
                findings.append(finding("RECON-005", "WARNING", "EBT equals net profit after tax in the matched actual columns; confirm tax treatment because no visible tax calculation has been confirmed.", f"{financials.name}!{ebt_cell.coordinate} / {financials.name}!{npat_cell.coordinate}", "Finance should confirm the tax line and treatment."))

    summary = {
        "errors": sum(item["severity"] == "ERROR" for item in findings),
        "warnings": sum(item["severity"] == "WARNING" for item in findings),
        "info": sum(item["severity"] == "INFO" for item in findings),
        "rules_run": len(checks),
    }
    # FILE-003 observations (including extra/hidden sheets) are explicitly
    # non-blocking in the TTPL draft rules. Keep them visible without sending
    # otherwise complete reports to a finance officer for validation.
    requires_human_review = any(item["rule_id"] != "FILE-003" and item["severity"] in {"WARNING", "INFO"} for item in findings) or any(check["rule_id"] != "FILE-003" and check["status"] in {"REVIEW_REQUIRED", "NOT_CHECKED"} for check in checks)
    validation_status = "FAIL" if summary["errors"] else "NEEDS_REVIEW" if requires_human_review else "PASS"

    def evidence(location: str | None) -> tuple[str | None, str | None, dict[str, Any] | None]:
        match = re.match(r"^(.+?)!([A-Z]+[0-9]+)", location or "")
        if not match:
            return None, None, None
        sheet_name, cell_ref = match.groups()
        source = next((item for item in records if item["sheet_name"] == sheet_name and item["cell_coordinate"] == cell_ref), None)
        return sheet_name, cell_ref, source

    output_checks: list[dict[str, Any]] = []
    for check in checks:
        rule_id = str(check.get("rule_id", "UNKNOWN"))
        status = check.get("status") if check.get("status") in {"PASS", "FAIL", "WARNING", "REVIEW_REQUIRED", "NOT_CHECKED"} else "NOT_CHECKED"
        severity = "ERROR" if status == "FAIL" else "WARNING" if status in {"WARNING", "REVIEW_REQUIRED", "NOT_CHECKED"} else "INFO"
        field_name = check.get("field")
        loc = next((item.get("source_location") for item in findings if item.get("rule_id") == rule_id and item.get("source_location")), None)
        sheet_name, cell_ref, source = evidence(loc)
        output_checks.append({
            "rule_id": rule_id,
            "field": str(field_name) if field_name is not None else None,
            "sheet": sheet_name,
            "cell": cell_ref,
            "status": status,
            "severity": severity,
            "expected_value": check.get("expected_value"),
            "actual_value": {"raw_value": source["raw_value"], "parsed_value": source["parsed_value"], "original_label": source["original_label"]} if source else check.get("source_value"),
            "recomputed_value": check.get("recomputed_value"),
            "difference": check.get("difference"),
            "message": next((item["message"] for item in findings if item.get("rule_id") == rule_id), f"Deterministic check {rule_id} completed with status {status}."),
            "source_evidence": {"workbook": filename, "sheet": sheet_name, "cell": cell_ref, "formula": source["formula"] if source else None, "raw_value": source["raw_value"] if source else None} if sheet_name or source else None,
            "requires_human_review": rule_id != "FILE-003" and (status in {"WARNING", "REVIEW_REQUIRED", "NOT_CHECKED"} or severity in {"WARNING", "ERROR", "CRITICAL"}),
        })
    for item in findings:
        if not any(check["rule_id"] == item["rule_id"] and check["message"] == item["message"] for check in output_checks):
            sheet_name, cell_ref, source = evidence(item.get("source_location"))
            output_checks.append({
                "rule_id": item["rule_id"], "field": item.get("field"), "sheet": sheet_name, "cell": cell_ref,
                "status": "FAIL" if item["severity"] in {"ERROR", "CRITICAL"} else "REVIEW_REQUIRED" if item["severity"] == "WARNING" else "PASS",
                "severity": item["severity"], "expected_value": item.get("expected"),
                "actual_value": {"raw_value": source["raw_value"], "parsed_value": source["parsed_value"], "original_label": source["original_label"]} if source else item.get("actual"),
                "recomputed_value": None, "difference": item.get("difference"), "message": item["message"],
                "source_evidence": {"workbook": filename, "sheet": sheet_name, "cell": cell_ref, "formula": source["formula"] if source else None, "raw_value": source["raw_value"] if source else None} if sheet_name or source else None,
                "requires_human_review": item["rule_id"] != "FILE-003" and item["severity"] in {"WARNING", "ERROR", "CRITICAL"},
            })
    # The schema has no separate evidence collection, so retain each captured
    # source value as a provenance-only check without implying it was validated.
    for source in records:
        output_checks.append({
            "rule_id": "SOURCE-EVIDENCE", "field": source["original_label"], "sheet": source["sheet_name"], "cell": source["cell_coordinate"],
            "status": "NOT_CHECKED", "severity": "INFO", "expected_value": None,
            "actual_value": {"original_label": source["original_label"], "raw_value": source["raw_value"], "parsed_value": source["parsed_value"], "formula": source["formula"], "source_type": source["source_type"], "column_role": source["column_role"]},
            "recomputed_value": None, "difference": None, "message": "Source value captured for traceability; this provenance record is not a validation result.",
            "source_evidence": {"workbook": filename, "sheet": source["sheet_name"], "cell": source["cell_coordinate"], "formula": source["formula"], "raw_value": source["raw_value"]},
            "requires_human_review": False,
        })
    return {
        "report_id": str(payload.get("submission_id") or f"{filename}:{payload.get('version', 1)}"),
        "reporting_period": payload.get("period_id", payload.get("period")),
        "currency": currency,
        "scale_status": "REVIEW_REQUIRED" if not currency or scale_ambiguous else "CONFIRMED" if scale else "UNKNOWN",
        "validation_status": validation_status,
        "workbook": {"filename": filename, "sheets_found": [sheet.name for sheet in sheets], "sheets_missing": missing, "unexpected_sheets": unexpected},
        "checks": output_checks,
    }


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise WorkbookError("Request body must be a JSON object.")
        result = run_validation(payload)
        json.dump(result, sys.stdout, ensure_ascii=False, allow_nan=False, default=json_number)
        sys.stdout.write("\n")
    except WorkbookError as exc:
        json.dump({"error": str(exc)}, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        raise SystemExit(2)
    except Exception:
        json.dump({"error": "Deterministic workbook validation failed unexpectedly."}, sys.stdout)
        sys.stdout.write("\n")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
