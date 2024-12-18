#!/usr/bin/env bash

set -e

cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../" &> /dev/null

IMAGE_TAG="${IMAGE_TAG:-$(make -s name)}"
IMAGE_NAME="board:${IMAGE_TAG}"
PORT="${PORT:-8000}"

make -s version-file
trap 'rm -- version.txt' EXIT

echo "building ${IMAGE_NAME}"

if [ -z "${IMAGE_LOCAL}" ]; then
    docker buildx build \
        --platform linux/amd64 \
        --build-arg "PORT=${PORT}" \
        -t "${IMAGE_NAME}" \
        -f deploy/Dockerfile \
        .
else
    IMAGE_NAME="${IMAGE_NAME}-local"
    IMAGE_LOCAL="local image "
    docker buildx build \
        --build-arg "PORT=${PORT}" \
        -t "${IMAGE_NAME}" \
        -f deploy/Dockerfile \
        .
fi

echo "built ${IMAGE_LOCAL}${IMAGE_NAME}"
