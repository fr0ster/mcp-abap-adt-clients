#!/usr/bin/env bash
# Publish the packages in this repository whose version is not yet on npm.
#
#   npm run release:publish                  # publish what is missing
#   npm run release:publish -- --dry         # say what would be published, touch nothing
#   npm run release:publish -- --otp 123456  # with a one-time password
#
# **"Changed" is read from the registry, not from git.** A package is published
# when its declared version is absent from npm, and skipped when it is there.
# That makes the script idempotent — running it twice publishes nothing the
# second time — and it cannot be fooled by a version bump that was committed and
# then reverted, or by a dirty tree.
#
# Versions here move independently: `adt-clients` is a major releases ahead of
# `adt-strategies` and neither waits for the other. That is why this publishes a
# subset rather than everything, which is what a repository that bumps all its
# packages together would do.
#
# **Two-factor authentication.** npm asks for a one-time password on publish and
# opens a browser to collect it. That needs stdin to still be the terminal, which
# is why the loop below reads its list on descriptor 3 — the first version read
# it on stdin, and npm found the leftover list bytes where it expected a person.
#
# If the browser flow is unavailable, pass the code instead:
#
#   npm run release:publish -- --otp 123456    # a code from your authenticator
#   npm publish --workspace @mcp-abap-adt/adt-strategies --access public
#
# The second runs npm directly, where the browser flow works. An automation
# token (npmjs.com → Access Tokens → Granular, "Automation") skips the prompt
# altogether and is what CI would use.
set -uo pipefail

cd "$(dirname "$0")/.."

DRY=0
OTP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry) DRY=1; shift ;;
    --otp) OTP="${2:-}"; shift 2 ;;
    --otp=*) OTP="${1#--otp=}"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

OTP_ARGS=""
[ -n "$OTP" ] && OTP_ARGS="--otp $OTP"

# Every package — the root one, which still lives here, plus each workspace —
# in dependency order. The order is derived, not listed: a package that depends
# on another in this repository is published after it, because publishing a
# dependent on top of an unpublished dependency produces a release set that
# cannot be installed, and nothing about the alphabet prevents that.
#
# `while read` rather than `mapfile`: bash 3.2 ships as /bin/bash on macOS and
# has no `mapfile`, and this script is meant to run wherever a release is cut.
ORDER=$(node -e "
const fs = require('node:fs');
const root = require('./package.json');
const dirs = ['.'];
for (const pattern of root.workspaces ?? []) {
  const base = pattern.replace(/\/\*\$/, '');
  if (!fs.existsSync(base)) continue;
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory() && fs.existsSync(\`\${base}/\${entry.name}/package.json\`)) {
      dirs.push(\`\${base}/\${entry.name}\`);
    }
  }
}
const meta = new Map();
for (const dir of dirs) {
  const pkg = JSON.parse(fs.readFileSync(\`\${dir}/package.json\`, 'utf-8'));
  if (pkg.private) continue;
  meta.set(pkg.name, {
    dir,
    deps: Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }),
  });
}
const done = new Set();
const out = [];
const visit = (name, seen) => {
  if (done.has(name) || !meta.has(name)) return;
  if (seen.has(name)) throw new Error('dependency cycle at ' + name);
  seen.add(name);
  for (const dep of meta.get(name).deps) visit(dep, seen);
  done.add(name);
  out.push(name + '|' + meta.get(name).dir);
};
for (const name of meta.keys()) visit(name, new Set());
console.log(out.join('\n'));
")

echo ">>> Clean rebuild before publish"
npm run --silent build
npm run --silent build:packages

PUBLISHED=0
SKIPPED=0

# **`<&3`, and this is the whole reason the first real run failed.** A
# `while read` loop fed by a here-string takes the list as its stdin, so every
# command inside the body inherits it — and `npm publish` asking for a one-time
# password found the leftover bytes of the package list instead of a terminal.
# It printed the authentication URL and gave up in the same breath. Reading the
# list on descriptor 3 leaves stdin where it was.
while IFS='|' read -r name dir <&3; do
  [ -n "$name" ] || continue
  version="$(node -p "require('./$dir/package.json').version")"
  echo
  echo ">>> $name@$version  ($dir)"

  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "    already on npm — skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [ "$DRY" = "1" ]; then
    echo "    would publish"
    PUBLISHED=$((PUBLISHED + 1))
    continue
  fi

  # Abort on the first failure. Continuing would publish a dependent on top of
  # a dependency that never made it, and an unusable release set is worse than
  # a partial one you know about.
  if [ "$dir" = "." ]; then
    # shellcheck disable=SC2086
    npm publish --access public $OTP_ARGS
  else
    # shellcheck disable=SC2086
    npm publish --workspace "$name" --access public $OTP_ARGS
  fi
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "!!! $name@$version failed to publish — stopping here." >&2
    echo "    Published so far: $PUBLISHED. Nothing after this was attempted." >&2
    if [ -z "$OTP" ]; then
      echo "    If that was EOTP, npm wanted a one-time password:" >&2
      echo "      npm run release:publish -- --otp <code>" >&2
    fi
    exit 1
  fi
  PUBLISHED=$((PUBLISHED + 1))
done 3<<< "$ORDER"

echo
if [ "$DRY" = "1" ]; then
  echo ">>> Dry run: $PUBLISHED would be published, $SKIPPED already on npm."
else
  echo ">>> Published $PUBLISHED, skipped $SKIPPED already on npm."
fi
