#!/usr/bin/env bash
set -euo pipefail

DOCKER_USERNAME="ilyamatsuev"
DOCKER_IMAGE_NAME="my-home-hub"
IMAGE_REF="$DOCKER_USERNAME/$DOCKER_IMAGE_NAME"

docker buildx inspect my-home-hub-builder &>/dev/null \
  || docker buildx create --name my-home-hub-builder --use

# Build and push each platform by digest, capture digests for the final manifest
AMD64_DIGEST=$(docker buildx build \
  --builder my-home-hub-builder \
  --platform linux/amd64 \
  --output "type=image,name=$IMAGE_REF,push-by-digest=true,name-canonical=true,push=true" \
  --metadata-file /tmp/meta-amd64.json \
  . && jq -r '."containerimage.digest"' /tmp/meta-amd64.json)

ARM64_DIGEST=$(docker buildx build \
  --builder my-home-hub-builder \
  --platform linux/arm64 \
  --output "type=image,name=$IMAGE_REF,push-by-digest=true,name-canonical=true,push=true" \
  --metadata-file /tmp/meta-arm64.json \
  . && jq -r '."containerimage.digest"' /tmp/meta-arm64.json)

echo "amd64 digest: $AMD64_DIGEST"
echo "arm64 digest: $ARM64_DIGEST"

docker buildx imagetools create \
  -t "$IMAGE_REF" \
  "$IMAGE_REF@$AMD64_DIGEST" \
  "$IMAGE_REF@$ARM64_DIGEST"

echo "Published $IMAGE_REF (amd64 + arm64)"
