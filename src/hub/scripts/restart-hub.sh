#!/bin/sh
# This script needs to be granted executable permissions:
# chmod +x restart-hub.sh

docker pull ilyamatsuev/smarthome-hub-server:latest
docker stop smarthome-hub-server-test || true
docker stop smarthome-hub-server-prod || true
docker rm smarthome-hub-server-test || true
docker rm smarthome-hub-server-prod || true
npm run start:test
npm run start:prod
