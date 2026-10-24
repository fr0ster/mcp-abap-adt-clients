/**
 * Every call an integration suite or a test helper makes to an adt-clients
 * member is judged: it passes an `analyse` strategy, and the effective one
 * is `analyseException` or `judged(<specific judge>)`.
 *
 * A member answers what came off the wire, so an `exc:exception` inside an
 * HTTP 200 — an authorization refusal, say — is `ok: true` unless the call
 * asked for a reading. A specific judge of adt-strategies
 * (`analyseActivation`, `analyseDeletion`, `analyseValidation`, …) reads only
 * its own document form and answers an exception document as "no failure",
 * so it is passed composed: `judged(analyseX)` (helpers/judged.ts) reads the
 * exception first. Judges that read exception documents themselves
 * (`analyseDebuggeeEnd`, …) count as judged.
 *
 * Everything is resolved with the compiler's type checker, never by text:
 *
 * - **which member a call is** — through the call's resolved signature, so a
 *   computed member (`h['readMetadata'](…)`), a bound one
 *   (`const read = h.readMetadata.bind(h); read(…)`) and a destructured one
 *   (`const { readMetadata } = h; readMetadata(…)`) are all that member. A
 *   member invoked through `call` / `apply`, and a call on an `any`-typed
 *   receiver, are refused outright; so is a local declaration that narrows a
 *   member and drops its `analyse` option;
 * - **which judge is passed** — through symbols, so an imported alias
 *   (`analyseDeletion as del`), a shorthand `{ analyse }`, options held in a
 *   `const`, and spreads are followed to the judge they carry. Properties are
 *   evaluated in order, so a later spread overrides an earlier `analyse`; a
 *   spread whose `analyse` cannot be resolved statically — an options
 *   parameter typed with an optional `analyse`, which may be `undefined` — is
 *   refused.
 *
 * The guard fails closed: a form it cannot resolve is refused, not accepted.
 * test-helper.js has no types, so its calls are found by member name on a
 * client handler, and its judge must be written as `analyseException` or
 * `judged(analyseX)`, nothing else.
 *
 * A call deliberately judged otherwise goes into ALLOWED, with its reason.
 * An entry that no longer matches a call fails too, so the list cannot rot.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';

const ROOT = join(__dirname, '../../..');
const SCOPES = ['src/__tests__/integration', 'src/__tests__/helpers'];

/** `<file>:<member>:<first 60 characters of the call>` → why it is allowed. */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    'src/__tests__/integration/shared/responseContract.test.ts:activate:client.getClass().activate( { className: NEVER_EXISTS }, { h [analyse: refusalIsAFailure]',
    'The test exists to show a consumer judging the answer with its own strategy (refusalIsAFailure); the call before it uses analyseException.',
  ],
  [
    'src/__tests__/integration/shared/checkRun.test.ts:check:client .getClass() .check({ className, source: BROKEN_SOURCE [analyse: everythingIsAFailure]',
    "The test proves the caller's strategy is consulted: everythingIsAFailure refuses every answer, and the test asserts that refusal.",
  ],
  [
    'src/__tests__/helpers/sessionConfig.ts:getSystemInformation:getSystemInformation(connection)',
    "Its own reading decides: a 404 is the endpoint absent on premise ({ present: false }), a 2xx that is no JSON object a failure. analyseException would turn the 404's exception body into a failure on every on-premise system.",
  ],
  [
    'src/__tests__/integration/core/transport/Transport.test.ts:getSystemInformation:getSystemInformation(connection)',
    "As in sessionConfig: getSystemInformation's own reading of the 404 (absent on premise) and of a non-JSON 2xx (a failure) is the judge.",
  ],
]);

/** Judges that read exception documents themselves: they count as judged. */
const SELF_JUDGING = new Set([
  'analyseException',
  'analyseDebuggeeEnd',
  'analyseDebuggerFreed',
  'analysePublicationLock',
  'analyseUnitTestStart',
  'analyseUnsupportedStatus',
]);

type Verdict =
  | { kind: 'judged' }
  | { kind: 'absent' }
  | { kind: 'refused'; why: string };

const JUDGED: Verdict = { kind: 'judged' };
const ABSENT: Verdict = { kind: 'absent' };
const refused = (why: string): Verdict => ({ kind: 'refused', why });

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full, ext);
    return ext.test(name) ? [full] : [];
  });
}

function isContractDeclaration(declaration: ts.Declaration): boolean {
  const file = declaration.getSourceFile().fileName;
  return (
    (file.includes('/src/') && !file.includes('/src/__tests__/')) ||
    file.includes('node_modules/@mcp-abap-adt/')
  );
}

