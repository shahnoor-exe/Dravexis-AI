"""
tests/test_sandbox_validation.py — Tests for sandbox schema validation and AST safety checks.

All tests are fully offline — no Docker, no model required.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.agent.sandbox import validate_code_schema, _check_ast, execute


class TestSchemaValidation:

    def test_valid_payload_passes(self):
        payload = {
            "code": "result = 1 + 1\nprint(result)",
            "declared_inputs": {},
            "expected_outputs": ["result"],
            "language": "python",
        }
        valid, err = validate_code_schema(payload)
        assert valid is True
        assert err == ""

    def test_missing_code_field(self):
        payload = {
            "declared_inputs": {},
            "expected_outputs": ["result"],
            "language": "python",
        }
        valid, err = validate_code_schema(payload)
        assert valid is False
        assert "code" in err

    def test_missing_language_field(self):
        payload = {
            "code": "x = 1",
            "declared_inputs": {},
            "expected_outputs": [],
        }
        valid, err = validate_code_schema(payload)
        assert valid is False

    def test_unsupported_language_rejected(self):
        payload = {
            "code": "x = 1",
            "declared_inputs": {},
            "expected_outputs": [],
            "language": "javascript",
        }
        valid, err = validate_code_schema(payload)
        assert valid is False
        assert "javascript" in err.lower() or "Only Python" in err

    def test_code_must_be_string(self):
        payload = {
            "code": 12345,
            "declared_inputs": {},
            "expected_outputs": [],
            "language": "python",
        }
        valid, err = validate_code_schema(payload)
        assert valid is False


class TestASTSafety:

    def test_allowed_import_passes(self):
        from src.config import settings
        code = "import math\nresult = math.pi"
        ok, err = _check_ast(code, list(settings.sandbox_allowed_imports))
        assert ok is True

    def test_forbidden_os_import_rejected(self):
        from src.config import settings
        code = "import os\nprint(os.listdir('/'))"
        ok, err = _check_ast(code, list(settings.sandbox_allowed_imports))
        assert ok is False
        assert "os" in err

    def test_subprocess_import_rejected(self):
        from src.config import settings
        code = "import subprocess\nsubprocess.run(['ls'])"
        ok, err = _check_ast(code, list(settings.sandbox_allowed_imports))
        assert ok is False

    def test_network_import_rejected(self):
        from src.config import settings
        code = "import socket\ns = socket.socket()"
        ok, err = _check_ast(code, list(settings.sandbox_allowed_imports))
        assert ok is False

    def test_sys_attribute_access_rejected(self):
        from src.config import settings
        code = "import sys\nprint(sys.argv)"
        ok, err = _check_ast(code, list(settings.sandbox_allowed_imports))
        assert ok is False

    def test_syntax_error_rejected(self):
        from src.config import settings
        code = "def broken(:\n    pass"
        ok, err = _check_ast(code, list(settings.sandbox_allowed_imports))
        assert ok is False
        assert "SyntaxError" in err


class TestSandboxExecution:

    def test_valid_calculation_runs(self):
        payload = {
            "code": (
                "import math\n"
                "corrosion_rate = 0.3\n"
                "thickness = 8.5\n"
                "min_t = 6.0\n"
                "remaining = (thickness - min_t) / corrosion_rate\n"
                "print(f'Remaining life: {remaining:.1f} years')\n"
            ),
            "declared_inputs": {"corrosion_rate": 0.3, "thickness": 8.5, "min_t": 6.0},
            "expected_outputs": ["remaining"],
            "language": "python",
        }
        result = execute(payload)
        assert result["exit_code"] == 0
        assert "Remaining life" in result["stdout"]
        assert result["mode"] in ("DEGRADED_SANDBOX", "docker")

    def test_schema_error_rejected_before_execution(self):
        payload = {
            "code": "x = 1",
            "declared_inputs": {},
            "expected_outputs": [],
            "language": "javascript",  # invalid
        }
        result = execute(payload)
        assert result["exit_code"] == -2
        assert result["mode"] == "rejected"
        assert "SCHEMA_VALIDATION_FAILED" in result.get("error", "")

    def test_forbidden_import_rejected_before_execution(self):
        payload = {
            "code": "import os\nprint(os.listdir('.'))",
            "declared_inputs": {},
            "expected_outputs": [],
            "language": "python",
        }
        result = execute(payload)
        assert result["exit_code"] == -3
        assert result["mode"] == "rejected"
        assert "AST_VALIDATION_FAILED" in result.get("error", "")

    def test_invalid_code_captured_in_stderr(self):
        payload = {
            "code": "result = 1 / 0\n",
            "declared_inputs": {},
            "expected_outputs": ["result"],
            "language": "python",
        }
        result = execute(payload)
        assert result["exit_code"] != 0
        assert "ZeroDivisionError" in result.get("stderr", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
