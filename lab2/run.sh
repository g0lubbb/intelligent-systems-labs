#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
    echo "Creating virtualenv..."
    python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
echo
echo "=== Starting server at http://127.0.0.1:8000 ==="
echo
exec python -m uvicorn server:app --host 127.0.0.1 --port 8000
