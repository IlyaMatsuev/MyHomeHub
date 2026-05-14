#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CONTAINER_NAME="${MQTT_CONTAINER_NAME:-mqtt-broker}"
PWFILE_PATH="${MQTT_PWFILE_PATH:-/mosquitto/config/pwfile}"
HOST_PWFILE_PATH="${MQTT_HOST_PWFILE_PATH:-${ROOT_DIR}/configs/mqtt/pwfile}"

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>" >&2
    exit 1
fi

USERNAME="$1"
PASSWORD="$2"

if [ ! -f "${HOST_PWFILE_PATH}" ]; then
    mkdir -p "$(dirname "${HOST_PWFILE_PATH}")"
    touch "${HOST_PWFILE_PATH}"
    echo "Created empty password file at '${HOST_PWFILE_PATH}'"
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    echo "Error: container '${CONTAINER_NAME}' is not running. Start it via 'npm run mqtt:start' first." >&2
    exit 1
fi

echo "Creating a new MQTT user..."
docker exec "${CONTAINER_NAME}" mosquitto_passwd -b "${PWFILE_PATH}" "${USERNAME}" "${PASSWORD}" > /dev/null

echo "Restarting the MQTT broker..."
docker restart "${CONTAINER_NAME}" > /dev/null

echo "MQTT user '${USERNAME}' created/updated in ${CONTAINER_NAME}: ${HOST_PWFILE_PATH}"
