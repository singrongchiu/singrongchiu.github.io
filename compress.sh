#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="src"
INDEX_FILE="${SRC_DIR}/index.html"
COMBINED_FILE="${SRC_DIR}/combined.js"
STYLE_FILE="${SRC_DIR}/styles.css"

if [ ! -f "${INDEX_FILE}" ]; then
  echo "Missing ${INDEX_FILE}" >&2
  exit 1
fi

if [ ! -f "${COMBINED_FILE}" ]; then
  echo "Missing ${COMBINED_FILE}" >&2
  exit 1
fi

if [ ! -f "${STYLE_FILE}" ]; then
  echo "Missing ${STYLE_FILE}" >&2
  exit 1
fi

tar -cf - -C "${SRC_DIR}" index.html combined.js styles.css | brotli -q 11 -w 24 > src.tar.br

tar -cf - -C "${SRC_DIR}" index.html combined.js styles.css | gzip -9 > src.tar.gz

tar -cf - -C "${SRC_DIR}" index.html combined.js styles.css | zstd --ultra -22 -T1 > src.tar.zst

for f in src.tar.br src.tar.gz src.tar.zst; do
  stat -f %z "$f" | awk -v name="$f" '{ printf "%s : %.2f KB\n", name, $1/1024 }'
done
