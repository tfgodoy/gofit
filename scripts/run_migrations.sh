#!/usr/bin/env bash
# Run SQL migrations in supabase/migrations in alphabetical order
# Usage: bash ./scripts/run_migrations.sh
# Requires: psql in PATH or export DATABASE_URL

set -euo pipefail

DBURL="${DATABASE_URL:-}"

build_from_env() {
  if [[ -n "${PGHOST:-}" && -n "${PGUSER:-}" && -n "${PGDATABASE:-}" ]]; then
    PORT=${PGPORT:-5432}
    if [[ -n "${PGPASSWORD:-}" ]]; then
      echo "postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PORT}/${PGDATABASE}"
    else
      echo "postgresql://${PGUSER}@${PGHOST}:${PORT}/${PGDATABASE}"
    fi
  fi
}

if [[ -z "$DBURL" ]]; then
  DBURL=$(build_from_env)
fi

if [[ -z "$DBURL" ]]; then
  echo "DATABASE_URL or PGHOST/PGUSER/PGDATABASE (and optional PGPASSWORD/PGPORT) must be set." 1>&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH. Install PostgreSQL client or use Docker." 1>&2
  exit 3
fi

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

for f in "${files[@]}"; do
  name=$(basename "$f")
  echo "Applying $name..."
  psql "$DBURL" -v ON_ERROR_STOP=1 -f "$f"
  echo "$name applied."
done

echo "All migrations applied successfully."