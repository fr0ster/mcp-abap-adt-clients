// The forbidden forms of #304, found in a package's production `src`.
//   node tools/sourceRules.js --inventory [packages/<name>/tsconfig.json …]
//
// One definition for the inventory and for the guard test each package runs
// (`src/__tests__/…/sourceRules.test.ts`). It reads the AST and asks the type
// checker; it runs no regular expression over source. The rules are spec
// section 1 of docs/superpowers/specs/2026-11-26-no-casts-no-regex-spec.md:
//
// - C  a cast: an `as` whose type is not `const`, or a `<T>x` assertion;
// - Y  `any`: the keyword in a type position, and an expression typed `any`
//      that is neither the initializer of a declaration annotated `unknown`
//      nor an argument to a parameter declared `unknown` (any-flow);
// - N  a hand-narrowed contract value: an `unknown` binding reached by a value
//      whose type is neither `unknown` nor `any` (a widening), and narrowed by
//      hand. A boundary reader's own parameters are exempt;
// - R  a regular expression: a literal, a reference to `RegExp`, a reference to
//      `String.prototype.match`, `matchAll` or `search`, a reference to
//      `Symbol.match`/`matchAll`/`replace`/`search`/`split`, and a call or
//      property access whose value is a `RegExp` that does not come from one
//      of those in the same file;
// - P  an explicit type predicate (`x is T`, `asserts x is T`), allowed only in
//      a reader of data from outside the type system: a function in a reader
//      module whose narrowed parameter is declared `unknown`.
//
// A finding is `{ file, line, column, rule, kind, text }`; `text` is the node's
// source with whitespace runs collapsed, so a baseline keyed on
// `{ file, rule, kind, text }` survives a line move.
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

/**
 * The modules whose job is to read values from outside the type system. Their
 * own `unknown` parameters are from outside by definition, so a typed value
 * passed to them is no widening. Changes only with the owner's approval.
 */
const BOUNDARY_MODULES = [
  // parsed XML: the readers every strategy reads a parsed document with
  'packages/adt-strategies/src/parsed.ts',
  // thrown values and `unknown` contract fields (spec section 3.5)
  'packages/adt-clients/src/utils/ownValue.ts',
];

/**
 * The modules that read SAP's answers, parsed XML or JSON, or files, where an
 * explicit type predicate over an `unknown` parameter is allowed (C6).
 */
const READER_MODULES = [
  'packages/adt-strategies/src/parsed.ts',
  'packages/adt-strategies/src/results/',
  'packages/adt-strategies/src/refusals/',
  'packages/adt-clients/src/utils/ownValue.ts',
  // adt-clients' readers of parsed XML from SAP's answers
  'packages/adt-clients/src/core/messageClass/xml.ts',
  'packages/adt-clients/src/core/tableSettings/readDocument.ts',
  'packages/adt-clients/src/utils/activationUtils.ts',
];

const STRING_REGEX_METHODS = new Set(['match', 'matchAll', 'search']);
const REGEX_SYMBOLS = new Set([
  'match',
  'matchAll',
  'replace',
  'search',
  'split',
]);

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function collapse(text) {
  let out = '';
  let space = false;
  for (const ch of text) {
    const isSpace = ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
    if (isSpace) {
      space = true;
      continue;
    }
    if (space && out !== '') out += ' ';
    space = false;
    out += ch;
  }
  return out;
}

function isProduction(file, srcDir) {
  if (!file.startsWith(srcDir + path.sep)) return false;
  const rel = file.slice(srcDir.length + 1).split(path.sep);
  if (rel.includes('__tests__')) return false;
  return !(file.endsWith('.test.ts') || file.endsWith('.d.ts'));
}

/** Whether `file` is an entry of `list`: repository-relative, or absolute. */
function inList(file, list) {
  const rel = relative(file);
  const abs = path.resolve(file).split(path.sep).join('/');
  return list.some((entry) => {
    const name = path.isAbsolute(entry) ? abs : rel;
    return entry.endsWith('/') ? name.startsWith(entry) : name === entry;
  });
}

