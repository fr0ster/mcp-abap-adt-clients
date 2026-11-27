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
//      whose type is neither `unknown` nor `any` (a widening; judged by that
//      value's binding's declared type, or its initializer's), and narrowed by
//      hand with `typeof`, `instanceof`, `in`, `Array.isArray` or equality with
//      a literal. Handing it to a boundary reader is not narrowing. A boundary
//      reader's own parameters are exempt;
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
  // adt-clients' readers of parsed XML from SAP's answers. They only read; a
  // module that also sends a request (`utils/activationUtils.ts`, the inactive
  // objects) is not one, and its reading lives in a module of its own.
  'packages/adt-clients/src/core/messageClass/xml.ts',
  'packages/adt-clients/src/core/tableSettings/readDocument.ts',
  'packages/adt-clients/src/utils/activationReading.ts',
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

  // N: the `unknown` bindings — parameters and variables declared or inferred
  // `unknown`, properties this package declares `unknown`, and functions whose
  // answer is `unknown` — and the widenings that reach them, followed through
  // arguments, initializers, assignments, returns and object-literal
  // properties, and on through one `unknown` binding to the next.
  const unknownBindings = new Map(); // node -> { sf, widened: boolean }
  const isUnknownAnnotation = (typeNode) =>
    Boolean(typeNode && typeNode.kind === ts.SyntaxKind.UnknownKeyword);
  const isUnknownType = (type) => Boolean(type.flags & ts.TypeFlags.Unknown);
  const ownFiles = new Set(files);
  const resolved = (symbol) =>
    symbol && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  const declarationOf = (expr) =>
    resolved(checker.getSymbolAtLocation(expr))?.valueDeclaration;
  const unparen = (e) => {
    let x = e;
    while (x && ts.isParenthesizedExpression(x)) x = x.expression;
    return x;
  };
  // A binding's own declared type decides, not the type control flow narrowed
  // it to: an `unknown` parameter checked with `typeof` and handed on is still
  // the value from outside it was.
  const typed = (value) => {
    const expr = unparen(value);
    if (ts.isIdentifier(expr)) {
      const declaration = declarationOf(expr);
      if (
        declaration &&
        (ts.isParameter(declaration) ||
          ts.isVariableDeclaration(declaration)) &&
        declaration.type
      ) {
        return !isLoose(checker.getTypeFromTypeNode(declaration.type));
      }
      // An unannotated `const` has its initializer's type.
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        !declaration.type &&
        declaration.initializer
      ) {
        return !isLoose(checker.getTypeAtLocation(declaration.initializer));
      }
    }
    return !isLoose(checker.getTypeAtLocation(expr));
  };
  const isFunctionLike = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node);
  for (const sf of files) {
    const boundary = inList(sf.fileName, boundaryModules);
    const collect = (node) => {
      if (ts.isParameter(node) && !(boundary && node.type)) {
        if (isUnknownAnnotation(node.type))
          unknownBindings.set(node, { sf, widened: false });
      } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const inferred =
          !node.type &&
          node.initializer &&
          isUnknownType(checker.getTypeAtLocation(node.name));
        if (isUnknownAnnotation(node.type) || inferred)
          unknownBindings.set(node, { sf, widened: false });
      } else if (
        (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) &&
        isUnknownAnnotation(node.type)
      ) {
        unknownBindings.set(node, { sf, widened: false });
      } else if (
        isFunctionLike(node) &&
        isUnknownAnnotation(node.type) &&
        // A boundary reader's answer is from outside by definition.
        !boundary
      ) {
        unknownBindings.set(node, { sf, widened: false });
      }
      ts.forEachChild(node, collect);
    };
    collect(sf);
  }
  // A value that carries a widening: a widened binding, property or answer.
  const widenedValue = (value) => {
    const expr = unparen(value);
    if (!expr) return false;
    if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
      const d = declarationOf(ts.isIdentifier(expr) ? expr : expr.name);
      return Boolean(d && unknownBindings.get(d)?.widened);
    }
    if (ts.isCallExpression(expr)) {
      const d = checker.getResolvedSignature(expr)?.declaration;
      return Boolean(d && unknownBindings.get(d)?.widened);
    }
    return false;
  };
  const edges = []; // [binding node, value]
  const edge = (declaration, value) => {
    if (declaration && value && unknownBindings.has(declaration))
      edges.push([declaration, value]);
  };
  const enclosingFunction = (node) => {
    let n = node.parent;
    while (n && !isFunctionLike(n)) n = n.parent;
    return n;
  };
  for (const sf of files) {
    const flows = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer)
        edge(node, node.initializer);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const left = unparen(node.left);
        if (ts.isIdentifier(left)) edge(declarationOf(left), node.right);
        if (ts.isPropertyAccessExpression(left))
          edge(declarationOf(left.name), node.right);
      }
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        node.arguments
      ) {
        const declaration = checker.getResolvedSignature(node)?.declaration;
        if (
          declaration &&
          'parameters' in declaration &&
          declaration.parameters
        ) {
          declaration.parameters.forEach((p, i) => {
            edge(p, node.arguments[i]);
          });
        }
      }
      if (ts.isReturnStatement(node) && node.expression)
        edge(enclosingFunction(node), node.expression);
      if (ts.isArrowFunction(node) && !ts.isBlock(node.body))
        edge(node, node.body);
      if (ts.isObjectLiteralExpression(node)) {
        const contextual = checker.getContextualType(node);
        if (contextual) {
          for (const property of node.properties) {
            if (
              !(
                ts.isPropertyAssignment(property) ||
                ts.isShorthandPropertyAssignment(property)
              )
            )
              continue;
            const name = property.name.getText(sf);
            const target = checker.getPropertyOfType(
              contextual,
              name,
            )?.valueDeclaration;
            if (target && ownFiles.has(target.getSourceFile()))
              edge(
                target,
                ts.isPropertyAssignment(property)
                  ? property.initializer
                  : property.name,
              );
          }
        }
      }
      ts.forEachChild(node, flows);
    };
    flows(sf);
  }
  const isAbsence = (value) => {
    const e = unparen(value);
    return Boolean(
      e &&
        (e.kind === ts.SyntaxKind.NullKeyword ||
          (ts.isIdentifier(e) && e.text === 'undefined') ||
          ts.isVoidExpression(e)),
    );
  };
  // To a fixed point: a widening carries on through every binding it reaches.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [declaration, value] of edges) {
      const entry = unknownBindings.get(declaration);
      // `undefined` and `null` say there is nothing: they carry no contract
      // value, so returning or passing one widens nothing.
      if (
        !entry.widened &&
        !isAbsence(value) &&
        (typed(value) || widenedValue(value))
      ) {
        entry.widened = true;
        entry.by = value;
        changed = true;
      }
    }
  }
  const narrowedBinding = (value) => {
    const expr = unparen(value);
    if (!expr) return undefined;
    let d;
    if (ts.isIdentifier(expr)) d = declarationOf(expr);
    else if (ts.isPropertyAccessExpression(expr)) d = declarationOf(expr.name);
    const entry = d && unknownBindings.get(d);
    // A function's answer is not a binding a narrowing reads.
    return entry?.widened && !isFunctionLike(d) ? d : undefined;
  };
  /** A literal an equality narrows by: a string, number or bigint, `true`, `false`, `null`, `undefined`. */
  const isLiteral = (value) => {
    const e = unparen(value);
    if (!e) return false;
    if (
      ts.isStringLiteral(e) ||
      ts.isNumericLiteral(e) ||
      ts.isBigIntLiteral(e) ||
      ts.isNoSubstitutionTemplateLiteral(e)
    )
      return true;
    if (
      e.kind === ts.SyntaxKind.TrueKeyword ||
      e.kind === ts.SyntaxKind.FalseKeyword ||
      e.kind === ts.SyntaxKind.NullKeyword
    )
      return true;
    if (ts.isIdentifier(e) && e.text === 'undefined') return true;
    return (
      ts.isPrefixUnaryExpression(e) &&
      e.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(e.operand)
    );
  };
  const isArrayIsArray = (callee) => {
    if (!ts.isPropertyAccessExpression(callee)) return false;
    const symbol = checker.getSymbolAtLocation(callee.name);
    return Boolean(
      symbol &&
        symbol.getName() === 'isArray' &&
        fromLib(symbol) &&
        symbol.parent?.getName() === 'ArrayConstructor',
    );
  };
  const reportedN = new Set();
  /** Whether `node` is in a type position. */
  const inType = (node) => {
    for (let n = node.parent; n; n = n.parent) {
      if (
        ts.isTypeNode(n) ||
        ts.isHeritageClause(n) ||
        ts.isExpressionWithTypeArguments(n)
      )
        return true;
      if (ts.isStatement(n) || ts.isSourceFile(n)) return false;
    }
    return false;
  };
  /** An expression that is a value, not a name it declares or a member name it reads. */
  const isValueExpression = (node) => {
    if (!ts.isExpression(node) || ts.isParenthesizedExpression(node))
      return false;
    if (inType(node)) return false;
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node)
      return false;
    if (
      'name' in parent &&
      parent.name === node &&
      !ts.isShorthandPropertyAssignment(parent)
    )
      return false;
    if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent))
      return false;
    // A module specifier names a module; it is no value.
    if (
      ts.isImportDeclaration(parent) ||
      ts.isExportDeclaration(parent) ||
      ts.isExternalModuleReference(parent) ||
      (ts.isCallExpression(parent) &&
        parent.expression.kind === ts.SyntaxKind.ImportKeyword)
    )
      return false;
    // The property a destructuring pattern reads names a member, not a value.
    if (ts.isBindingElement(parent) && parent.propertyName === node)
      return false;
    if (ts.isQualifiedName(parent)) return false;
    return true;
  };
  /** The node a value lands on, past any parentheses around it. */
  const landing = (node) => {
    let n = node;
    while (n.parent && ts.isParenthesizedExpression(n.parent)) n = n.parent;
    return n;
  };
  // RegExp, and the types that derive from it or hold it.
  const isRegExpType = (type, seen = new Set()) => {
    if (
      !type ||
      seen.has(type) ||
      type.flags &
        (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)
    )
      return false;
    seen.add(type);
    if (type.isUnionOrIntersection())
      return type.types.some((t) => isRegExpType(t, seen));
    const symbol = type.getSymbol() ?? type.aliasSymbol;
    if (symbol && symbol.getName() === 'RegExp' && fromLib(symbol)) return true;
    if (type.isTypeParameter())
      return isRegExpType(checker.getBaseConstraintOfType(type), seen);
    if (
      symbol &&
      symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)
    ) {
      const declared = checker.getDeclaredTypeOfSymbol(symbol);
      if (declared.isClassOrInterface())
        return (checker.getBaseTypes(declared) ?? []).some((b) =>
          isRegExpType(b, seen),
        );
    }
    return false;
  };
  const isRegExpConstructorType = (type) => {
    if (!type || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
      return false;
    if (type.isUnionOrIntersection())
      return type.types.some(isRegExpConstructorType);
    const symbol = type.getSymbol() ?? type.aliasSymbol;
    return Boolean(
      symbol && symbol.getName() === 'RegExpConstructor' && fromLib(symbol),
    );
  };

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
      // Y: any-flow — every expression typed `any`, except one bound at once
      // to `unknown`: the initializer of a declaration annotated `unknown`, or
      // an argument to a parameter declared `unknown`. Operating on it first
      // (a property read, a call) is a use, so the inner one counts too.
      if (
        isValueExpression(node) &&
        checker.getTypeAtLocation(node).flags & ts.TypeFlags.Any
      ) {
        const at = landing(node);
        const parent = at.parent;
        const intoUnknownBinding =
          ts.isVariableDeclaration(parent) &&
          parent.initializer === at &&
          isUnknownAnnotation(parent.type);
        let intoUnknownParam = false;
        if (
          (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
          parent.arguments
        ) {
          const i = parent.arguments.indexOf(at);
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
        // A value no one reads (a discarded `yield`, a statement) is no use.
        const discarded = ts.isExpressionStatement(parent);
        if (!intoUnknownBinding && !intoUnknownParam && !discarded)
          add(sf, node, 'any', 'flow');
      }
      // N: a narrowing construct applied to a widened `unknown` binding
      let narrowed;
      if (ts.isTypeOfExpression(node))
        narrowed = narrowedBinding(node.expression);
      else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
      ) {
        narrowed = narrowedBinding(node.left);
      } else if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          node.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
          node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
      ) {
        // Equality narrows only against a literal.
        narrowed =
          (isLiteral(node.right) ? narrowedBinding(node.left) : undefined) ??
          (isLiteral(node.left) ? narrowedBinding(node.right) : undefined);
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword
      ) {
        narrowed = narrowedBinding(node.right);
      } else if (
        ts.isCallExpression(node) &&
        isArrayIsArray(node.expression) &&
        node.arguments[0]
      ) {
        narrowed = narrowedBinding(node.arguments[0]);
      }
      if (narrowed && !reportedN.has(narrowed)) {
        reportedN.add(narrowed);
        if (process.env.SOURCE_RULES_WHY) {
          const chain = [];
          let at = narrowed;
          for (let hop = 0; hop < 12 && at; hop++) {
            const by = unknownBindings.get(at)?.by;
            if (!by) break;
            const bsf = by.getSourceFile();
            chain.push(
              `${relative(path.resolve(bsf.fileName))}:${bsf.getLineAndCharacterOfPosition(by.getStart(bsf)).line + 1} ${collapse(by.getText(bsf)).slice(0, 50)}`,
            );
            const e = unparen(by);
            at = ts.isCallExpression(e)
              ? checker.getResolvedSignature(e)?.declaration
              : declarationOf(ts.isPropertyAccessExpression(e) ? e.name : e);
          }
          console.error(
            `N ${collapse(narrowed.getText()).slice(0, 40)} <- ${chain.join(' <- ')}`,
          );
        }
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
      // Members of the RegExp interface, and of its constructor.
      if (
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)
      ) {
        const symbol = checker.getSymbolAtLocation(
          ts.isPropertyAccessExpression(node)
            ? node.name
            : node.argumentExpression,
        );
        const owner = symbol?.parent?.getName();
        if (
          symbol &&
          fromLib(symbol) &&
          (owner === 'RegExp' || owner === 'RegExpConstructor')
        )
          add(sf, node, 'regex', 'member');
      }
      // Any value of a RegExp type — derived, a union holding it, through an
      // identifier, a call or an element access — and any value of its
      // constructor's type that is not the `RegExp` reference counted above.
      if (
        isValueExpression(node) &&
        node.kind !== ts.SyntaxKind.RegularExpressionLiteral &&
        !regexSources.has(node) &&
        // `new RegExp(…)` / `RegExp(…)`: counted as the `RegExp` reference.
        !(
          (ts.isNewExpression(node) || ts.isCallExpression(node)) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'RegExp' &&
          fromLib(checker.getSymbolAtLocation(node.expression))
        ) &&
        !(
          ts.isIdentifier(node) &&
          node.text === 'RegExp' &&
          fromLib(checker.getSymbolAtLocation(node))
        )
      ) {
        const type = checker.getTypeAtLocation(node);
        if (isRegExpType(type)) add(sf, node, 'regex', 'value');
        else if (isRegExpConstructorType(type))
          add(sf, node, 'regex', 'constructor');
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
        // Outside data: the parameter is declared `unknown` and no widening
        // reaches it (N's provenance); a boundary reader's parameters are
        // from outside by definition.
        const allowed =
          reader &&
          param &&
          isUnknownAnnotation(param.type) &&
          !unknownBindings.get(param)?.widened;
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
