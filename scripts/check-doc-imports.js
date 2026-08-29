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

function exported() {
  const files = [
    ...walk(path.join(ROOT, 'src')).filter(
      (f) => f.endsWith('.ts') || f.endsWith('.js'),
    ),
  ];
  for (const pkg of OURS.slice(1)) {
    const dist = path.join(ROOT, 'node_modules', pkg, 'dist');
    if (fs.existsSync(dist))
      files.push(...walk(dist).filter((f) => f.endsWith('.d.ts')));
  }
  return namesIn(files);
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

const known = exported();
const problems = [];

for (const file of docFiles()) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const from = m[2];
    const mine = OURS.some((p) => from === p) || from.startsWith('.');
    if (!mine) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '');
      if (name && !known.has(name)) {
        const line = text.slice(0, m.index).split('\n').length;
        problems.push(
          `${path.relative(ROOT, file)}:${line}  ${name}  (documented as coming from ${from})`,
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
  `check:docs — ${docFiles().length} documents, every imported name exists.`,
);
