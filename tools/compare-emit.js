// Whether two builds emit the same JavaScript, a type-only change's proof (#304).
//   node tools/compare-emit.js <dist before> <dist after>
//
// Every `.js` file is parsed and printed again with its redundant parentheses
// removed, then compared. Deleting `(x as T)` leaves `(x)` in TypeScript's
// output; such parentheses change no evaluation, so they are not a difference
// here. Parentheses that do — precedence, short-circuiting, an optional
// chain's end (`(a?.b).c` is not `a?.b.c`), a comma, an object literal at a
// statement's start — are kept, and compared.
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

/** An expression whose parentheses never change what it means around it. */
function isAtom(e) {
  if (ts.isOptionalChain(e)) return false;
  return (
    ts.isIdentifier(e) ||
    e.kind === ts.SyntaxKind.ThisKeyword ||
    e.kind === ts.SyntaxKind.SuperKeyword ||
    e.kind === ts.SyntaxKind.TrueKeyword ||
    e.kind === ts.SyntaxKind.FalseKeyword ||
    e.kind === ts.SyntaxKind.NullKeyword ||
    ts.isStringLiteral(e) ||
    ts.isNumericLiteral(e) ||
    ts.isBigIntLiteral(e) ||
    ts.isNoSubstitutionTemplateLiteral(e) ||
    ts.isTemplateExpression(e) ||
    ts.isArrayLiteralExpression(e) ||
    ts.isParenthesizedExpression(e) ||
    // Left-hand-side forms, when no optional chain runs through them.
    ((ts.isPropertyAccessExpression(e) ||
      ts.isElementAccessExpression(e) ||
      ts.isCallExpression(e)) &&
      !(e.flags & ts.NodeFlags.OptionalChain)) ||
    (ts.isNewExpression(e) && e.arguments !== undefined)
  );
}

/** A form that needs its parentheses at a statement's start or as an arrow's body. */
const needsAtStart = (e) =>
  ts.isObjectLiteralExpression(e) ||
  ts.isFunctionExpression(e) ||
  ts.isClassExpression(e);

/** A slot that takes any expression but a comma: removing parentheses there changes nothing. */
function isOpenSlot(p) {
  const parent = p.parent;
  if (!parent) return false;
  return (
    ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      (parent.arguments ?? []).includes(p)) ||
    ts.isArrayLiteralExpression(parent) ||
    (ts.isVariableDeclaration(parent) && parent.initializer === p) ||
    (ts.isPropertyAssignment(parent) && parent.initializer === p) ||
    ts.isReturnStatement(parent) ||
    ts.isSpreadElement(parent) ||
    ts.isTemplateSpan(parent) ||
    (ts.isElementAccessExpression(parent) && parent.argumentExpression === p) ||
    (ts.isIfStatement(parent) && parent.expression === p) ||
    (ts.isWhileStatement(parent) && parent.expression === p) ||
    (ts.isParameter(parent) && parent.initializer === p)
  );
}

/** Whether `p`'s parentheses are redundant. */
function redundant(p) {
  const e = p.expression;
  const parent = p.parent;
  const atStart =
    (parent && ts.isExpressionStatement(parent)) ||
    (parent && ts.isArrowFunction(parent) && parent.body === p);
  if (atStart && needsAtStart(e)) return false;
  if (isAtom(e)) return true;
  const comma =
    ts.isBinaryExpression(e) &&
    e.operatorToken.kind === ts.SyntaxKind.CommaToken;
  return isOpenSlot(p) && !comma;
}

function normalizedText(name, text) {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const strip = (context) => {
    const visit = (node) => {
      if (ts.isParenthesizedExpression(node) && redundant(node))
        return visit(node.expression);
      return ts.visitEachChild(node, visit, context);
    };
    return (root) => ts.visitNode(root, visit);
  };
  const [out] = ts.transform(sf, [strip]).transformed;
  return ts.createPrinter({ removeComments: true }).printFile(out);
}

function normalized(file) {
  return normalizedText(file, fs.readFileSync(file, 'utf8'));
}

module.exports = { normalizedText };

function main() {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) {
    console.error(
      'usage: node tools/compare-emit.js <dist before> <dist after>',
    );
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
}

if (require.main === module) main();
