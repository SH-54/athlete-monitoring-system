#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="athlos-rls-${RANDOM}"
docker_local() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
# Isolated, no ports or network, fictional data only.
docker_local run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
trap 'docker_local rm -f "$container" >/dev/null' EXIT
for attempt in $(seq 1 30); do
 if docker_local exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
for file in tests/rls-bootstrap.sql supabase/migrations/*.sql tests/rls.sql tests/import-rls.sql tests/security-rls.sql tests/live-workflow-rls.sql; do
 docker_local exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$file"
done
