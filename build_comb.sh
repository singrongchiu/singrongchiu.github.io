#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-src}"
COMB_DIR="${2:-comb}"
OUT_ARCHIVE="${3:-comb.tar.br}"
TMP_JS="${COMB_DIR}/combined.raw.js"
FINAL_JS="${COMB_DIR}/combined.js"
COMB_INDEX="${COMB_DIR}/index.html"

if [ ! -d "${SRC_DIR}" ]; then
  echo "Source directory not found: ${SRC_DIR}" >&2
  exit 1
fi

if [ ! -f "${SRC_DIR}/index.html" ]; then
  echo "Missing ${SRC_DIR}/index.html" >&2
  exit 1
fi

mkdir -p "${COMB_DIR}"
non_js_files=()

# Copy non-JS assets from src/ to comb/, preserving paths.
while IFS= read -r -d '' src_file; do
  rel="${src_file#${SRC_DIR}/}"
  dst="${COMB_DIR}/${rel}"
  mkdir -p "$(dirname "${dst}")"
  cp "${src_file}" "${dst}"
  non_js_files+=("${rel}")
done < <(find "${SRC_DIR}" -type f ! -name '*.js' -print0)

js_order=()
while IFS= read -r line; do
  js_order+=("${line}")
done < <(perl -ne 'while (/<script\s+src="\.\/*([^"]*\.js)"><\/script>/g) { print "$1\n" }' "${SRC_DIR}/index.html")
if [ "${#js_order[@]}" -eq 0 ]; then
  echo "No <script src=\"./*.js\"></script> entries found in ${SRC_DIR}/index.html" >&2
  exit 1
fi

{
  echo "// Auto-generated from ${SRC_DIR}/index.html script order."
  for js_file in "${js_order[@]}"; do
    full_path="${SRC_DIR}/${js_file}"
    if [ ! -f "${full_path}" ]; then
      echo "Missing script referenced by index.html: ${full_path}" >&2
      exit 1
    fi
    echo
    echo "/* ===== ${js_file} ===== */"
    cat "${full_path}"
    echo
  done
} > "${TMP_JS}"

if command -v terser >/dev/null 2>&1; then
  terser "${TMP_JS}" \
    -c passes=3,toplevel=true,ecma=2021 \
    -m toplevel=true \
    --mangle-props regex=/^_/ \
    --comments false \
    -f ecma=2021 \
    -o "${FINAL_JS}"
else
  cp "${TMP_JS}" "${FINAL_JS}"
  echo "Warning: terser not found; wrote unminified ${FINAL_JS}" >&2
fi

rm -f "${TMP_JS}"

cp "${SRC_DIR}/index.html" "${COMB_INDEX}"
perl -0pi -e 's#(?:\s*<script\s+src="\./[^"]+\.js"></script>\s*)+(?=\s*</body>)#\n  <script src="./combined.js"></script>\n#s' "${COMB_INDEX}"

# Minify HTML/CSS. Prefer html-minifier-terser if available.
if command -v html-minifier-terser >/dev/null 2>&1; then
  html-minifier-terser \
    --collapse-whitespace \
    --remove-comments \
    --remove-optional-tags \
    --minify-css true \
    --minify-js true \
    "${COMB_INDEX}" -o "${COMB_INDEX}"
else
  # Fallback: minimal inlined CSS and HTML whitespace minify.
  echo "Warning: html-minifier-terser not found; using node fallback" >&2
  node - "${COMB_INDEX}" <<'NODE'
const fs = require("fs");
const htmlPath = process.argv[2];
let html = fs.readFileSync(htmlPath, "utf8");

// Minify inline CSS by trimming each line and removing blank lines.
html = html.replace(/<style(\b[^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => {
  const minCss = css
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("");
  return `<style${attrs}>${minCss}</style>`;
});

// Collapse whitespace between tags in HTML.
html = html.replace(/>\s+</g, "><").trim() + "\n";

fs.writeFileSync(htmlPath, html);
NODE
fi

node --check "${FINAL_JS}"

tar_inputs=(combined.js)
if [ "${#non_js_files[@]}" -gt 0 ]; then
  tar_inputs+=("${non_js_files[@]}")
fi
tar -cf - -C "${COMB_DIR}" "${tar_inputs[@]}" | brotli -q 11 -w 24 > "${OUT_ARCHIVE}"

echo "Build complete:"
echo "  Combined JS : ${FINAL_JS}"
echo "  Entry HTML  : ${COMB_INDEX}"
echo "  Archive     : ${OUT_ARCHIVE}"
stat -f "  Archive size: %z bytes" "${OUT_ARCHIVE}"
