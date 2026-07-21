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

/** A top-level throw / `return throwUnsupported*()` means the method refuses. */
function refuses(body, sf) {
  if (!body) return false;
  for (const stmt of body.statements) {
    if (ts.isThrowStatement(stmt)) return true;
    if (/^\s*(return\s+)?throwUnsupported\w*\s*\(/.test(stmt.getText(sf)))
      return true;
  }
  return false;
}

/**
 * Does the body itself perform real ADT work — directly? "Directly" means it
 * awaits, calls makeAdtRequest, or hands `this.connection` to something. It does
 * NOT include plain `this.method(...)` delegation; that is resolved transitively
 * by the caller, so that a fabricated stub which merely reads `this.state` is not
 * mistaken for real work.
 */
function worksDirectly(body, sf) {
  if (!body) return false;
  const text = body.getText(sf);
  // Delegation to a composed member's method — `this.<field>.<method>(...)`,
  // e.g. `this.versionsCap.getVersions(config)` or `this.class.lock(...)` — is
  // real work. Exclude `this.logger.*` so a stub that only logs is not counted.
  const delegatesToMember = [...text.matchAll(/\bthis\.(\w+)\.\w+\s*\(/g)].some(
    (m) => m[1] !== 'logger',
  );
  return (
    /\bmakeAdtRequest\b/.test(text) ||
    /\bawait\b/.test(text) ||
    /\bthis\.connection\b/.test(text) ||
    delegatesToMember
  );
}

/** The `this.<name>(` methods a body delegates to. */
function delegatesTo(body, sf) {
  if (!body) return [];
  return [...body.getText(sf).matchAll(/\bthis\.(\w+)\s*\(/g)].map((m) => m[1]);
}

const root = 'src/core';
const files = handlerFiles(root);
const program = ts.createProgram(files, {
  allowJs: false,
  noResolve: true,
  target: ts.ScriptTarget.ES2020,
});

const CONTRACT_IFACES = new Set([
  'IAdtObject',
  'IFeatureToggleObject',
  'IAdtServiceBinding',
]);

// Pass 1: collect every Adt* class with its OWN verdicts and its base class name.
// We defer the contract test and inheritance resolution to pass 2, because a class
// may promise the contract only through a base we have not parsed yet.
const candidates = new Map(); // name -> { file, own, base, implementsContract }

for (const file of files) {
  const sf = program.getSourceFile(file);
  if (!sf) continue;
  ts.forEachChild(sf, (node) => {
    if (!ts.isClassDeclaration(node) || !node.name) return;
    const cls = node.name.text;
    if (!cls.startsWith('Adt')) return;

    let base = null;
    let implementsContract = false;
    for (const h of node.heritageClauses ?? []) {
      for (const t of h.types) {
        const name = t.expression.getText(sf);
        if (h.token === ts.SyntaxKind.ImplementsKeyword) {
          if (CONTRACT_IFACES.has(name)) implementsContract = true;
        } else if (h.token === ts.SyntaxKind.ExtendsKeyword) {
          base = name;
        }
      }
    }

    // Record every method (not only contract ones), so delegation targets like
    // `_upsertMessage` / `readSource` can be followed transitively.
    const methods = new Map(); // name -> { refuses, worksDirectly, delegates }
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) continue;
      const name = member.name.getText(sf);
      methods.set(name, {
        refuses: refuses(member.body, sf),
        worksDirectly: worksDirectly(member.body, sf),
        delegates: delegatesTo(member.body, sf),
      });
    }
    candidates.set(cls, { file, methods, base, implementsContract });
  });
}

/** Resolve a method to its declaring class along the extends chain. */
function findMethod(cls, method, seen = new Set()) {
  const c = candidates.get(cls);
  if (!c || seen.has(cls)) return null;
  seen.add(cls);
  if (c.methods.has(method)) return { cls, info: c.methods.get(method) };
  return c.base ? findMethod(c.base, method, seen) : null;
}

/** True if `method` on `cls` does real work directly or via any delegation it reaches. */
function doesRealWork(cls, method, guard = new Set()) {
  const key = `${cls}.${method}`;
  if (guard.has(key)) return false; // cycle
  guard.add(key);
  const found = findMethod(cls, method);
  if (!found) return false;
  if (found.info.worksDirectly) return true;
  return found.info.delegates.some((d) => doesRealWork(found.cls, d, guard));
}

/** Contract verdict for a method: absent / refuses / real / stub. */
function verdictFor(cls, method) {
  const found = findMethod(cls, method);
  if (!found) return VERDICT.ABSENT;
  if (found.info.refuses) return VERDICT.REFUSES;
  return doesRealWork(cls, method) ? VERDICT.REAL : VERDICT.STUB;
}

// Does this class promise the contract — directly, or by extending one that does?
function promisesContract(name, seen = new Set()) {
  const c = candidates.get(name);
  if (!c || seen.has(name)) return false;
  seen.add(name);
  return (
    c.implementsContract || (c.base ? promisesContract(c.base, seen) : false)
  );
}

const rows = new Map();
for (const [cls, c] of candidates) {
  if (!promisesContract(cls)) continue; // excludes AdtUtils and other non-handlers
  // A pure-alias subclass declaring no method of its own resolves entirely from
  // its parent; drop it so it does not double-count the parent it merely renames.
  if (c.methods.size === 0) continue;
  const verdicts = Object.fromEntries(
    CONTRACT_METHODS.map((m) => [m, verdictFor(cls, m)]),
  );
  rows.set(cls, { file: c.file, verdicts });
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
