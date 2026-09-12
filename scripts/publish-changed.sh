#!/usr/bin/env bash
# Publish the packages in this repository whose version is not yet on npm.
#
#   npm run release:publish            # publish what is missing
#   npm run release:publish -- --dry   # say what would be published, touch nothing
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
# On the first `npm publish` a browser window opens for 2FA. Tick "trust this
# device for 5 minutes" and the rest of the run goes through without prompting.
set -uo pipefail

cd "$(dirname "$0")/.."

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

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

while IFS='|' read -r name dir; do
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
    npm publish --access public
  else
    npm publish --workspace "$name" --access public
  fi
  if [ "$?" -ne 0 ]; then
    echo "!!! $name@$version failed to publish — stopping here." >&2
    echo "    Published so far: $PUBLISHED. Nothing after this was attempted." >&2
    exit 1
  fi
  PUBLISHED=$((PUBLISHED + 1))
done <<< "$ORDER"

echo
if [ "$DRY" = "1" ]; then
  echo ">>> Dry run: $PUBLISHED would be published, $SKIPPED already on npm."
else
  echo ">>> Published $PUBLISHED, skipped $SKIPPED already on npm."
fi
