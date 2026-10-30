"""Point every test run at a throwaway database and data folders, before the app is imported."""
import os
import sys
import tempfile

_tmp = tempfile.mkdtemp(prefix="marrowq-test-")
os.environ["MARROWQ_DB_PATH"] = os.path.join(_tmp, "test.db")
os.environ["MARROWQ_DATA_DIR"] = os.path.join(_tmp, "data")
os.environ["MARROWQ_ARTIFACTS_DIR"] = os.path.join(_tmp, "artifacts")
# Never let real IBM or Anthropic credentials (from .env) reach tests or spend money.
os.environ["QISKIT_IBM_TOKEN"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
