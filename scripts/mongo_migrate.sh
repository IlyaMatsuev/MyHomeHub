#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/migrations"

if [ -f "${ROOT_DIR}/.env" ]; then
    while IFS='=' read -r key value; do
        [[ -z "${key}" || "${key}" =~ ^[[:space:]]*# ]] && continue
        value="${value%$'\r'}"
        value="${value%\"}"; value="${value#\"}"
        value="${value%\'}"; value="${value#\'}"
        export "${key}=${value}"
    done < "${ROOT_DIR}/.env"
fi

CONTAINER_NAME="${MONGO_CONTAINER_NAME:-mongodb}"
MONGO_USER="${MONGO_INITDB_ROOT_USERNAME:-root}"
MONGO_PASS="${MONGO_INITDB_ROOT_PASSWORD:-password}"
MONGO_DB="${MONGO_INITDB_DATABASE:-smarthome}"
MONGO_INNER_PORT="${MONGO_INNER_PORT:-27017}"

CONN_STRING="mongodb://${MONGO_USER}:${MONGO_PASS}@localhost:${MONGO_INNER_PORT}/${MONGO_DB}?authSource=admin"

usage() {
    echo "Usage: $0 [<3-digit-prefix>]" >&2
    echo "  With <prefix>: run the migration whose filename starts with that prefix (e.g. 001)." >&2
    echo "  Without args:  run every migration in ${MIGRATIONS_DIR} in ascending prefix order." >&2
}

run_migration() {
    local file="$1"
    echo "→ Applying $(basename "${file}")"
    docker exec -i "${CONTAINER_NAME}" mongosh --quiet "${CONN_STRING}" < "${file}"
}

if [ $# -gt 1 ]; then
    usage
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    echo "Error: container '${CONTAINER_NAME}' is not running. Start it via 'npm run mongo:start' first." >&2
    exit 1
fi

if [ ! -d "${MIGRATIONS_DIR}" ]; then
    echo "Error: migrations directory not found at ${MIGRATIONS_DIR}" >&2
    exit 1
fi

shopt -s nullglob

if [ $# -eq 1 ]; then
    PREFIX="$1"
    if ! [[ "${PREFIX}" =~ ^[0-9]{3}$ ]]; then
        echo "Error: prefix must be a 3-digit number (e.g. 001)." >&2
        usage
        exit 1
    fi
    matches=("${MIGRATIONS_DIR}/${PREFIX}-"*.js)
    if [ ${#matches[@]} -eq 0 ]; then
        echo "Error: no migration found with prefix '${PREFIX}' in ${MIGRATIONS_DIR}" >&2
        exit 1
    fi
    if [ ${#matches[@]} -gt 1 ]; then
        echo "Error: multiple migrations share prefix '${PREFIX}':" >&2
        printf '  %s\n' "${matches[@]}" >&2
        exit 1
    fi
    run_migration "${matches[0]}"
else
    files=("${MIGRATIONS_DIR}"/[0-9][0-9][0-9]-*.js)
    if [ ${#files[@]} -eq 0 ]; then
        echo "No migrations found in ${MIGRATIONS_DIR}" >&2
        exit 0
    fi
    sorted=()
    while IFS= read -r line; do sorted+=("${line}"); done < <(printf '%s\n' "${files[@]}" | sort)
    for f in "${sorted[@]}"; do
        run_migration "${f}"
    done
fi

echo "Done."
