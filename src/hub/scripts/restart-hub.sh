#!/bin/sh
# This script needs to be granted executable permissions:
# chmod +x restart-hub.sh
# Apart from that, the user running this script needs to be able to run docker CLI without sudo

docker pull ilyamatsuev/smarthome-hub-server:latest
docker stop smarthome-hub-server-test smarthome-hub-server-prod || true
docker rm smarthome-hub-server-test smarthome-hub-server-prod || true
npm run start:test -- -d
npm run start:prod -- -d