function fromLib(symbol) {
  return (symbol?.declarations ?? []).some((d) =>
    d
      .getSourceFile()
      .fileName.includes(`${path.sep}typescript${path.sep}lib${path.sep}`),
  );
}

/** Whether `type` is (or contains, as a union member) `any` or `unknown`. */
function isLoose(type) {
  return Boolean(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));
}

function isRegExpType(type) {
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  return Boolean(symbol && symbol.getName() === 'RegExp' && fromLib(symbol));
}

/**
 * Every finding of the forbidden forms in the production `src` of the package
 * whose `tsconfig.json` is given.
 */
function findForbidden(
  tsconfigPath,
  { boundaryModules = BOUNDARY_MODULES, readerModules = READER_MODULES } = {},
) {
  const configFile = path.resolve(tsconfigPath);
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  if (!parsed) throw new Error(`Cannot read ${configFile}`);
  const srcDir = path.join(path.dirname(configFile), 'src');
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: {
      ...parsed.options,
      noEmit: true,
      composite: false,
      incremental: false,
    },
  });
  const checker = program.getTypeChecker();
  const files = program
    .getSourceFiles()
    .filter((sf) => isProduction(path.resolve(sf.fileName), srcDir));
  const findings = [];
  const add = (sf, node, rule, kind) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(
      node.getStart(sf),
    );
    findings.push({
      file: relative(path.resolve(sf.fileName)),
      line: line + 1,
      column: character + 1,
      rule,
      kind,
      text: collapse(node.getText(sf)),
    });
  };

  // N: the bindings declared `unknown`, and the widenings that reach them.
  const unknownBindings = new Map(); // declaration node -> { sf, widened: boolean }
  const isUnknownAnnotation = (typeNode) =>
    Boolean(typeNode && typeNode.kind === ts.SyntaxKind.UnknownKeyword);
  const declarationOf = (expr) => {
    const symbol = checker.getSymbolAtLocation(expr);
    const target =
      symbol && symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    return target?.valueDeclaration;
  };
  const typed = (expr) => !isLoose(checker.getTypeAtLocation(expr));

  for (const sf of files) {
    const boundary = inList(sf.fileName, boundaryModules);
    const collect = (node) => {
      if (
        (ts.isParameter(node) || ts.isVariableDeclaration(node)) &&
        isUnknownAnnotation(node.type) &&
        !(boundary && ts.isParameter(node))
      ) {
        unknownBindings.set(node, { sf, widened: false });
      }
      ts.forEachChild(node, collect);
    };
    collect(sf);
  }
  const markWidening = (declaration, value) => {
    const entry = unknownBindings.get(declaration);
    if (entry && typed(value)) entry.widened = true;
  };
  for (const sf of files) {
    const flows = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        markWidening(node, node.initializer);
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        const d = declarationOf(node.left);
        if (d) markWidening(d, node.right);
      }
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        node.arguments
      ) {
        const signature = checker.getResolvedSignature(node);
        const declaration = signature?.declaration;
        if (
          declaration &&
          'parameters' in declaration &&
          declaration.parameters
        ) {
          declaration.parameters.forEach((p, i) => {
            const arg = node.arguments[i];
            if (arg) markWidening(p, arg);
          });
        }
      }
      ts.forEachChild(node, flows);
    };
    flows(sf);
  }
  const narrowedBinding = (expr) => {
    if (!ts.isIdentifier(expr)) return undefined;
    const d = declarationOf(expr);
    const entry = d && unknownBindings.get(d);
    return entry?.widened ? d : undefined;
  };
  const reportedN = new Set();

  for (const sf of files) {
    const file = path.resolve(sf.fileName);
    const reader = inList(file, readerModules);
    const regexSources = new Set();
    const visit = (node) => {
      // C
      if (ts.isAsExpression(node)) {
        const t = node.type;
        const isConst =
          ts.isTypeReferenceNode(t) &&
          ts.isIdentifier(t.typeName) &&
          t.typeName.text === 'const';
        if (!isConst) {
          const from = checker.getTypeAtLocation(node.expression);
          const to = checker.getTypeFromTypeNode(t);
          const kind = checker.isTypeAssignableTo(from, to)
            ? 'redundant'
            : checker.isTypeAssignableTo(checker.getNonNullableType(from), to)
              ? 'asserts-present'
              : 're-types';
          add(sf, node, 'cast', kind);
        }
      } else if (ts.isTypeAssertionExpression(node)) {
        add(sf, node, 'cast', 'assertion');
      }
      // Y: the keyword
      if (node.kind === ts.SyntaxKind.AnyKeyword)
        add(sf, node.parent ?? node, 'any', 'keyword');
      // Y: any-flow, reported at the outermost expression typed `any`
      if (
        (ts.isCallExpression(node) ||
          ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)) &&
        checker.getTypeAtLocation(node).flags & ts.TypeFlags.Any
      ) {
        const parent = node.parent;
        const parentAny =
          (ts.isCallExpression(parent) ||
            ts.isPropertyAccessExpression(parent) ||
            ts.isElementAccessExpression(parent)) &&
          checker.getTypeAtLocation(parent).flags & ts.TypeFlags.Any &&
          (ts.isCallExpression(parent) ? parent.expression === node : true);
        const intoUnknownBinding =
          ts.isVariableDeclaration(parent) &&
          parent.initializer === node &&
          isUnknownAnnotation(parent.type);
        let intoUnknownParam = false;
        if (
          (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
          parent.arguments
        ) {
          const i = parent.arguments.indexOf(node);
          const declaration =
            i >= 0
              ? checker.getResolvedSignature(parent)?.declaration
              : undefined;
          const p =
            declaration && 'parameters' in declaration
              ? declaration.parameters?.[i]
              : undefined;
          intoUnknownParam = Boolean(p && isUnknownAnnotation(p.type));
        }
        const isCallee =
          ts.isCallExpression(parent) && parent.expression === node;
        if (
          !parentAny &&
          !intoUnknownBinding &&
          !intoUnknownParam &&
          !isCallee
        ) {
          add(sf, node, 'any', 'flow');
        }
      }
      // N: a narrowing construct applied to a widened `unknown` binding
      let narrowed;
      if (ts.isTypeOfExpression(node))
        narrowed = narrowedBinding(node.expression);
      else if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword ||
          node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          node.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsEqualsToken)
      ) {
        narrowed = narrowedBinding(node.left) ?? narrowedBinding(node.right);
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword
      ) {
        narrowed = narrowedBinding(node.right);
      } else if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'isArray' &&
        node.arguments[0]
      ) {
        narrowed = narrowedBinding(node.arguments[0]);
      } else if (ts.isCallExpression(node)) {
        // A call to a boundary reader narrows what it is handed.
        const declaration = checker.getResolvedSignature(node)?.declaration;
        const target = declaration?.getSourceFile?.();
        if (target && inList(path.resolve(target.fileName), boundaryModules)) {
          for (const arg of node.arguments) {
            narrowed = narrowed ?? narrowedBinding(arg);
          }
        }
      }
      if (narrowed && !reportedN.has(narrowed)) {
        reportedN.add(narrowed);
        add(
          unknownBindings.get(narrowed).sf,
          narrowed,
          'hand-narrowed',
          'widened',
        );
      }
      // R
      if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
        add(sf, node, 'regex', 'literal');
        regexSources.add(node);
      }
      // A value reference to `RegExp`; naming the type is not running one.
      if (
        ts.isIdentifier(node) &&
        node.text === 'RegExp' &&
        !ts.isTypeReferenceNode(node.parent) &&
        !ts.isExpressionWithTypeArguments(node.parent)
      ) {
        const symbol = checker.getSymbolAtLocation(node);
        if (symbol && fromLib(symbol)) {
          add(
            sf,
            node.parent &&
              (ts.isNewExpression(node.parent) ||
                ts.isCallExpression(node.parent))
              ? node.parent
              : node,
            'regex',
            'RegExp',
          );
          if (node.parent) regexSources.add(node.parent);
        }
      }
      if (
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)
      ) {
        const nameNode = ts.isPropertyAccessExpression(node)
          ? node.name
          : node.argumentExpression;
        const symbol = checker.getSymbolAtLocation(nameNode);
        const name = symbol?.getName();
        const parentSymbol = symbol?.parent;
        if (
          name &&
          STRING_REGEX_METHODS.has(name) &&
          fromLib(symbol) &&
          parentSymbol?.getName() === 'String'
        ) {
          add(sf, node, 'regex', `String.${name}`);
        }
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'Symbol' &&
          REGEX_SYMBOLS.has(node.name.text)
        ) {
          add(sf, node, 'regex', `Symbol.${node.name.text}`);
        }
      }
      const callsRegExp =
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'RegExp';
      if (
        (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) &&
        !callsRegExp &&
        !regexSources.has(node) &&
        isRegExpType(checker.getTypeAtLocation(node))
      ) {
        add(sf, node, 'regex', 'value');
      }
      // P
      if (ts.isTypePredicateNode(node)) {
        const fn = node.parent;
        const param = fn.parameters?.find(
          (p) =>
            ts.isIdentifier(p.name) &&
            ts.isIdentifier(node.parameterName) &&
            p.name.text === node.parameterName.text,
        );
        const allowed = reader && param && isUnknownAnnotation(param.type);
        if (!allowed)
          add(sf, node, 'predicate', node.assertsModifier ? 'asserts' : 'is');
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
}

