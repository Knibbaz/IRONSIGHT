#!/usr/bin/env bash
# IRONSIGHT VPS deploy — idempotent, safe to run from cron.
#
# Pulls the newest basabbink/ironsight:latest from Docker Hub and only
# force-recreates the container when the image actually changed. Records the
# deployed version to .deployed-version so you always know what's live.
#
# Setup on the VPS:
#   1. Copy this repo to /opt/ironsight (git pull keeps it in sync).
#   2. chmod +x deploy/deploy.sh
#   3. Add a cron line (see "crontab" below) or run it manually.
#
# Example crontab (every 10 minutes):
#   */10 * * * * /opt/ironsight/deploy/deploy.sh >> /var/log/ironsight-deploy.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE=ironsight
IMAGE=basabbink/ironsight:latest

# Version that is currently running (empty on first deploy).
running_version=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$SERVICE" 2>/dev/null || echo "")

# Pull the newest latest image.
docker compose pull -q

# Version label on the freshly pulled image.
new_version=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$IMAGE" 2>/dev/null || echo "unknown")

if [ "$running_version" = "$new_version" ] && docker ps --format '{{.Names}}' | grep -qx "$SERVICE"; then
  echo "$(date -u +%FT%TZ) no change (v${new_version}), skipping"
  exit 0
fi

echo "$(date -u +%FT%TZ) deploying v${new_version} (was v${running_version})"
docker compose up -d --force-recreate

# Persist the deployed version for at-a-glance checks.
echo "$new_version" > .deployed-version

# Clean up dangling images from previous releases.
docker image prune -f >/dev/null 2>&1 || true

echo "$(date -u +%FT%TZ) done: v${new_version}"