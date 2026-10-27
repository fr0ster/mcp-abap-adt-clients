// Every file a package declares is in what it would publish.
//
// tools/publish-changed.js publishes with --ignore-scripts, so no prepack or
// prepare runs at release: whatever a package ships has to exist after the
// build alone. The strategies package's ERRATA.md is the case that made this
// a gate — it used to be written by prepack, and an --ignore-scripts publish
// would have shipped without it.
//
// So, for each package in `publishOrder`, after the build: the listing of
// `npm pack --dry-run --ignore-scripts` must hold each entry of `files`, and
// the file behind `main`, `types`, every `exports` target and every
// `typesVersions` target.
//
//   node tools/check-packed.js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const { publishOrder } = readJson(path.join(ROOT, 'package.json'));

/** Every string a manifest field holds, however deeply it is nested. */
function targets(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(targets);
  if (value !== null && typeof value === 'object')
    return Object.values(value).flatMap(targets);
  return [];
}

/** `./dist/x.js` and `dist/x.js` name the same packed file. */
const normal = (p) => path.posix.normalize(p).replace(/^\.\//, '');

const problems = [];
for (const dir of publishOrder) {
  const cwd = path.join(ROOT, dir);
  const manifest = readJson(path.join(cwd, 'package.json'));
  const [listing] = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  const packed = new Set(listing.files.map((f) => f.path));

  const missing = [];
  for (const entry of manifest.files ?? []) {
    const wanted = normal(entry).replace(/\/$/, '');
    const found = [...packed].some(
      (p) => p === wanted || p.startsWith(`${wanted}/`),
    );
    if (!found) missing.push(`files: ${entry}`);
  }
  const declared = [
    ...targets(manifest.main).map((t) => ['main', t]),
    ...targets(manifest.types).map((t) => ['types', t]),
    ...targets(manifest.exports).map((t) => ['exports', t]),
    ...targets(manifest.typesVersions).map((t) => ['typesVersions', t]),
  ];
  for (const [field, target] of declared)
    if (!packed.has(normal(target))) missing.push(`${field}: ${target}`);

  if (missing.length > 0)
    problems.push(
      `${manifest.name} (${dir}) would publish without:\n${missing
        .map((m) => `  ${m}`)
        .join('\n')}`,
    );
  else
    console.log(
      `  ok  ${manifest.name}: ${packed.size} files, every declared one packed`,
    );
}

if (problems.length > 0) {
  console.error(
    `\n${problems.join('\n')}\n\nBuild first (npm run build): the release publishes with --ignore-scripts,` +
      '\nso nothing but the build makes these files.',
  );
  process.exit(1);
}
