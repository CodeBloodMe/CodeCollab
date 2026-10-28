#!/bin/bash
# ==============================================================================
# CodeForge AWS EC2 User Data Script - Server 1 (us-east-1a)
# VIT BCSE355L - Cloud Architecture Design QP 1
# ==============================================================================
set -e

echo "[CodeForge] Starting initialization for EC2 Server 1 (us-east-1a)..."

# 1. Update OS packages
sudo apt-get update -y
sudo apt-get install -y curl git docker.io

# 2. Enable and start Docker
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

# 3. Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clone or pull CodeForge application
APP_DIR="/opt/codeforge"
if [ ! -d "$APP_DIR" ]; then
    sudo git clone https://github.com/CodeBloodMe/CodeCollab.git "$APP_DIR"
fi
cd "$APP_DIR/server"
sudo npm install --omit=dev

# 5. Build isolated execution runner image
cd "$APP_DIR/runner"
sudo docker build -t codeforge-runner:latest .

# 6. Configure Environment for Server 1 in us-east-1a
# Replace RDS_ENDPOINT with your actual Amazon RDS PostgreSQL Endpoint
RDS_ENDPOINT="${RDS_ENDPOINT:-codeforge-db.xyz.us-east-1.rds.amazonaws.com}"
RDS_PASSWORD="${RDS_PASSWORD:-codeforge_secret}"

cat <<EOF | sudo tee "$APP_DIR/server/.env"
PORT=5000
DATABASE_URL=postgres://codeforge:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/codeforge
INSTANCE_ID=ec2-server1-us-east-1a
INSTANCE_ROLE=Primary Compute Node (Server 1)
AZ_ZONE=us-east-1a
JWT_SECRET=codeforge_aws_secret_key_12345
EOF

# 7. Configure Systemd Daemon Service
cat <<EOF | sudo tee /etc/systemd/system/codeforge.service
[Unit]
Description=CodeForge Backend Server 1 (us-east-1a)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/codeforge/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/codeforge/server/.env

[Install]
WantedBy=multi-user.target
EOF

# 8. Start CodeForge Service
sudo systemctl daemon-reload
sudo systemctl enable --now codeforge

# 9. Verify local health check
sleep 5
curl -i http://localhost:5000/api/health
echo "[CodeForge] Server 1 (us-east-1a) successfully launched!"