function isStrategyFile(file: string): boolean {
  return (
    file.includes('/adt-strategies/') ||
    file.includes('node_modules/@mcp-abap-adt/adt-strategies')
  );
}

/** The parameters of a method-like declaration, or `undefined`. */
function parametersOf(
  declaration: ts.Declaration,
): ts.NodeArray<ts.ParameterDeclaration> | undefined {
  if (
    ts.isMethodSignature(declaration) ||
    ts.isMethodDeclaration(declaration) ||
    ts.isFunctionDeclaration(declaration) ||
    ts.isArrowFunction(declaration) ||
    ts.isFunctionExpression(declaration)
  )
    return declaration.parameters;
  if (
    (ts.isPropertySignature(declaration) ||
      ts.isPropertyDeclaration(declaration)) &&
    declaration.type &&
    ts.isFunctionTypeNode(declaration.type)
  )
    return declaration.type.parameters;
  return undefined;
}

/** The index of a declaration's parameter that takes `analyse`, or -1. */
function analyseIndexOf(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): number {
  for (const [index, parameter] of (
    parametersOf(declaration) ?? []
  ).entries()) {
    const type = checker.getNonNullableType(
      checker.getTypeAtLocation(parameter),
    );
    const members = type.isUnion() ? type.types : [type];
    if (members.some((member) => member.getProperty('analyse'))) return index;
  }
  return -1;
}

/** The analyse-taking parameter of a member, across all its overloads. */
function memberOptionsIndex(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): number {
  const named = declaration as ts.Declaration & { name?: ts.Node };
  const symbol = named.name
    ? checker.getSymbolAtLocation(named.name)
    : undefined;
  for (const candidate of symbol?.declarations ?? [declaration]) {
    if (!isContractDeclaration(candidate)) continue;
    const index = analyseIndexOf(candidate, checker);
    if (index >= 0) return index;
  }
  return -1;
}

function nameOf(declaration: ts.Declaration): string | undefined {
  const named = declaration as ts.Declaration & { name?: ts.Node };
  return named.name && ts.isIdentifier(named.name)
    ? named.name.text
    : undefined;
}

