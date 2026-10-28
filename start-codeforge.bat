@echo off
echo ====================================================
echo Starting CodeForge Collaborative Platform
echo ====================================================

echo [1/3] Ensuring PostgreSQL database is active...
wsl -d Ubuntu -e docker start codeforge-db >nul 2>&1
if errorlevel 1 (
    echo Starting PostgreSQL container...
    wsl -d Ubuntu -e docker run -d --name codeforge-db -p 5432:5432 -e POSTGRES_USER=codeforge -e POSTGRES_PASSWORD=codeforge_password -e POSTGRES_DB=codeforge_db postgres:16-alpine
)

echo [2/3] Launching Backend Server on http://localhost:5000 ...
start "CodeForge Backend" cmd /k "cd /d %~dp0server && node server.js"

echo [3/3] Launching Frontend Web IDE on http://localhost:5173 ...
start "CodeForge Frontend" cmd /k "cd /d %~dp0client && npm run dev"

echo ====================================================
echo CodeForge is live!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:5000
echo ====================================================
pause

