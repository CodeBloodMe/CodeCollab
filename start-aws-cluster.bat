@echo off
REM ==============================================================================
REM CodeForge AWS Multi-AZ Cluster Startup Script
REM VIT BCSE355L - Cloud Architecture Design QP 1
REM ==============================================================================

echo [CodeForge AWS] Starting Multi-AZ Dual Instance Cluster...

REM 1. Ensure PostgreSQL is active
wsl -u root -d Ubuntu docker start codeforge-db >nul 2>&1

cd /d "%~dp0server"

REM 2. Launch Server 1 (us-east-1a) on port 5001
set PORT=5001
set INSTANCE_ID=ec2-server1-us-east-1a
set INSTANCE_ROLE=Primary Compute Node (Server 1)
set AZ_ZONE=us-east-1a
set DATABASE_URL=postgres://codeforge:codeforge_password@localhost:5432/codeforge_db
start "CodeForge-Server1-5001" /min cmd /c "node server.js"

REM 3. Launch Server 2 (us-east-1b) on port 5002
set PORT=5002
set INSTANCE_ID=ec2-server2-us-east-1b
set INSTANCE_ROLE=Secondary Compute Node (Server 2)
set AZ_ZONE=us-east-1b
set DATABASE_URL=postgres://codeforge:codeforge_password@localhost:5432/codeforge_db
start "CodeForge-Server2-5002" /min cmd /c "node server.js"

REM Wait 2 seconds for backend instances to initialize
timeout /t 2 /nobreak >nul

REM 4. Launch ALB Load Balancer on port 5000
set ALB_PORT=5000
start "CodeForge-ALB-5000" /min cmd /c "node albSimulator.js"

echo.
echo ====================================================================
echo  CodeForge AWS Multi-AZ Cluster Online!
echo  - ALB Ingress Entrypoint : http://localhost:5000
echo  - EC2 Server 1 Target    : http://localhost:5001 (us-east-1a)
echo  - EC2 Server 2 Target    : http://localhost:5002 (us-east-1b)
echo  - PostgreSQL Database    : localhost:5432
echo.
echo  To verify round-robin load distribution:
echo    powershell -ExecutionPolicy Bypass -File ..\aws\verify-alb.ps1
echo ====================================================================
