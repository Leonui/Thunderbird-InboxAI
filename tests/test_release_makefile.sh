#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REAL_SED="$(command -v sed)"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

make_repo() {
  local repo_dir="$1"

  mkdir -p "$repo_dir"
  cp "$ROOT_DIR/Makefile" "$repo_dir/Makefile"
  cp "$ROOT_DIR/manifest.json" "$repo_dir/manifest.json"

  (
    cd "$repo_dir"
    git init -q
    git config user.name "Test User"
    git config user.email "test@example.com"
    git add Makefile manifest.json
    git commit -q -m "Initial commit"
    git tag -a v0.1.5 -m "v0.1.5"
  )
}

test_release_rejects_staged_changes() {
  local tmp_dir repo_dir output

  tmp_dir="$(mktemp -d)"
  repo_dir="$tmp_dir/repo"
  make_repo "$repo_dir"

  (
    cd "$repo_dir"
    echo "draft" > README.md
    git add README.md

    if output="$(make release v=0.1.6 2>&1)"; then
      echo "$output"
      fail "make release should fail when unrelated staged changes exist"
    fi

    [[ ! -f .git/refs/tags/v0.1.6 ]] || fail "release should not create a tag on failure"
  )
}

test_release_rejects_unstaged_changes() {
  local tmp_dir repo_dir output

  tmp_dir="$(mktemp -d)"
  repo_dir="$tmp_dir/repo"
  make_repo "$repo_dir"

  (
    cd "$repo_dir"
    printf '\n ' >> manifest.json

    if output="$(make release v=0.1.6 2>&1)"; then
      echo "$output"
      fail "make release should fail when tracked unstaged changes exist"
    fi

    [[ ! -f .git/refs/tags/v0.1.6 ]] || fail "release should not create a tag on failure"
  )
}

test_release_works_without_gnu_sed_i() {
  local tmp_dir repo_dir fake_bin output tag_body

  tmp_dir="$(mktemp -d)"
  repo_dir="$tmp_dir/repo"
  fake_bin="$tmp_dir/bin"
  mkdir -p "$fake_bin"
  make_repo "$repo_dir"

  cat > "$fake_bin/sed" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == "-i" ]]; then
  echo "fake sed: -i unsupported" >&2
  exit 64
fi
exec "$REAL_SED" "\$@"
EOF
  chmod +x "$fake_bin/sed"

  (
    cd "$repo_dir"
    if ! output="$(PATH="$fake_bin:$PATH" make release v=0.1.6 2>&1)"; then
      echo "$output"
      fail "make release should not depend on GNU sed -i"
    fi

    grep -q '"version": "0.1.6"' manifest.json || fail "manifest version was not updated"
    [[ "$(git show --pretty='' --name-only HEAD)" == "manifest.json" ]] || fail "release commit should only include manifest.json"

    tag_body="$(git for-each-ref refs/tags/v0.1.6 --format='%(contents)')"
    [[ "$tag_body" == "$(cat <<'EOF'
Release v0.1.6

Changes since v0.1.5:
- chore: bump version to 0.1.6
EOF
)" ]] || fail "tag annotation should match the seeded release history"
  )
}

test_release_rejects_staged_changes
test_release_rejects_unstaged_changes
test_release_works_without_gnu_sed_i

echo "PASS: release Makefile regression tests"
