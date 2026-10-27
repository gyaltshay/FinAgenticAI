import pytest
from backend.config import Settings
from backend.errors import ApiError
from backend.manage import test_records as run_qa_records


def test_database_qa_adapter_refuses_application_database():
    settings = Settings({"PGDATABASE": "finagenticai"})
    with pytest.raises(ApiError, match="disposable test databases"):
        run_qa_records(settings, "read-test-records", {})
