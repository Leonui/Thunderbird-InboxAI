#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XPI_FILE="$ROOT_DIR/thunderbird-ai-plugin.xpi"

cleanup() {
  rm -f "$XPI_FILE"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

(
  cd "$ROOT_DIR"
  ./build.sh >/dev/null
)

[[ -f "$XPI_FILE" ]] || fail "build did not create thunderbird-ai-plugin.xpi"

entries="$(zipinfo -1 "$XPI_FILE")"

require_entry() {
  local entry="$1"
  grep -qx "$entry" <<<"$entries" || fail "missing expected package entry: $entry"
}

reject_prefix() {
  local prefix="$1"
  if grep -q "^$prefix" <<<"$entries"; then
    echo "$entries" | grep "^$prefix" >&2
    fail "package includes excluded path prefix: $prefix"
  fi
}

reject_entry() {
  local entry="$1"
  if grep -qx "$entry" <<<"$entries"; then
    fail "package includes excluded entry: $entry"
  fi
}

require_entry "manifest.json"
require_entry "background/background.js"
require_entry "compose/compose_panel.html"
require_entry "icons/inboxai.svg"
require_entry "lib/ai_service.js"
require_entry "message/translation_result.html"
require_entry "options/options.html"
require_entry "popup/main_menu.html"
require_entry "rundown/rundown.html"
require_entry "shared/ui.css"

reject_prefix "tests/"
reject_prefix "scripts/"
reject_prefix ".github/"
reject_prefix ".git/"
reject_entry "CHANGELOG.md"
reject_entry "README.md"
reject_entry "Makefile"
reject_entry "build.sh"

echo "PASS: build package allowlist tests"
