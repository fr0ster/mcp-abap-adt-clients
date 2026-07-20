/**
 * Derive the capability matrix for IAdtObject implementations.
 *
 * Answers, per handler and per contract method: does the implementation do real
 * work, refuse (throw "not supported"), return a stub, or not declare the method
 * at all? The spec that consumes this must cite generated output — hand-copied
 * counts have been wrong three separate times.
 *
 * Usage: node scripts/capability-matrix.mjs [--csv]
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const CONTRACT_METHODS = [
  'validate',
  'create',
  'read',
  'readMetadata',
  'update',
  'delete',
  'activate',
  'check',
  'readTransport',
  'lock',
  'unlock',
  'getVersions',
  'getVersionSource',
];

/** a = real work, b = refuses, c = stub, d = not declared */
const VERDICT = { REAL: 'a', REFUSES: 'b', STUB: 'c', ABSENT: 'd' };

function handlerFiles(root) {
  const out = [];
  for (const dir of readdirSync(root)) {
    const d = join(root, dir);
    if (!statSync(d).isDirectory()) continue;
    for (const f of readdirSync(d)) {
      if (!f.startsWith('Adt') || !f.endsWith('.ts')) continue;
      if (f.endsWith('Legacy.ts')) continue; // subclasses: overrides only
      out.push(join(d, f));
    }
  }
  return out.sort();
}

/**
 * Does this body refuse the operation? A refusal is a throw that is NOT inside a
 * conditional — i.e. the method's whole purpose is to reject. A throw inside an
 * `if` is ordinary error handling and does not count.
 */
function classify(body, sf) {
  if (!body || !body.statements.length) return VERDICT.STUB;

  for (const stmt of body.statements) {
    if (ts.isThrowStatement(stmt)) return VERDICT.REFUSES;
    // `return throwUnsupportedX(...)` and bare calls to a thrower
    const text = stmt.getText(sf);
    if (/^\s*(return\s+)?throwUnsupported\w*\s*\(/.test(text))
      return VERDICT.REFUSES;
  }

  // Real work = it talks to the connection, or delegates to something that does.
  const text = body.getText(sf);
  const doesWork =
    /\bmakeAdtRequest\b/.test(text) ||
    /\bawait\s+/.test(text) ||
    /\bthis\.(connection|class|adtClass|utils)\b/.test(text);

  return doesWork ? VERDICT.REAL : VERDICT.STUB;
}

const root = 'src/core';
const files = handlerFiles(root);
const program = ts.createProgram(files, {
  allowJs: false,
  noResolve: true,
  target: ts.ScriptTarget.ES2020,
});

const rows = new Map();

for (const file of files) {
  const sf = program.getSourceFile(file);
  if (!sf) continue;
  ts.forEachChild(sf, (node) => {
    if (!ts.isClassDeclaration(node) || !node.name) return;
    const cls = node.name.text;
    if (!cls.startsWith('Adt')) return;

    // Only classes that actually promise the contract belong in the matrix.
    // Filtering by heritage (not by name) keeps out facades like AdtService
    // and utilities like AdtUtils that never claim to implement IAdtObject.
    // A subclass (e.g. AdtCdsUnitTest extends AdtUnitTest) inherits the
    // promise, so an `extends Adt*` clause counts too.
    const CONTRACT_IFACES = new Set([
      'IAdtObject',
      'IFeatureToggleObject',
      'IAdtServiceBinding',
    ]);
    const promisesContract = (node.heritageClauses ?? []).some((h) =>
      h.types.some((t) => {
        const name = t.expression.getText(sf);
        if (h.token === ts.SyntaxKind.ImplementsKeyword)
          return CONTRACT_IFACES.has(name);
        // extends an Adt* handler => inherits the contract
        return (
          h.token === ts.SyntaxKind.ExtendsKeyword && name.startsWith('Adt')
        );
      }),
    );
    if (!promisesContract) return;

    const verdicts = Object.fromEntries(
      CONTRACT_METHODS.map((m) => [m, VERDICT.ABSENT]),
    );
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) continue;
      const name = member.name.getText(sf);
      if (!CONTRACT_METHODS.includes(name)) continue;
      verdicts[name] = classify(member.body, sf);
    }
    // A pure alias subclass (e.g. `class AdtService extends AdtServiceBinding {}`)
    // declares no contract method of its own — every verdict is "absent". Its
    // behaviour is its parent's, already counted, so drop it to avoid double-counting.
    if (CONTRACT_METHODS.every((m) => verdicts[m] === VERDICT.ABSENT)) return;

    rows.set(cls, { file, verdicts });
  });
}

const csv = process.argv.includes('--csv');

if (csv) {
  console.log(['handler', ...CONTRACT_METHODS].join(','));
  for (const [cls, { verdicts }] of rows)
    console.log([cls, ...CONTRACT_METHODS.map((m) => verdicts[m])].join(','));
} else {
  console.log(`handlers analysed: ${rows.size}\n`);
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `${pad('method', 18)}${pad('real', 6)}${pad('refuses', 9)}${pad('stub', 6)}${pad('absent', 8)}`,
  );
  for (const m of CONTRACT_METHODS) {
    const c = { a: 0, b: 0, c: 0, d: 0 };
    const notReal = [];
    for (const [cls, { verdicts }] of rows) {
      c[verdicts[m]]++;
      if (verdicts[m] === 'b' || verdicts[m] === 'c')
        notReal.push(`${cls.replace(/^Adt/, '')}:${verdicts[m]}`);
    }
    console.log(
      `${pad(m, 18)}${pad(c.a, 6)}${pad(c.b, 9)}${pad(c.c, 6)}${pad(c.d, 8)}` +
        (notReal.length ? `  ${notReal.join(' ')}` : ''),
    );
  }
}
