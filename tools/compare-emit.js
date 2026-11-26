// Whether two builds emit the same JavaScript, a type-only change's proof (#304).
//   node tools/compare-emit.js <dist before> <dist after>
//
// Every `.js` file is parsed and printed again with its parentheses removed,
// then compared. Deleting `(x as T)` leaves `(x)` in TypeScript's output; the
// parentheses change no evaluation, so they are not a difference here.
// Anything else is: a file added (unless it holds types only) or removed, or
// any other change of code.
// Source maps and declaration files are not compared.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function jsFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return jsFiles(f, base);
    return f.endsWith('.js') ? [path.relative(base, f)] : [];
  });
}

function normalized(file) {
  const sf = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const strip = (context) => {
    const visit = (node) => {
      if (ts.isParenthesizedExpression(node)) return visit(node.expression);
      return ts.visitEachChild(node, visit, context);
    };
    return (root) => ts.visitNode(root, visit);
  };
  const [out] = ts.transform(sf, [strip]).transformed;
  return ts.createPrinter({ removeComments: true }).printFile(out);
}

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: node tools/compare-emit.js <dist before> <dist after>');
  process.exit(2);
}
const a = new Set(jsFiles(before));
const b = new Set(jsFiles(after));
const differences = [];
for (const f of a) if (!b.has(f)) differences.push(`removed: ${f}`);
/** A module of types only emits nothing but the module marker. */
function typesOnly(file) {
  const text = normalized(file);
  return (
    text
      .split('\n')
      .filter(
        (line) =>
          line.trim() !== '' &&
          line.trim() !== '"use strict";' &&
          line.trim() !==
            'Object.defineProperty(exports, "__esModule", { value: true });',
      ).length === 0
  );
}
for (const f of b)
  if (!a.has(f) && !typesOnly(path.join(after, f)))
    differences.push(`added: ${f}`);
for (const f of a) {
  if (
    b.has(f) &&
    normalized(path.join(before, f)) !== normalized(path.join(after, f))
  ) {
    differences.push(`changed: ${f}`);
  }
}
if (differences.length > 0) {
  for (const d of differences) console.log(d);
  process.exit(1);
}
console.log(`emit: ${a.size} file(s) identical`);
