"""Runtime configuration, read from environment variables and the repo-root .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = REPO_ROOT / "backend" / "app"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    # SQLite lives on the native filesystem: WAL locking is unreliable on Windows drives mounted in WSL.
    db_path: Path = Field(default=Path.home() / ".marrowq" / "marrowq.db", alias="MARROWQ_DB_PATH")
    data_dir: Path = Field(default=APP_DIR / "data", alias="MARROWQ_DATA_DIR")
    artifacts_dir: Path = Field(default=APP_DIR / "artifacts", alias="MARROWQ_ARTIFACTS_DIR")

    # IBM Quantum Platform: API key + instance CRN (quantum.cloud.ibm.com).
    qiskit_ibm_token: str | None = Field(default=None, alias="QISKIT_IBM_TOKEN")
    qiskit_ibm_instance: str | None = Field(default=None, alias="QISKIT_IBM_INSTANCE")
    ibm_channel: str = Field(default="ibm_quantum_platform", alias="IBM_CHANNEL")
    # Hard ceiling on estimated QPU seconds per submission; the Open Plan allows 600 s per 28 days.
    ibm_max_seconds_per_run: float = Field(default=60.0, alias="IBM_MAX_SECONDS_PER_RUN")

    worker_poll_seconds: float = Field(default=1.0, alias="MARROWQ_WORKER_POLL_SECONDS")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.db_path = settings.db_path.expanduser()
    settings.data_dir = settings.data_dir.expanduser()
    settings.artifacts_dir = settings.artifacts_dir.expanduser()
    for d in (settings.db_path.parent, settings.data_dir, settings.artifacts_dir):
        d.mkdir(parents=True, exist_ok=True)
    return settings