/** A multiset of findings by `{ file, rule, kind, text }`, as baseline entries. */
function baselineOf(findings) {
  const counts = new Map();
  for (const f of findings) {
    const key = JSON.stringify([f.file, f.rule, f.kind, f.text]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [file, rule, kind, text] = JSON.parse(key);
      return { file, rule, kind, text, count };
    })
    .sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.rule.localeCompare(b.rule) ||
        a.text.localeCompare(b.text),
    );
}

/** What differs between findings and a baseline: new keys or counts, and stale ones. */
function compareWithBaseline(findings, baseline) {
  const now = new Map(
    baselineOf(findings).map((e) => [
      JSON.stringify([e.file, e.rule, e.kind, e.text]),
      e.count,
    ]),
  );
  const was = new Map(
    baseline.map((e) => [
      JSON.stringify([e.file, e.rule, e.kind, e.text]),
      e.count,
    ]),
  );
  const added = [];
  const stale = [];
  for (const [key, count] of now) {
    const before = was.get(key) ?? 0;
    if (count > before) added.push({ entry: JSON.parse(key), count, before });
  }
  for (const [key, count] of was) {
    const after = now.get(key) ?? 0;
    if (after < count) stale.push({ entry: JSON.parse(key), count, after });
  }
  return { added, stale };
}

module.exports = {
  findForbidden,
  baselineOf,
  compareWithBaseline,
  BOUNDARY_MODULES,
  READER_MODULES,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const configs = args.filter(
    (a) => a !== '--inventory' && a !== '--json' && a !== '--baseline',
  );
  const targets = configs.length
    ? configs
    : ['adt-strategies', 'adt-clients', 'adt-clients-legacy'].map((p) =>
        path.join(ROOT, 'packages', p, 'tsconfig.json'),
      );
  for (const target of targets) {
    const findings = findForbidden(target);
    if (args.includes('--baseline')) {
      console.log(JSON.stringify(baselineOf(findings), null, 2));
      continue;
    }
    if (args.includes('--json')) {
      console.log(JSON.stringify(findings, null, 2));
      continue;
    }
    const counts = new Map();
    for (const f of findings) {
      const key = `${f.rule}/${f.kind}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    console.log(`${relative(target)}: ${findings.length} finding(s)`);
    for (const [key, n] of [...counts.entries()].sort())
      console.log(`  ${key}: ${n}`);
  }
}
