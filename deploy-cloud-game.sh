#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./deploy-cloud-game.sh [options]

Options:
  --game-id ID           Game id in manifest (default: vanish)
  --label LABEL          Label used when creating a new manifest entry (default: game-id)
  --weight NUMBER        Weight used when creating a new manifest entry (default: 1)
  --source PATH          Cloud-ready JS file to publish
                         (default: derived from manifest entry)
  --manifest PATH        Manifest JSON path (default: cloud/manifest.json)
  --cdn-domain DOMAIN    CloudFront domain, with or without https://
                         (or set CDN_DOMAIN env var)
  --bucket NAME          S3 bucket for cloud games (or set BUCKET env var)
  --dist-id ID           CloudFront distribution ID (or set DIST_ID env var)
  --dry-run              Update files locally but skip AWS upload/invalidation
  --help                 Show this help text

Notes:
  - This script intentionally uses a single fixed cloud path per game:
      games/<game-id>/<script-name>
  - Deployments overwrite that one artifact (no versioned folders).

Examples:
  ./deploy-cloud-game.sh \
    --game-id vanish \
    --source cloud/games/vanish/minigame-vanishing.cloud.js \
    --cdn-domain d111111abcdef8.cloudfront.net \
    --bucket tartanhacks-cloud-games-prod \
    --dist-id E123ABC456XYZ

  ./deploy-cloud-game.sh --dry-run
USAGE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

GAME_ID="vanish"
LABEL=""
WEIGHT="1"
SOURCE_FILE=""
MANIFEST_PATH="cloud/manifest.json"
CDN_DOMAIN="${CDN_DOMAIN:-}"
BUCKET="${BUCKET:-}"
DIST_ID="${DIST_ID:-}"
DRY_RUN="false"

while (($# > 0)); do
  case "$1" in
    --game-id)
      GAME_ID="${2:-}"
      shift 2
      ;;
    --label)
      LABEL="${2:-}"
      shift 2
      ;;
    --weight)
      WEIGHT="${2:-}"
      shift 2
      ;;
    --source)
      SOURCE_FILE="${2:-}"
      shift 2
      ;;
    --manifest)
      MANIFEST_PATH="${2:-}"
      shift 2
      ;;
    --cdn-domain)
      CDN_DOMAIN="${2:-}"
      shift 2
      ;;
    --bucket)
      BUCKET="${2:-}"
      shift 2
      ;;
    --dist-id)
      DIST_ID="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$GAME_ID" ]]; then
  echo "--game-id cannot be empty" >&2
  exit 1
fi

if [[ -z "$LABEL" ]]; then
  LABEL="$GAME_ID"
fi

require_command python3

if [[ ! -f "$MANIFEST_PATH" ]]; then
  mkdir -p "$(dirname "$MANIFEST_PATH")"
  cat >"$MANIFEST_PATH" <<'JSON'
{
  "schemaVersion": 1,
  "games": []
}
JSON
fi

if [[ -z "$SOURCE_FILE" ]]; then
  SOURCE_FILE="$(python3 - "$MANIFEST_PATH" "$GAME_ID" <<'PY'
import json
import os
import re
import sys

manifest_path, game_id = sys.argv[1], sys.argv[2]
try:
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    print("")
    raise SystemExit(0)

games = data.get("games")
if not isinstance(games, list):
    print("")
    raise SystemExit(0)

entry = None
for g in games:
    if isinstance(g, dict) and g.get("id") == game_id:
        entry = g
        break

if not entry:
    print("")
    raise SystemExit(0)

url = entry.get("scriptUrl")
if not isinstance(url, str):
    print("")
    raise SystemExit(0)

m = re.search(r"/games/[^/]+/([^/?#]+)$", url)
if not m:
    print("")
    raise SystemExit(0)

filename = m.group(1)
path = os.path.join("cloud", "games", game_id, filename)
print(path if os.path.isfile(path) else "")
PY
)"
fi

if [[ -z "$SOURCE_FILE" || ! -f "$SOURCE_FILE" ]]; then
  echo "Could not find a source JS file." >&2
  echo "Provide --source PATH (cloud-ready game script)." >&2
  exit 1
fi

SCRIPT_NAME="$(basename "$SOURCE_FILE")"
TARGET_DIR="cloud/games/$GAME_ID"
TARGET_FILE="$TARGET_DIR/$SCRIPT_NAME"

mkdir -p "$TARGET_DIR"
if [[ "$SOURCE_FILE" != "$TARGET_FILE" ]]; then
  cp "$SOURCE_FILE" "$TARGET_FILE"
fi

if [[ -z "$CDN_DOMAIN" ]]; then
  echo "Missing --cdn-domain (or CDN_DOMAIN env var)." >&2
  exit 1
fi

if [[ "$CDN_DOMAIN" =~ ^https?:// ]]; then
  CDN_BASE="${CDN_DOMAIN%/}"
else
  CDN_BASE="https://${CDN_DOMAIN%/}"
fi

SCRIPT_URL="$CDN_BASE/games/$GAME_ID/$SCRIPT_NAME"

python3 - "$MANIFEST_PATH" "$GAME_ID" "$LABEL" "$WEIGHT" "$SCRIPT_URL" <<'PY'
import json
import sys

manifest_path, game_id, label, weight, script_url = sys.argv[1:6]

with open(manifest_path, "r", encoding="utf-8") as f:
    data = json.load(f)

if not isinstance(data, dict):
    data = {}
data.setdefault("schemaVersion", 1)
games = data.get("games")
if not isinstance(games, list):
    games = []
    data["games"] = games

entry = None
for item in games:
    if isinstance(item, dict) and item.get("id") == game_id:
        entry = item
        break

if entry is None:
    entry = {
        "id": game_id,
        "label": label,
        "weight": float(weight),
    }
    games.append(entry)

entry["id"] = game_id
entry["enabled"] = True
entry["scriptUrl"] = script_url
entry["label"] = entry.get("label", label)
entry["weight"] = float(entry.get("weight", weight))
entry.pop("version", None)

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

echo "Prepared cloud artifact:"
echo "  source:   $SOURCE_FILE"
echo "  target:   $TARGET_FILE"
echo "  script:   $SCRIPT_URL"
echo "  manifest: $MANIFEST_PATH"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run: skipped AWS upload and CloudFront invalidation."
  exit 0
fi

if [[ -z "$BUCKET" ]]; then
  echo "Missing --bucket (or BUCKET env var)." >&2
  exit 1
fi

if [[ -z "$DIST_ID" ]]; then
  echo "Missing --dist-id (or DIST_ID env var)." >&2
  exit 1
fi

require_command aws

S3_SCRIPT_KEY="games/$GAME_ID/$SCRIPT_NAME"
S3_MANIFEST_KEY="games/manifest.json"

aws s3 cp "$TARGET_FILE" "s3://$BUCKET/$S3_SCRIPT_KEY" \
  --content-type "application/javascript" \
  --cache-control "no-cache"

aws s3 cp "$MANIFEST_PATH" "s3://$BUCKET/$S3_MANIFEST_KEY" \
  --content-type "application/json" \
  --cache-control "no-cache"

aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/games/manifest.json" "/games/$GAME_ID/$SCRIPT_NAME"

echo "Deployed successfully."
