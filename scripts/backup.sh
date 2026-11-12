#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "${BACKUP_DIR}"

DB_CONTAINER="equity_intelligence_db"
POSTGRES_USER="${POSTGRES_USER:-equity_user}"
POSTGRES_DB="${POSTGRES_DB:-equity_intelligence}"

echo "==> Creating PostgreSQL backup from ${DB_CONTAINER}..."
docker exec "${DB_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -F c "${POSTGRES_DB}" > "${BACKUP_DIR}/equity_intelligence_${TIMESTAMP}.dump"

echo "==> Archiving uploaded storage volume..."
docker run --rm \
  -v equity_intelligence_uploaded_docs:/storage_source:ro \
  -v "$(pwd)/${BACKUP_DIR}":/backup_dest \
  alpine tar -czf "/backup_dest/storage_${TIMESTAMP}.tar.gz" -C /storage_source .

echo "==> Backup complete in ${BACKUP_DIR}:"
ls -lh "${BACKUP_DIR}"/*"${TIMESTAMP}"*
