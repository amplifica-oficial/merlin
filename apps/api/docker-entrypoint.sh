#!/bin/sh
set -e

SERVICE="${SERVICE:-server}"

case "$SERVICE" in
  server)
    echo "Running database migrations..."
    if ! /app/node_modules/.bin/prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma; then
      echo "ERROR: Database migration failed."
      exit 1
    fi
    echo "Starting API server..."
    exec node /app/apps/api/dist/app.js
    ;;
  worker)
    echo "Starting BullMQ worker..."
    exec node /app/apps/api/dist/jobs/worker.js
    ;;
  *)
    echo "ERROR: Unknown SERVICE=$SERVICE (expected server or worker)"
    exit 1
    ;;
esac
