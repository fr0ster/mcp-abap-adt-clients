#!/usr/bin/env node
/**
 * Every identifier the documentation imports must be exported by the package it
 * is imported from.
 *
 * Documentation goes stale silently. A README that imports a class deleted two
 * releases ago compiles nothing and fails no test — it just wastes the time of
 * whoever believed it. `RfcAbapConnection` sat in `docs/usage/RFC_CONNECTION.md`
 * through the removal of the class it named, and the only reason it was found is
 * that somebody went looking.
 *
 * **Nothing here reads code with a pattern.** That is not a style preference, it
 * is what four review rounds cost: `import type { … }` unread, a specifier in
 * double quotes unread, names pooled across three packages, `~~~typescript`
 * fences unread. Every one of them made a line *invisible* rather than
 * mis-parsed — and a pattern that does not match reports success, so each hole
 * left this gate claiming something untrue until somebody happened to test it.
 *
 * So: fences come from a Markdown parser and imports from the TypeScript parser
 * (both in `./doc-imports.js`), and what a module exports comes from the
 * TypeScript **type checker**, which answers that question rather than
 * describing what the text looks like. Barrels, `export * from`, aliases and
 * type-only exports are then somebody else's solved problem.
 *
 * Third-party imports are skipped: their exports are not ours to police, and a
 * wrong one there is a different kind of mistake.
 *
 * Run: npm run check:docs
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { importsIn } = require('./doc-imports');

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

/**
 * What a module exports, according to the type checker.
 *
 * Null when the entry cannot be loaded, so a caller can report "unmeasured"
 * rather than let an unchecked import look clean.
 */
const exportsCache = new Map();
function exportsOf(entry) {
  if (exportsCache.has(entry)) return exportsCache.get(entry);

  let names = null;
  if (fs.existsSync(entry)) {
    const program = ts.createProgram([entry], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
    });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entry);
    const symbol = source && checker.getSymbolAtLocation(source);
    if (symbol) {
      names = new Set(
        checker.getExportsOfModule(symbol).map((s) => s.getName()),
      );
    }
  }

  exportsCache.set(entry, names);
  return names;
}

/** The `types` entry an installed dependency points at, if it is installed. */
function dependencyEntry(pkg) {
  const root = path.join(ROOT, 'node_modules', pkg);
  if (!fs.existsSync(root)) return null;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    const types = manifest.types || manifest.typings;
    if (!types) return null;
    const entry = path.join(root, types);
    return fs.existsSync(entry) ? entry : null;
  } catch {
    return null;
  }
}

const sourceFiles = walk(path.join(ROOT, 'src')).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.d.ts'),
);

/**
 * The file a relative import in a snippet means.
 *
 * A snippet's `../../helpers/testLogger` is relative to the file a reader would
 * write, not to the document, so it cannot be resolved as a path. Matched by
 * suffix within `src` instead, and only when exactly one file matches —
 * otherwise the import is reported as unmeasured rather than guessed at.
 */
function relativeEntry(specifier) {
  const wanted = specifier.replace(/^[./]+/, '');
  const matches = sourceFiles.filter(
    (f) =>
      f.endsWith(`${path.sep}${wanted}.ts`) ||
      f.endsWith(`${path.sep}${wanted}${path.sep}index.ts`),
  );
  return matches.length === 1 ? matches[0] : null;
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

/** One surface per module specifier — the whole point of the check. */
const SURFACES = new Map([
  [OURS[0], exportsOf(path.join(ROOT, 'src', 'index.ts'))],
  ...OURS.slice(1).map((pkg) => {
    const entry = dependencyEntry(pkg);
    return [pkg, entry ? exportsOf(entry) : null];
  }),
]);

/** Imports whose names are not exported by what they name. */
const problems = [];
/**
 * Imports that could not be measured at all — a failure, not a footnote.
 *
 * An unmeasured import is indistinguishable from a clean one in a passing run,
 * which is the exact defect this gate keeps being fixed for. The two reasons
 * are kept apart because the fixes differ: a relative path matching no file is
 * a stale document, while a missing first-party package is an incomplete
 * install, and the gate cannot do its job either way.
 */
const unmeasured = [];

for (const file of docFiles()) {
  const text = fs.readFileSync(file, 'utf8');
  for (const { specifier: from, names, defaultImport, line } of importsIn(
    text,
  )) {
    const relative = from.startsWith('.');
    if (!relative && !OURS.includes(from)) continue;

    const where = `${path.relative(ROOT, file)}:${line}`;
    const entry = relative ? relativeEntry(from) : null;
    const allowed = relative ? entry && exportsOf(entry) : SURFACES.get(from);
    if (!allowed) {
      const why = relative
        ? 'no single file under src/ matches this path'
        : 'package not installed';
      unmeasured.push(`${where}  ${from}  (${why})`);
      continue;
    }

    if (defaultImport && !allowed.has('default')) {
      // Report what the reader wrote, not the word `default` — and if that name
      // is a named export, say so, because that is the correction.
      const named = allowed.has(defaultImport);
      problems.push(
        `${where}  ${defaultImport}  (default import, but ${from} has no ` +
          `default export${named ? ` — ${defaultImport} is a named export` : ''})`,
      );
    }

    for (const name of names) {
      if (allowed.has(name)) continue;
      // Saying WHERE it does exist turns "no such name" into the fix.
      const elsewhere = OURS.filter(
        (p) => p !== from && SURFACES.get(p)?.has(name),
      );
      problems.push(
        `${where}  ${name}  ${
          elsewhere.length
            ? `(not exported by ${from} — it is in ${elsewhere.join(', ')})`
            : `(documented as coming from ${from})`
        }`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Documentation imports names that do not exist:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\n${problems.length} broken import(s). Either the doc is stale, or the export was renamed and the doc was not.`,
  );
}

if (unmeasured.length > 0) {
  if (problems.length > 0) console.error('');
  console.error('Documentation imports that could not be checked:\n');
  for (const note of unmeasured) console.error(`  ${note}`);
  console.error(
    `\n${unmeasured.length} unchecked import(s). Either the document names a ` +
      'module this repository does not have, or a first-party package is not ' +
      'installed — and an unchecked import passing quietly is what this gate ' +
      'exists to prevent.',
  );
}

if (problems.length > 0 || unmeasured.length > 0) {
  process.exit(1);
}

console.log(
  `check:docs — ${docFiles().length} documents, every imported name is exported ` +
    'by the package it is imported from.',
);
