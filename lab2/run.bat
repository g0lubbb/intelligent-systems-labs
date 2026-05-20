@echo off
setlocal
cd /d %~dp0
if not exist .venv (
    echo Creating virtualenv...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo.
echo === Starting server at http://127.0.0.1:8000 ===
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8000
