/**
 * The guard behind `integrationCallsAreJudged.test.ts`: every call an
 * integration suite or a test helper makes to an adt-clients member passes a
 * judged `analyse` (see that file for the rules). Shared so a package of this
 * repository whose suites run on this harness holds its own suites and
 * helpers to the same rule, by importing this module by relative path; the
 * root of the scan and the tsconfig its program is built with are the
 * caller's.
 */

import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as ts from 'typescript';

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

export function filesUnder(dir: string, ext: RegExp): string[] {
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

/**
 * The parameters a call's arguments bind to, or `undefined`: a `this`
 * parameter — the variant gate of 38.0.0 — takes no argument, so it is left
 * out, or every index after it would be off by one.
 */
function parametersOf(
  declaration: ts.Declaration,
): readonly ts.ParameterDeclaration[] | undefined {
  const all = declaredParametersOf(declaration);
  return all?.filter(
    (parameter) =>
      !(ts.isIdentifier(parameter.name) && parameter.name.text === 'this'),
  );
}

/** The declared parameters of a method-like declaration, or `undefined`. */
function declaredParametersOf(
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

function keyOf(
  root: string,
  file: string,
  member: string,
  call: ts.Node,
): string {
  return `${relative(root, file)}:${member}:${call
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
export function typedFindings(
  root: string,
  tsconfig: string,
  files: readonly string[],
  virtual: ReadonlyMap<string, string> = new Map(),
): string[] {
  const config = ts.readConfigFile(tsconfig, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(tsconfig),
  );
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
        const key = `${keyOf(root, file, name, node)}${
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

export function jsFindings(
  root: string,
  sources: ReadonlyMap<string, string>,
): string[] {
  const findings: string[] = [];
  for (const [file, text] of sources) {
    // The two names must be the strategies' own, not a rename of something
    // else.
    if (/\banalyse\w+\s*:\s*(analyseException|judged)\b/.test(text)) {
      findings.push(
        `${relative(root, file)}:require: a judge renamed on import`,
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
            findings.push(`${keyOf(root, file, member, node)} — ${problem}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}
