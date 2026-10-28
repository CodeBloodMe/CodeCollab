@echo off
REM ==============================================================================
REM CodeForge AWS Multi-AZ Cluster Shutdown Script
REM VIT BCSE355L - Cloud Architecture Design QP 1
REM ==============================================================================

echo [CodeForge AWS] Stopping Multi-AZ Cluster processes...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 :5001 :5002"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [CodeForge AWS] Cluster stopped successfully.

