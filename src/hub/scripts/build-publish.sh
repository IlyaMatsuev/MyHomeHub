#!/bin/bash
set -e

# Config
IMAGE_NAME="ilyamatsuev/smarthome-hub-server"
TAG="latest"

echo "🔨 Building Docker image..."

npm run build:image -- --push

echo "✅ Image pushed: $IMAGE_NAME:$TAG"
