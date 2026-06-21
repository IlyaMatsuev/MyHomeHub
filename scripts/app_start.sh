#!/usr/bin/env bash
set -euo pipefail

# Recreate all docker services in dependency order

cd "$(dirname "$0")/.."

npm run mongo:restart
npm run redis:restart
npm run mqtt:restart
npm run zigbee:restart
npm run restart
npm run watcher:restart
