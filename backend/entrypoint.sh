#!/usr/bin/env bash
set -euo pipefail

echo "==> Waiting for PostgreSQL..."
python - <<'PY'
import os, time, sys
import psycopg

db_url = os.environ.get("DATABASE_URL", "")
# Convert SQLAlchemy URL prefix if present for direct psycopg connection check
conn_url = db_url.replace("postgresql+psycopg://", "postgresql://", 1)

max_attempts = 30
for attempt in range(1, max_attempts + 1):
    try:
        with psycopg.connect(conn_url, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
        print("PostgreSQL is ready.")
        sys.exit(0)
    except Exception as exc:
        print(f"Attempt {attempt}/{max_attempts}: PostgreSQL not ready yet ({type(exc).__name__}).")
        time.sleep(2)

print("PostgreSQL failed to become ready in time.")
sys.exit(1)
PY

echo "==> Running Alembic migrations..."
alembic upgrade head

echo "==> Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${BACKEND_PORT:-8000}"
