#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${script_dir}"

framework_dir="Frameworks"
framework_path="${framework_dir}/CLiteRTLM.xcframework"
archive_path="${framework_dir}/CLiteRTLM.xcframework.zip"
download_url="https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.13.0/CLiteRTLM.xcframework.zip"

if [ -d "${framework_path}" ]; then
  exit 0
fi

mkdir -p "${framework_dir}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

curl -L --fail --silent --show-error -o "${archive_path}" "${download_url}"
unzip -q "${archive_path}" -d "${tmp_dir}"
rm -f "${archive_path}"
rm -rf "${framework_path}"
mv "${tmp_dir}/CLiteRTLM.xcframework" "${framework_path}"
