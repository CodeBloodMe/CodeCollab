@echo off
echo ====================================================
echo Stopping CodeForge Local Services
echo ====================================================

wsl -d Ubuntu -e docker stop codeforge-db

echo PostgreSQL container stopped.
pause

