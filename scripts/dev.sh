#!/usr/bin/env bash
# One-command start inside WSL: builds the frontend, then runs the API (serving the site) and the GPU worker.
#   bash scripts/dev.sh            -> http://localhost:8010
#   PORT=9000 bash scripts/dev.sh
# Public demo URL (optional): cloudflared tunnel --url http://localhost:8010
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8010}"
VENV="${VENV:-$HOME/.venvs/marrowq}"
source "$VENV/bin/activate"

if command -v npm >/dev/null 2>&1; then
  (cd "$ROOT/frontend" && npm run build --silent)
else
  echo "npm not found in WSL; build the frontend on Windows with: cd frontend && npm run build"
fi

cd "$ROOT/backend"
# GPU/CPU jobs on one worker; IBM hardware jobs on their own lane so a QPU run never waits behind a sweep.
python -m app.worker --exclude ibm_hardware_kernel &
GPU_WORKER=$!
python -m app.worker --id "$(hostname)-ibm" --kinds ibm_hardware_kernel &
IBM_WORKER=$!
trap 'kill $GPU_WORKER $IBM_WORKER 2>/dev/null' EXIT
python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
