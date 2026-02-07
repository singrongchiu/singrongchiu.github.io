#!/usr/bin/env bash
set -euo pipefail

tar -cf - src | brotli -q 11 -w 24 > src.tar.br

tar -cf - src | gzip -9 > src.tar.gz

tar -cf - src | zstd --ultra -22 -T1 > src.tar.zst

for f in src.tar.br src.tar.gz src.tar.zst; do
  stat -f %z "$f" | awk -v name="$f" '{ printf "%s : %.2f KB\n", name, $1/1024 }'
done
