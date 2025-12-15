#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.envs}"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
R2_ENDPOINT="${R2_ENDPOINT:-}"
R2_BUCKET="${R2_BUCKET:-}"
AWS_REGION="${AWS_REGION:-auto}"
AWS_EC2_METADATA_DISABLED="${AWS_EC2_METADATA_DISABLED:-true}"
AWS_S3_FORCE_PATH_STYLE="${AWS_S3_FORCE_PATH_STYLE:-true}"

usage() {
  cat <<'USAGE'
Usage: scripts/r2-upload.sh <local-path> [remote-prefix]
  <local-path>     File or directory to upload (e.g., public/videos or public/thumbnails/file.png)
  [remote-prefix]  Destination prefix in bucket (default: videos/)

Environment (set in .envs or .env):
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
Optional (defaults shown):
  AWS_REGION=auto, AWS_EC2_METADATA_DISABLED=true, AWS_S3_FORCE_PATH_STYLE=true
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

LOCAL_PATH="$1"
REMOTE_PREFIX="${2:-videos/}"

if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" || -z "$R2_ENDPOINT" || -z "$R2_BUCKET" ]]; then
  echo "Missing required env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET)."
  echo "Populate $ENV_FILE (or .envs/.env) before running."
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Install from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION AWS_EC2_METADATA_DISABLED AWS_S3_FORCE_PATH_STYLE

if [[ -d "$LOCAL_PATH" ]]; then
  echo "Uploading directory '$LOCAL_PATH' to s3://$R2_BUCKET/$REMOTE_PREFIX (recursive)..."
  aws s3 cp "$LOCAL_PATH" "s3://$R2_BUCKET/$REMOTE_PREFIX" \
    --endpoint-url "$R2_ENDPOINT" \
    --recursive \
    --acl public-read
else
  BASENAME="$(basename "$LOCAL_PATH")"
  DEST="s3://$R2_BUCKET/${REMOTE_PREFIX%/}/$BASENAME"
  echo "Uploading file '$LOCAL_PATH' to $DEST ..."
  aws s3 cp "$LOCAL_PATH" "$DEST" \
    --endpoint-url "$R2_ENDPOINT" \
    --acl public-read
fi

echo "Done."
