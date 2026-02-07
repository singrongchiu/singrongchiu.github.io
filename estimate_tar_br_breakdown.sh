#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-src.tar.br}"
BROTLI_QUALITY="${2:-11}"
BROTLI_WINDOW="${3:-24}"

if [ ! -f "${ARCHIVE}" ]; then
  echo "Archive not found: ${ARCHIVE}" >&2
  echo "Usage: sh estimate_tar_br_breakdown.sh [archive.tar.br] [brotli_quality] [brotli_window]" >&2
  exit 1
fi

case "${ARCHIVE}" in
  *.tar.br) ;;
  *)
    echo "Expected a .tar.br archive, got: ${ARCHIVE}" >&2
    exit 1
    ;;
esac

tmp_dir="$(mktemp -d /tmp/tarbr-breakdown.XXXXXX)"
extract_dir="${tmp_dir}/extract"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

mkdir -p "${extract_dir}"
brotli -d -c "${ARCHIVE}" | tar -xf - -C "${extract_dir}"

total_archive_bytes="$(stat -f %z "${ARCHIVE}")"
per_file_tsv="${tmp_dir}/per_file.tsv"

find "${extract_dir}" -type f | sort | while IFS= read -r abs_path; do
  rel_path="${abs_path#${extract_dir}/}"
  raw_bytes="$(stat -f %z "${abs_path}")"
  isolated_bytes="$(tar -C "${extract_dir}" -cf - "${rel_path}" | brotli -q "${BROTLI_QUALITY}" -w "${BROTLI_WINDOW}" | wc -c | tr -d ' ')"
  printf "%s\t%s\t%s\n" "${rel_path}" "${raw_bytes}" "${isolated_bytes}"
done > "${per_file_tsv}"

isolated_sum="$(awk -F '\t' '{sum+=$3} END {print sum+0}' "${per_file_tsv}")"

if [ "${isolated_sum}" -eq 0 ]; then
  echo "No files found in archive payload." >&2
  exit 1
fi

echo "Archive: ${ARCHIVE}"
echo "Archive size: ${total_archive_bytes} bytes"
echo "Method: per-file isolated Brotli size, normalized to total archive size"
echo
printf "%-36s %12s %14s %9s\n" "file" "raw_bytes" "est_br_bytes" "est_share"
printf "%-36s %12s %14s %9s\n" "----" "---------" "------------" "---------"
awk -F '\t' -v total="${total_archive_bytes}" -v iso_sum="${isolated_sum}" '
  {
    est = ($3 / iso_sum) * total
    pct = (est / total) * 100
    printf "%s\t%d\t%.0f\t%.2f%%\n", $1, $2, est, pct
  }
' "${per_file_tsv}" | sort -t $'\t' -k3,3nr | awk -F '\t' '{printf "%-36s %12d %14d %9s\n", $1, $2, $3, $4}'

echo
echo "isolated_sum: ${isolated_sum} bytes"
