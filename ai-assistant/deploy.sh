#!/bin/bash
# ============================================================
# deploy.sh — Run on VPS to update the app
# Usage: ./deploy.sh
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Rebuilding and restarting container..."
docker compose down --remove-orphans
docker compose up -d --build

echo "==> Pruning unused images..."
docker image prune -f

echo ""
echo "==> Status:"
docker compose ps

echo ""
echo "==> Health check:"
sleep 5
curl -sf http://localhost:3006/api/health && echo " ✅ OK" || echo " ❌ Failed"