/** Every method name the contracts declare with an `analyse` parameter. */
function contractMemberNames(
  program: ts.Program,
  checker: ts.TypeChecker,
): Set<string> {
  const names = new Set<string>();
  for (const source of program.getSourceFiles()) {
    const file = source.fileName;
    const contract =
      file.includes('node_modules/@mcp-abap-adt/interfaces-adt/') ||
      (file.includes('/src/') &&
        !file.includes('/src/__tests__/') &&
        !file.includes('node_modules'));
    if (!contract) continue;
    const visit = (node: ts.Node): void => {
      if (
        (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) &&
        ts.isIdentifier(node.name) &&
        !names.has(node.name.text) &&
        analyseIndexOf(node, checker) >= 0
      ) {
        names.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return names;
}

/**
 * A local declaration that stands in for an adt-clients member: declared in
 * the suites or helpers, taking arguments, answering a contract or anything.
 * A thunk (`list: () => client.getX().getVersions(…)`) narrows nothing.
 */
function isLocalNarrowing(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): boolean {
  if (isContractDeclaration(declaration)) return false;
  // A function with a body is a wrapper, not a narrowing: the member calls
  // inside it are checked where they are made. A narrowing is a declaration
  // without one — a method or property of a local interface or type.
  if (
    !ts.isMethodSignature(declaration) &&
    !ts.isPropertySignature(declaration) &&
    !ts.isFunctionTypeNode(declaration) &&
    !ts.isCallSignatureDeclaration(declaration)
  ) {
    return false;
  }
  const signatures =
    ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration)
      ? [checker.getSignatureFromDeclaration(declaration)]
      : checker.getTypeAtLocation(declaration).getCallSignatures();
  return signatures.some((signature) => {
    if (!signature || signature.getParameters().length === 0) return false;
    const answered = checker.typeToString(signature.getReturnType());
    return /IAdtResponse|^Promise<any>$|^any$/.test(answered);
  });
}

function strip(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function resolved(symbol: ts.Symbol | undefined, checker: ts.TypeChecker) {
  return symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

/** The `const` initializer a symbol stands for, or `undefined`. */
function constInitializer(
  symbol: ts.Symbol | undefined,
): ts.Expression | undefined {
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (
    declaration &&
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
    ts.isIdentifier(declaration.name)
  ) {
    return declaration.initializer;
  }
  return undefined;
}

/** What a judge expression is: judged, an uncomposed judge, or unknown. */
function judgeVerdict(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  depth = 0,
): Verdict {
  if (depth > 8) return refused('a judge the guard cannot resolve');
  const node = strip(expression);
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    (ts.isIdentifier(node) && node.text === 'undefined') ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return refused('analyse may be undefined');
  }
  if (ts.isConditionalExpression(node)) {
    const sides = [
      judgeVerdict(node.whenTrue, checker, depth + 1),
      judgeVerdict(node.whenFalse, checker, depth + 1),
    ];
    return sides.find((side) => side.kind !== 'judged') ?? JUDGED;
  }
  if (ts.isCallExpression(node)) {
    const callee = resolved(
      checker.getSymbolAtLocation(strip(node.expression)),
      checker,
    );
    const declaration = callee?.valueDeclaration ?? callee?.declarations?.[0];
    const file = declaration?.getSourceFile().fileName ?? '';
    if (callee?.name === 'judged' && file.endsWith('/helpers/judged.ts')) {
      return node.arguments.length > 0
        ? JUDGED
        : refused('judged() of nothing');
    }
    if (callee && isStrategyFile(file)) {
      return refused(
        `${callee.name}(…) alone reads no exception document — pass judged(${callee.name}(…))`,
      );
    }
    return refused('a judge the guard cannot resolve');
  }
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
    const symbol = resolved(checker.getSymbolAtLocation(node), checker);
    const initializer = constInitializer(symbol);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    const file = declaration?.getSourceFile().fileName ?? '';
    if (symbol && isStrategyFile(file)) {
      return SELF_JUDGING.has(symbol.name)
        ? JUDGED
        : refused(
            `${symbol.name} alone reads no exception document — pass judged(${symbol.name})`,
          );
    }
    if (symbol && file.endsWith('/helpers/sharedActivation.ts')) {
      return refused(
        `${symbol.name} alone reads no exception document — pass judged(${symbol.name})`,
      );
    }
    if (initializer) return judgeVerdict(initializer, checker, depth + 1);
    return refused('a judge the guard cannot resolve');
  }
  return refused('a judge the guard cannot resolve');
}

/** `{ analyse }`: the judge is the variable the shorthand names. */
function shorthandVerdict(
  property: ts.ShorthandPropertyAssignment,
  checker: ts.TypeChecker,
  depth: number,
): Verdict {
  const symbol = resolved(
    checker.getShorthandAssignmentValueSymbol(property),
    checker,
  );
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  const file = declaration?.getSourceFile().fileName ?? '';
  if (symbol && isStrategyFile(file)) {
    return SELF_JUDGING.has(symbol.name)
      ? JUDGED
      : refused(
          `${symbol.name} alone reads no exception document — pass judged(${symbol.name})`,
        );
  }
  const initializer = constInitializer(symbol);
  return initializer
    ? judgeVerdict(initializer, checker, depth)
    : refused('a judge the guard cannot resolve');
}

const ASSIGNMENTS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/**
 * Why an options object held in a `const` cannot be read from its
 * initializer, or `undefined` when nothing in its file can change it.
 *
 * Every use of the binding in its file is classified, and only two pass:
 * reading one of its properties (`opts.headers`), and being the options
 * argument of an adt-clients member call or a spread copied into an object
 * literal. Anything else — a property assignment or compound assignment,
 * `delete`, `++`/`--`, a method called on it, being passed to any other call
 * (`Object.assign`, `Object.defineProperty`, `Reflect.set`, a helper),
 * returned, stored in another binding, an object or an array — is a way it
 * could change or escape, and is refused. So is any use not recognised.
 */
function changeOf(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): string | undefined {
  const declaration = symbol.valueDeclaration;
  if (!declaration) return 'options whose declaration cannot be found';
  // Exported, it can be changed from a file this search does not read.
  const statement = declaration.parent?.parent;
  if (
    statement &&
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  ) {
    return `options ${symbol.name} is exported, so another file may change it`;
  }
  const source = declaration.getSourceFile();
  let change: string | undefined;
  const visit = (node: ts.Node): void => {
    if (change) return;
    if (
      ts.isIdentifier(node) &&
      node.text === symbol.name &&
      node !== (declaration as ts.VariableDeclaration).name &&
      resolved(checker.getSymbolAtLocation(node), checker) === symbol
    ) {
      change = useChange(node, checker);
      if (change) change = `options ${symbol.name} ${change}`;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return change;
}

/** What one use of an options binding could do to it, or `undefined`. */
function useChange(
  reference: ts.Identifier,
  checker: ts.TypeChecker,
): string | undefined {
  let use: ts.Node = reference;
  while (
    ts.isParenthesizedExpression(use.parent) ||
    ts.isAsExpression(use.parent) ||
    ts.isNonNullExpression(use.parent) ||
    ts.isSatisfiesExpression(use.parent) ||
    ts.isTypeAssertionExpression(use.parent)
  ) {
    use = use.parent;
  }
  const parent = use.parent;
  // `opts.x` / `opts['x']`: a read, unless it is written, deleted or called.
  if (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isElementAccessExpression(parent)) &&
    parent.expression === use
  ) {
    const outer = parent.parent;
    if (
      ts.isBinaryExpression(outer) &&
      outer.left === parent &&
      ASSIGNMENTS.has(outer.operatorToken.kind)
    ) {
      return 'has a property assigned';
    }
    if (ts.isDeleteExpression(outer)) return 'has a property deleted';
    if (
      (ts.isPrefixUnaryExpression(outer) ||
        ts.isPostfixUnaryExpression(outer)) &&
      (outer.operator === ts.SyntaxKind.PlusPlusToken ||
        outer.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      return 'has a property incremented';
    }
    if (ts.isCallExpression(outer) && outer.expression === parent) {
      return 'has a method called on it';
    }
    if (
      (ts.isPropertyAccessExpression(outer) ||
        ts.isElementAccessExpression(outer)) &&
      outer.expression === parent
    ) {
      return 'is reached into below its first level';
    }
    return undefined;
  }
  // `{ ...opts }`: copied, not changed.
  if (ts.isSpreadAssignment(parent)) return undefined;
  // The options argument of an adt-clients member call.
  if (
    ts.isCallExpression(parent) &&
    parent.arguments.includes(use as ts.Expression)
  ) {
    const declaration = checker.getResolvedSignature(parent)?.declaration;
    if (
      declaration &&
      !ts.isJSDocSignature(declaration) &&
      isContractDeclaration(declaration)
    ) {
      const index = memberOptionsIndex(declaration, checker);
      if (index >= 0 && parent.arguments[index] === use) return undefined;
    }
    return 'escapes to a call that may change it';
  }
  if (ts.isReturnStatement(parent) || ts.isArrowFunction(parent)) {
    return 'is returned';
  }
  return 'is used in a way the guard cannot prove leaves it unchanged';
}

/** Whether a type may carry an `analyse` property. */
function mayCarryAnalyse(type: ts.Type, checker: ts.TypeChecker): boolean {
  const target = checker.getNonNullableType(type);
  const members = target.isUnion() ? target.types : [target];
  return (
    (target.flags & ts.TypeFlags.Any) !== 0 ||
    members.some((member) => member.getProperty('analyse') !== undefined)
  );
}

/** The effective `analyse` of an options expression. */
function optionsVerdict(
  expression: ts.Expression | undefined,
  checker: ts.TypeChecker,
  depth = 0,
): Verdict {
  if (!expression) return ABSENT;
  if (depth > 8) return refused('options the guard cannot resolve');
  const node = strip(expression);
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    (ts.isIdentifier(node) && node.text === 'undefined')
  ) {
    return ABSENT;
  }
  if (ts.isObjectLiteralExpression(node)) {
    let state: Verdict = ABSENT;
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = optionsVerdict(property.expression, checker, depth + 1);
        if (spread.kind !== 'absent') state = spread;
        continue;
      }
      const name = property.name;
      if (!name) continue;
      if (ts.isComputedPropertyName(name)) {
        return refused('a computed key in the options');
      }
      const key =
        ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : '';
      if (key !== 'analyse') continue;
      if (ts.isPropertyAssignment(property)) {
        state = judgeVerdict(property.initializer, checker, depth + 1);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        state = shorthandVerdict(property, checker, depth + 1);
      } else {
        state = refused('analyse declared as a method or accessor');
      }
    }
    return state;
  }
  if (ts.isConditionalExpression(node)) {
    const sides = [
      optionsVerdict(node.whenTrue, checker, depth + 1),
      optionsVerdict(node.whenFalse, checker, depth + 1),
    ];
    return (
      sides.find((side) => side.kind === 'refused') ??
      (sides.every((side) => side.kind === 'judged')
        ? JUDGED
        : sides.every((side) => side.kind === 'absent')
          ? ABSENT
          : refused('analyse present on one branch only'))
    );
  }
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
    const symbol = resolved(checker.getSymbolAtLocation(node), checker);
    const initializer = constInitializer(symbol);
    if (initializer && symbol) {
      // A `const` binds the object, not its properties: it is read from its
      // initializer only when nothing in its file can change or leak it.
      const change = changeOf(symbol, checker);
      if (change) return refused(change);
      return optionsVerdict(initializer, checker, depth + 1);
    }
  }
  return mayCarryAnalyse(checker.getTypeAtLocation(node), checker)
    ? refused('options whose analyse cannot be resolved — it may be undefined')
    : ABSENT;
}

