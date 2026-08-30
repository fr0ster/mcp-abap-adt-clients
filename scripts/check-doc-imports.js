#!/usr/bin/env node
/**
 * Every identifier the documentation imports must exist.
 *
 * Documentation goes stale silently. A README that imports a class deleted two
 * releases ago compiles nothing and fails no test — it just wastes the time of
 * whoever believed it. `RfcAbapConnection` sat in `docs/usage/RFC_CONNECTION.md`
 * through the removal of the class it named, and the only reason it was found is
 * that somebody went looking.
 *
 * So: collect every `import { … } from '…'` inside a fenced block in the
 * user-facing docs, and check each name against what this package and its two
 * first-party dependencies actually export. Nothing is compiled here — that is
 * deliberate, because a doc snippet is a fragment and compiling it needs a
 * harness. This catches the failure that actually happens: a name that is gone.
 *
 * Third-party imports are skipped: their exports are not ours to police, and a
 * wrong one there is a different kind of mistake.
 *
 * Since 15.0.0 each module specifier answers for itself, and the check is
 * stricter for this package. Two holes closed, both of which let a broken
 * snippet pass:
 *
 * - One pooled set across all three packages meant
 *   `import { AdtClient } from '@mcp-abap-adt/interfaces'` passed, because
 *   `AdtClient` is real *here*. The reader would still be told to import from a
 *   package that has no such export.
 * - Measuring this package against every identifier under `src` passed
 *   `import { compareRecordedAt } from '@mcp-abap-adt/adt-clients'` while the
 *   entry point did not re-export it: real, and unreachable.
 *
 * So: this package is measured against what `src/index.ts` reaches through its
 * barrels, each dependency against its own `types` entry, and relative imports
 * against the loose set — those name internal paths on purpose.
 *
 * Run: npm run check:docs
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** Docs a reader is expected to follow. Working notes are not included. */
const DOC_ROOTS = [
  'docs',
  'README.md',
  'src/__tests__/README.md',
  'src/__tests__/helpers/README.md',
  'src/__tests__/e2e/README.md',
];

/** Packages whose exports we can check. Anything else is somebody else's. */
const OURS = [
  '@mcp-abap-adt/adt-clients',
  '@mcp-abap-adt/interfaces',
  '@mcp-abap-adt/connection',
];

const EXPORT =
  /export\s+(?:async\s+)?(?:declare\s+)?(?:function|class|const|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

function namesIn(files) {
  const names = new Set();
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(EXPORT)) names.add(m[1]);
    // `export { A, B } from './x'` and re-export barrels
    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const raw of m[1].split(',')) {
        const name = raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .pop();
        if (name) names.add(name.trim());
      }
    }
  }
  return names;
}

/**
 * Every identifier under `src`, regardless of whether anything exports it on.
 *
 * Only relative imports are measured against this: a doc writing `from './x'`
 * is naming an internal path on purpose, and the entry point has no opinion
 * about it.
 */
function looseSrcNames() {
  return namesIn(
    walk(path.join(ROOT, 'src')).filter(
      (f) => f.endsWith('.ts') || f.endsWith('.js'),
    ),
  );
}

/** `'./x'` → the file it means, or null when it is not ours to follow. */
function resolveModule(spec, fromFile) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    `${base}.ts`,
    `${base}.d.ts`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.d.ts'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * What an installed dependency hands out, from its own type entry point.
 *
 * Per package, never pooled. One shared set across all three packages let
 * `import { AdtClient } from '@mcp-abap-adt/interfaces'` pass: the name is real
 * in this repository, and `interfaces` does not export it — the doc would still
 * be telling a reader to import from a package that has no such thing.
 *
 * Falls back to every name in `dist` when the entry cannot be resolved, which
 * is looser but still confined to that one package.
 */
