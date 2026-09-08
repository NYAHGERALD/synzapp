#!/usr/bin/env bash
#
# Compares the environment variables on the live Cloud Run service against
# cloudrun.env.yaml, and refuses if deploying with that file would drop any.
#
# Why this exists: on 4 September 2026 the deploy command in
# GOOGLE_CLOUD_RUN_DEPLOYMENT.md would have silently removed four live
# variables, because cloudrun.env.yaml had drifted behind the running service.
# `--env-vars-file` replaces the whole set, it does not merge. Nothing warns
# you, and the service keeps serving traffic with the values gone.
#
# Usage:
#   bash scripts/checkCloudRunEnv.sh                 report, exit 1 if unsafe
#   bash scripts/checkCloudRunEnv.sh --sync          rewrite the file from live
#   bash scripts/checkCloudRunEnv.sh --from <yaml>   check a saved describe
#
set -uo pipefail

SERVICE="${SERVICE_NAME:-synzapp-backend}"
REGION="${REGION:-us-central1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/../cloudrun.env.yaml"
MODE="${1:-check}"
FROM_FILE="${2:-}"

# Only variables carrying a literal value. Secret-backed ones arrive through
# --set-secrets and are not expected to be in the file.
extract_plain() {
  awk '
    /^[[:space:]]*-[[:space:]]name:[[:space:]]*[A-Z0-9_]+[[:space:]]*$/ {
      name = $3
      if ((getline nextline) > 0 && nextline ~ /^[[:space:]]*value:/) {
        print name
      }
      next
    }
  ' "$1" | sort -u
}

describe_to() {
  local out="$1"

  if [ -n "$FROM_FILE" ]; then
    cp "$FROM_FILE" "$out"
    return 0
  fi

  if ! command -v gcloud >/dev/null 2>&1; then
    echo "gcloud is not on PATH. Try ~/google-cloud-sdk/bin/gcloud" >&2
    return 2
  fi

  # Errors are kept, not swallowed. A check that fails silently is worse than
  # no check: it looks like it passed.
  if ! gcloud run services describe "$SERVICE" --region "$REGION" --format=yaml > "$out" 2> "$out.err"; then
    echo "Could not read the live service:" >&2
    sed 's/^/  /' "$out.err" >&2
    return 2
  fi

  if ! grep -q "name:" "$out"; then
    echo "The service description came back empty. You are probably signed out:" >&2
    sed 's/^/  /' "$out.err" >&2
    echo "  Fix it with: gcloud auth login" >&2
    return 2
  fi

  return 0
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

describe_to "$WORK/live.yaml" || exit 2

if [ "$MODE" = "--sync" ]; then
  awk '
    /^[[:space:]]*-[[:space:]]name:[[:space:]]*[A-Z0-9_]+[[:space:]]*$/ {
      name = $3
      if ((getline nextline) > 0 && nextline ~ /^[[:space:]]*value:/) {
        sub(/^[[:space:]]*value:[[:space:]]*/, "", nextline)
        printf "%s: \"%s\"\n", name, nextline
      }
      next
    }
  ' "$WORK/live.yaml" > "$WORK/env.yaml"

  mv "$WORK/env.yaml" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Rewrote $ENV_FILE from the live service: $(grep -c ':' "$ENV_FILE") variables."
  echo "The file is gitignored and stays that way."
  exit 0
fi

extract_plain "$WORK/live.yaml" > "$WORK/live.names"
if [ -f "$ENV_FILE" ]; then
  grep -oE '^[A-Z0-9_]+:' "$ENV_FILE" | tr -d ':' | sort -u > "$WORK/file.names"
else
  : > "$WORK/file.names"
  echo "Note: $ENV_FILE does not exist."
fi

LIVE_COUNT="$(wc -l < "$WORK/live.names" | tr -d ' ')"
FILE_COUNT="$(wc -l < "$WORK/file.names" | tr -d ' ')"

echo "Service         : $SERVICE ($REGION)"
echo "Live plain vars : $LIVE_COUNT"
echo "In env file     : $FILE_COUNT"
echo

comm -13 "$WORK/live.names" "$WORK/file.names" > "$WORK/extra"
comm -23 "$WORK/live.names" "$WORK/file.names" > "$WORK/missing"

if [ -s "$WORK/extra" ]; then
  echo "In the file but not live, so they would be added:"
  sed 's/^/  /' "$WORK/extra"
  echo
fi

if [ -s "$WORK/missing" ]; then
  echo "REFUSING. These live variables are not in the file."
  echo "Deploying with --env-vars-file would delete them:"
  sed 's/^/  /' "$WORK/missing"
  echo
  echo "Safe options:"
  echo "  1. Deploy without any env flag, which leaves the live values alone:"
  echo "       gcloud run deploy $SERVICE --source . --region $REGION"
  echo "  2. Bring the file up to date first, then deploy with it:"
  echo "       bash scripts/checkCloudRunEnv.sh --sync"
  exit 1
fi

echo "Safe. The file covers every live variable."
