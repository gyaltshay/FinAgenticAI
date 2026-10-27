"""Call the existing validator in Python without changing its financial rules."""
import importlib.util
import json
import sys
from jsonschema import Draft202012Validator
from .config import ROOT
from .errors import ApiError

_spec = importlib.util.spec_from_file_location("finagentic_workbook_validator", ROOT / "frontend/server/validate_ttpl_workbook.py")
validator = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = validator
_spec.loader.exec_module(validator)
schema = json.loads((ROOT / ".agents/skills/validation-agent/schemas/validation-result.schema.json").read_text(encoding="utf-8"))
contract = Draft202012Validator(schema)


def validate_result(result):
    error = next(contract.iter_errors(result), None)
    if error:
        raise ApiError("Validation result does not match validation-result.schema.json.", 422)
    return result


def validate_workbook(item):
    if not (isinstance(item.get("fileName"), str) and item["fileName"].lower().endswith(".xlsx") and
            isinstance(item.get("fileBase64"), str) and isinstance(item.get("period"), str) and isinstance(item.get("company"), str)):
        raise ApiError("Provide an .xlsx file, company, and reporting period.")
    try:
        result = validator.run_validation({"file_name": item["fileName"], "file_base64": item["fileBase64"],
                                           "submission_id": item.get("submissionId"), "version": item.get("version", 1),
                                           "company_id": item["company"], "period_id": item["period"]})
        normalized = json.loads(json.dumps(result, ensure_ascii=False, allow_nan=False, default=validator.json_number))
        return validate_result(normalized)
    except validator.WorkbookError as error:
        raise ApiError(str(error), 422) from None
    except ApiError:
        raise
    except Exception:
        raise ApiError("Could not validate the workbook. Check the file and validation schema.", 502) from None