function keyOf(file: string, member: string, call: ts.Node): string {
  return `${relative(ROOT, file)}:${member}:${call
    .getText()
    .replace(/\s+/g, ' ')
    .slice(0, 60)}`;
}

/** The name a call is made by, whatever form its callee takes. */
function calleeName(callee: ts.Expression): string | undefined {
  const node = strip(callee);
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) {
    const argument = node.argumentExpression;
    return ts.isStringLiteralLike(argument) ? argument.text : undefined;
  }
  if (ts.isIdentifier(node)) return node.text;
  return undefined;
}

/**
 * Every member call without a judged `analyse` in `files`. `virtual` adds
 * in-memory files to the program (the guard's own fixtures).
 */
function typedFindings(
  files: readonly string[],
  virtual: ReadonlyMap<string, string> = new Map(),
): string[] {
  const config = ts.readConfigFile(
    join(ROOT, 'tsconfig.json'),
    ts.sys.readFile,
  );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  const options = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (name) => virtual.get(name) ?? readFile(name);
  host.fileExists = (name) => virtual.has(name) || fileExists(name);
  host.getSourceFile = (name, language, ...rest) => {
    const text = virtual.get(name);
    return text !== undefined
      ? ts.createSourceFile(name, text, language, true)
      : getSourceFile(name, language, ...rest);
  };
  const roots = [...files, ...virtual.keys()];
  const program = ts.createProgram(roots, options, host);
  const checker = program.getTypeChecker();
  const members = contractMemberNames(program, checker);
  const findings: string[] = [];
  for (const file of roots) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = strip(node.expression);
        const name = calleeName(callee) ?? '(computed)';
        // The key names the judge the call passes, so an allow-list entry
        // covers that call and not its judged neighbour of the same text.
        const passed = node.arguments
          .flatMap((argument) =>
            ts.isObjectLiteralExpression(argument) ? argument.properties : [],
          )
          .find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              property.name.getText() === 'analyse',
          );
        const key = `${keyOf(file, name, node)}${
          passed ? ` [analyse: ${passed.initializer.getText()}]` : ''
        }`;
        const report = (why: string) => findings.push(`${key} — ${why}`);
        const declaration = checker.getResolvedSignature(node)?.declaration;
        const receiverType =
          ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)
            ? checker.getTypeAtLocation(callee.expression)
            : undefined;

        // `member.call(…)` / `member.apply(…)`: the arguments are shifted and
        // the member is hidden behind Function's own signature.
        if (
          ts.isPropertyAccessExpression(callee) &&
          (callee.name.text === 'call' || callee.name.text === 'apply')
        ) {
          const target = checker
            .getTypeAtLocation(callee.expression)
            .getCallSignatures()
            .some(
              (signature) =>
                signature.declaration !== undefined &&
                isContractDeclaration(signature.declaration) &&
                memberOptionsIndex(signature.declaration, checker) >= 0,
            );
          if (target) report(`invoked through ${callee.name.text}()`);
        } else if (
          ts.isElementAccessExpression(callee) &&
          !ts.isStringLiteralLike(callee.argumentExpression) &&
          (receiverType
            ?.getProperties()
            .some((property) => members.has(property.getName())) ??
            false)
        ) {
          report('a member reached by a computed key the guard cannot resolve');
        } else if (
          receiverType !== undefined &&
          receiverType.flags & ts.TypeFlags.Any &&
          members.has(name)
        ) {
          report('called on an any-typed receiver: type it from the client');
        } else if (
          declaration &&
          !ts.isJSDocSignature(declaration) &&
          isContractDeclaration(declaration)
        ) {
          const index = memberOptionsIndex(declaration, checker);
          if (index >= 0) {
            const verdict = optionsVerdict(node.arguments[index], checker);
            if (verdict.kind === 'absent') report('no analyse');
            if (verdict.kind === 'refused') report(verdict.why);
          }
        } else if (
          declaration &&
          !ts.isJSDocSignature(declaration) &&
          members.has(nameOf(declaration) ?? name) &&
          isLocalNarrowing(declaration, checker)
        ) {
          const index = analyseIndexOf(declaration, checker);
          if (index < 0) {
            report(
              'a local declaration narrows the adt-clients member and drops its analyse option: build the type from the client (Pick<…>, the contract interface)',
            );
          } else {
            const verdict = optionsVerdict(node.arguments[index], checker);
            if (verdict.kind === 'absent') report('no analyse');
            if (verdict.kind === 'refused') report(verdict.why);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

/** Where a member of test-helper.js's handlers takes its options. */
const JS_OPTIONS_INDEX: Record<string, number> = {
  readMetadata: 1,
  read: 2,
  create: 1,
  lock: 1,
  update: 1,
  updateMetadata: 1,
  unlock: 2,
  activate: 1,
  delete: 1,
  validate: 1,
  checkDeletion: 1,
  getInactiveObjects: 0,
};

/**
 * test-helper.js has no types: its judge is read as written, and only two
 * spellings pass — `analyseException` and `judged(analyseX)` — with the
 * file's own require of them unaliased. Anything else is refused.
 */
function jsJudgeProblem(arg: ts.Expression | undefined): string | undefined {
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return 'options the guard cannot read in a file without types';
  }
  let judge: ts.Expression | undefined;
  for (const property of arg.properties) {
    if (ts.isSpreadAssignment(property)) {
      return 'a spread in options the guard cannot read in a file without types';
    }
    if (
      ts.isPropertyAssignment(property) &&
      property.name.getText() === 'analyse'
    ) {
      judge = property.initializer;
    } else if (property.name?.getText() === 'analyse') {
      return 'an analyse the guard cannot read in a file without types';
    }
  }
  if (!judge) return 'no analyse';
  const text = judge.getText().replace(/\s+/g, '');
  return text === 'analyseException' || /^judged\(analyse\w+\)$/.test(text)
    ? undefined
    : `${text} is neither analyseException nor judged(analyseX)`;
}

function jsFindings(
  sources: ReadonlyMap<string, string> = new Map(
    SCOPES.flatMap((scope) => filesUnder(join(ROOT, scope), /\.js$/)).map(
      (file) => [file, readFileSync(file, 'utf8')],
    ),
  ),
): string[] {
  const findings: string[] = [];
  for (const [file, text] of sources) {
    // The two names must be the strategies' own, not a rename of something
    // else.
    if (/\banalyse\w+\s*:\s*(analyseException|judged)\b/.test(text)) {
      findings.push(
        `${relative(ROOT, file)}:require: a judge renamed on import`,
      );
    }
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        Object.hasOwn(JS_OPTIONS_INDEX, node.expression.name.text)
      ) {
        const receiver = node.expression.expression
          .getText()
          .replace(/\s+/g, '');
        if (/^client\..*get\w+\(|^handler$/.test(receiver)) {
          const member = node.expression.name.text;
          const problem = jsJudgeProblem(
            node.arguments[JS_OPTIONS_INDEX[member] ?? -1],
          );
          if (problem) {
            findings.push(`${keyOf(file, member, node)} — ${problem}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

const SCOPED_FILES = SCOPES.flatMap((scope) =>
  filesUnder(join(ROOT, scope), /\.ts$/),
);

describe('integration suites and helpers judge every adt-clients call', () => {
  const findings = [...typedFindings(SCOPED_FILES), ...jsFindings()];
  const unallowed = findings.filter(
    (finding) => !ALLOWED.has(finding.split(' — ')[0] ?? ''),
  );

  it('passes an analyse strategy, the exception document read first', () => {
    expect(unallowed).toEqual([]);
  });

  it('keeps no allow-list entry that matches no call', () => {
    const keys = new Set(findings.map((finding) => finding.split(' — ')[0]));
    expect([...ALLOWED.keys()].filter((key) => !keys.has(key))).toEqual([]);
  });
});

/**
 * The guard's own fixtures, in memory beside the helpers so their imports
 * resolve as a helper's would. Each refused form is refused for its own
 * reason; the judged forms pass.
 */
describe('the guard resolves receivers and judges by symbol', () => {
  const at = (name: string) => join(ROOT, 'src/__tests__/helpers', name);
  const HEAD = `import { analyseDeletion, analyseException, analyseDeletion as del } from '@mcp-abap-adt/adt-strategies';
import type { IAdtAnalyseOptions, IAdtResponse, IAdtRunnable, ITestRunInformation } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../clients/AdtClient';
import { judged } from './judged';
type Domain = ReturnType<AdtClient['getDomain']>;
`;
  const fixture = (name: string, body: string): [string, string] => [
    at(name),
    `${HEAD}${body}`,
  ];
  const fixtures = new Map<string, string>([
    fixture(
      '__guardHandler.ts',
      `type Handler = {
  readMetadata(config: any): Promise<any>;
  delete(config: any, options?: any): Promise<any>;
};
export async function f(handler: Handler) {
  await handler.readMetadata({});
  await handler.delete({}, {});
}
`,
    ),
    fixture(
      '__guardRunner.ts',
      `interface IRunner {
  getStatus(runId: string, withLongPolling?: boolean): Promise<IAdtResponse<unknown>>;
  getResult(runId: string): Promise<IAdtResponse<unknown>>;
}
export async function f(runner: IRunner) {
  await runner.getStatus('R', true);
  await runner.getResult('R');
}
`,
    ),
    fixture(
      '__guardClient.ts',
      `interface IGroupClient {
  getFunctionGroup(): {
    readMetadata(config: { functionGroupName: string }): Promise<IAdtResponse<unknown>>;
  };
}
export async function f(client: IGroupClient) {
  await client.getFunctionGroup().readMetadata({ functionGroupName: 'Z' });
}
`,
    ),
    fixture(
      '__guardAny.ts',
      `export async function f(handler: any) {
  await handler.readMetadata({}, { analyse: analyseException });
}
`,
    ),
    fixture(
      '__guardComputed.ts',
      `export async function f(h: Domain, key: 'readMetadata' | 'delete') {
  await h['readMetadata']({});
  await h[key]({});
}
`,
    ),
    fixture(
      '__guardBound.ts',
      `export async function f(h: Domain) {
  const read = h.readMetadata.bind(h);
  await read({});
}
`,
    ),
    fixture(
      '__guardDestructured.ts',
      `export async function f(h: Domain) {
  const { readMetadata } = h;
  await readMetadata({});
}
`,
    ),
    fixture(
      '__guardCallApply.ts',
      `export async function f(h: Domain) {
  await h.readMetadata.call(h, {}, { analyse: analyseException });
}
`,
    ),
    fixture(
      '__guardAlias.ts',
      `export async function f(h: Domain) {
  await h.delete({}, { analyse: del });
}
`,
    ),
    fixture(
      '__guardShorthand.ts',
      `export async function f(h: Domain) {
  const analyse = analyseDeletion;
  await h.delete({}, { analyse });
}
`,
    ),
    fixture(
      '__guardVariable.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseDeletion };
  await h.delete({}, opts);
}
`,
    ),
    fixture(
      '__guardSpreadUndefined.ts',
      `export async function f(h: Domain, opts: IAdtAnalyseOptions) {
  await h.readMetadata({}, { analyse: analyseException, ...opts });
}
`,
    ),
    fixture(
      '__guardSpreadSpecific.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseDeletion };
  await h.delete({}, { analyse: judged(analyseDeletion), ...opts });
}
`,
    ),
    fixture(
      '__guardUndefined.ts',
      `export async function f(h: Domain, flag: boolean) {
  await h.readMetadata({}, { analyse: flag ? analyseException : undefined });
}
`,
    ),
    fixture(
      '__guardMutated.ts',
      `export async function f(h: Domain) {
  const opts: { analyse?: unknown } = { analyse: analyseException };
  opts.analyse = undefined;
  await h.readMetadata({}, opts as never);
}
`,
    ),
    fixture(
      '__guardAliasMutated.ts',
      `export async function f(h: Domain) {
  const opts: { analyse?: unknown } = { analyse: analyseException };
  const alias = opts;
  alias.analyse = undefined;
  await h.readMetadata({}, opts as never);
}
`,
    ),
    fixture(
      '__guardDeleted.ts',
      `export async function f(h: Domain) {
  const opts: { analyse?: unknown } = { analyse: analyseException };
  delete opts.analyse;
  await h.readMetadata({}, opts as never);
}
`,
    ),
    fixture(
      '__guardAssigned.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseException };
  Object.assign(opts, { analyse: undefined });
  await h.readMetadata({}, opts);
}
`,
    ),
    fixture(
      '__guardEscaped.ts',
      `function tamper(o: { analyse?: unknown }) { o.analyse = undefined; }
export async function f(h: Domain) {
  const opts = { analyse: analyseException };
  tamper(opts);
  await h.readMetadata({}, opts);
}
`,
    ),
    fixture(
      '__guardExported.ts',
      `export const sharedOptions = { analyse: analyseException };
export async function f(h: Domain) {
  await h.readMetadata({}, sharedOptions);
}
`,
    ),
    fixture(
      '__guardCleanConst.ts',
      `export async function f(h: Domain) {
  const opts = { analyse: analyseException, headers: undefined };
  const copied = { ...opts };
  void opts.headers;
  await h.readMetadata({}, opts);
  await h.readMetadata({}, copied);
}
`,
    ),
    fixture(
      '__guardJudged.ts',
      `type IRunner = IAdtRunnable<string, unknown, object> & ITestRunInformation<unknown, unknown>;
export async function judgedCalls(h: Domain, runner: IRunner) {
  const opts = { analyse: judged(del) };
  const analyse = analyseException;
  const { readMetadata } = h;
  await h.delete({}, opts);
  await h.readMetadata({}, { analyse });
  await readMetadata({}, { analyse: analyseException });
  await h['readMetadata']({}, { headers: undefined, analyse: analyseException });
  await h.delete({}, { analyse: analyseDeletion, ...opts });
  await runner.getStatus('R', true, { analyse: analyseException });
}
`,
    ),
  ]);
  const findings = typedFindings([], fixtures);
  const of = (name: string) =>
    findings.filter((finding) => finding.includes(`/${name}:`));

  it.each([
    ['__guardHandler.ts', 2, /drops its analyse/],
    ['__guardRunner.ts', 2, /drops its analyse/],
    ['__guardClient.ts', 1, /drops its analyse/],
    ['__guardAny.ts', 1, /any-typed receiver/],
    ['__guardComputed.ts', 2, /no analyse|computed key/],
    ['__guardBound.ts', 1, /no analyse/],
    ['__guardDestructured.ts', 1, /no analyse/],
    ['__guardCallApply.ts', 1, /call\(\)/],
    ['__guardAlias.ts', 1, /analyseDeletion alone/],
    ['__guardShorthand.ts', 1, /analyseDeletion alone/],
    ['__guardVariable.ts', 1, /analyseDeletion alone/],
    ['__guardSpreadUndefined.ts', 1, /may be undefined/],
    ['__guardSpreadSpecific.ts', 1, /analyseDeletion alone/],
    ['__guardUndefined.ts', 1, /may be undefined/],
    ['__guardMutated.ts', 1, /has a property assigned/],
    ['__guardAliasMutated.ts', 1, /cannot prove/],
    ['__guardDeleted.ts', 1, /has a property deleted/],
    ['__guardAssigned.ts', 1, /escapes to a call/],
    ['__guardEscaped.ts', 1, /escapes to a call/],
    ['__guardExported.ts', 1, /is exported/],
  ])('refuses %s', (name, count, why) => {
    expect(of(name)).toHaveLength(count);
    for (const finding of of(name)) expect(finding).toMatch(why);
  });

  it('passes the judged forms: aliases, shorthand, variables, destructured and computed members, spreads that keep the judge', () => {
    expect(of('__guardJudged.ts')).toEqual([]);
  });

  it('passes a const options object nothing changes: read, copied, passed to the member', () => {
    expect(of('__guardCleanConst.ts')).toEqual([]);
  });
});

describe('the guard reads test-helper.js as written', () => {
  const js = (name: string, body: string): [string, string] => [
    join(ROOT, 'src/__tests__/helpers', name),
    body,
  ];
  const findings = jsFindings(
    new Map([
      js(
        '__guardSpread.js',
        `async function f(client, options) {
  await client.getDomain().readMetadata({}, { analyse: analyseException, ...options });
}`,
      ),
      js(
        '__guardRenamed.js',
        `const { analyseDeletion: analyseException } = require('@mcp-abap-adt/adt-strategies');
async function f(client) {
  await client.getDomain().delete({}, { analyse: analyseException });
}`,
      ),
      js(
        '__guardWrongJudge.js',
        `async function f(handler) {
  await handler.delete({}, { analyse: analyseDeletion });
  await handler.lock({});
}`,
      ),
      js(
        '__guardJudged.js',
        `async function f(client, handler) {
  await client.getDomain().readMetadata({}, { analyse: analyseException });
  await handler.delete({}, { analyse: judged(analyseDeletion) });
}`,
      ),
    ]),
  );
  const of = (name: string) =>
    findings.filter((finding) => finding.includes(`/${name}:`));

  it('refuses a spread in the options', () => {
    expect(of('__guardSpread.js')).toEqual([
      expect.stringMatching(/a spread in options/),
    ]);
  });

  it('refuses a judge renamed on import', () => {
    expect(of('__guardRenamed.js')).toEqual([
      expect.stringMatching(/renamed on import/),
    ]);
  });

  it('refuses an uncomposed judge and a missing one', () => {
    expect(of('__guardWrongJudge.js')).toEqual([
      expect.stringMatching(/analyseDeletion is neither/),
      expect.stringMatching(/no options|cannot read/),
    ]);
  });

  it('passes analyseException and judged(analyseX)', () => {
    expect(of('__guardJudged.js')).toEqual([]);
  });
});
