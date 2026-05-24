#!/usr/bin/env bash

set -euo pipefail

OUTPUT_FILE="${1:-thunderbird-ai-plugin.xpi}"

rm -f "$OUTPUT_FILE"

zip -r "$OUTPUT_FILE" \
  manifest.json \
  background \
  compose \
  icons \
  lib \
  message \
  options \
  popup \
  rundown \
  shared \
  LICENSE