function dependencyNames(pkg) {
  const root = path.join(ROOT, 'node_modules', pkg);
  if (!fs.existsSync(root)) return null;

  let entry;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    const types = manifest.types || manifest.typings;
    if (types) entry = path.join(root, types);
  } catch {
    // Unreadable manifest: fall through to the dist scan.
  }

  if (entry && fs.existsSync(entry)) return publicNames(entry);

  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist)) return null;
  return namesIn(walk(dist).filter((f) => f.endsWith('.d.ts')));
}

/**
 * What `import { … } from '@mcp-abap-adt/adt-clients'` can actually name.
 *
 * Walks the barrels from the entry point, so a module that exports a symbol
 * without the entry point re-exporting it does not count.
 */
function publicNames(entry, seen = new Set()) {
  const names = new Set();
  if (seen.has(entry) || !fs.existsSync(entry)) return names;
  seen.add(entry);

  const text = fs.readFileSync(entry, 'utf8');
  for (const m of text.matchAll(EXPORT)) names.add(m[1]);
  for (const m of text.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop();
      if (name) names.add(name.trim());
    }
  }
  for (const m of text.matchAll(/export\s*\*\s*from\s*'([^']+)'/g)) {
    const target = resolveModule(m[1], entry);
    if (target) for (const n of publicNames(target, seen)) names.add(n);
  }
  return names;
}

function docFiles() {
  const out = [];
  for (const entry of DOC_ROOTS) {
    const full = path.join(ROOT, entry);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isDirectory())
      out.push(...walk(full).filter((f) => f.endsWith('.md')));
    else out.push(full);
  }
  return out;
}

const loose = looseSrcNames();

/**
 * One surface per module specifier — the whole point of the check.
 *
 * A package absent from `node_modules` maps to `null`, and names imported from
 * it are skipped rather than reported: an uninstalled dependency is a missing
 * measurement, not a broken document.
 */
const SURFACES = new Map([
  [OURS[0], publicNames(path.join(ROOT, 'src', 'index.ts'))],
  ...OURS.slice(1).map((pkg) => [pkg, dependencyNames(pkg)]),
]);

const unmeasured = OURS.filter((p) => SURFACES.get(p) === null);
const problems = [];

for (const file of docFiles()) {
  const text = fs.readFileSync(file, 'utf8');
  // `import type { … }` counts too: a type-only import names an export just as
  // a value import does, and it was slipping through unchecked.
  for (const m of text.matchAll(
    /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g,
  )) {
    const from = m[2];
    const relative = from.startsWith('.');
    if (!relative && !OURS.includes(from)) continue;
    // Each package answers for itself; a relative path is measured against the
    // loose set, since it names an internal file deliberately.
    const allowed = relative ? loose : SURFACES.get(from);
    if (!allowed) continue; // dependency not installed — nothing measured
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '');
      if (name && !allowed.has(name)) {
        const line = text.slice(0, m.index).split('\n').length;
        // Saying WHERE it does exist turns "no such name" into the fix.
        const elsewhere = OURS.filter(
          (p) => p !== from && SURFACES.get(p)?.has(name),
        );
        const detail = elsewhere.length
          ? `(not exported by ${from} — it is in ${elsewhere.join(', ')})`
          : loose.has(name) && from === OURS[0]
            ? '(exists, but src/index.ts does not re-export it)'
            : `(documented as coming from ${from})`;
        problems.push(
          `${path.relative(ROOT, file)}:${line}  ${name}  ${detail}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error('Documentation imports names that do not exist:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\n${problems.length} broken import(s). Either the doc is stale, or the export was renamed and the doc was not.`,
  );
  process.exit(1);
}

console.log(
  `check:docs — ${docFiles().length} documents, every imported name is exported ` +
    'by the package it is imported from.',
);
if (unmeasured.length > 0) {
  // Never silently: a skipped package looks exactly like a clean one.
  console.log(
    `  not measured, package not installed: ${unmeasured.join(', ')}`,
  );
}
