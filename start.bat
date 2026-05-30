@echo off
echo Starting Video Production Dashboard...
echo.

echo [1/2] Starting Python Worker (port 8787)...
start "Python Worker" cmd /c "cd /d %~dp0worker && python -m uvicorn worker.main:app --port 8787 --reload"

timeout /t 2 /nobreak > nul

echo [2/2] Starting Next.js (port 3000)...
start "Next.js Dev" cmd /c "cd /d %~dp0web && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo Dashboard ready at: http://localhost:3000
echo Worker running at:  http://localhost:8787
echo.
pause
