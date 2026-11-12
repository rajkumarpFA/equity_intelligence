#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-dump-file> [optional-storage-tar-gz]"
  exit 1
fi

DUMP_FILE="$1"
STORAGE_TAR="${2:-}"
DB_CONTAINER="equity_intelligence_db"
POSTGRES_USER="${POSTGRES_USER:-equity_user}"
POSTGRES_DB="${POSTGRES_DB:-equity_intelligence}"

if [ ! -f "${DUMP_FILE}" ]; then
  echo "Error: Dump file ${DUMP_FILE} does not exist."
  exit 1
fi

echo "==> Restoring database ${POSTGRES_DB} in ${DB_CONTAINER} from ${DUMP_FILE}..."
docker exec -i "${DB_CONTAINER}" pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists < "${DUMP_FILE}" || true

if [ -n "${STORAGE_TAR}" ] && [ -f "${STORAGE_TAR}" ]; then
  echo "==> Restoring storage volume from ${STORAGE_TAR}..."
  docker run --rm \
    -v equity_intelligence_uploaded_docs:/storage_dest \
    -v "$(dirname "$(realpath "${STORAGE_TAR}")")":/backup_source:ro \
    alpine sh -c "tar -xzf /backup_source/$(basename "${STORAGE_TAR}") -C /storage_dest"
fi

echo "==> Restore operation complete."
