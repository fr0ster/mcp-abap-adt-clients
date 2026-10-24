/**
 * Every call an integration suite or a test helper makes to an adt-clients
 * member is judged: it passes an `analyse` strategy.
 *
 * A member answers what came off the wire, so an `exc:exception` inside an
 * HTTP 200 — an authorization refusal, say — is `ok: true` unless the call
 * asked for a reading. A test that only checked `ok` then passed over a
 * refusal. So:
 *
 * - every call to a member whose options take `analyse` passes one —
 *   `analyseException` by default;
 * - a specific judge of adt-strategies (`analyseActivation`,
 *   `analyseDeletion`, `analyseValidation`, …) reads only its own document
 *   form and answers an exception document as "no failure", so it is passed
 *   composed: `judged(analyseX)` (helpers/judged.ts) reads the exception
 *   first;
 * - options passed as an expression count only when its type carries a
 *   required `analyse`.
 *
 * The TypeScript files are read with the compiler's type checker: a call is
 * a member's when its declaration lives in this package's source or in an
 * `@mcp-abap-adt` contract package and one of its parameters takes
 * `analyse`. test-helper.js has no types, so its calls are found by member
 * name on a client handler (`client.getX().member(…)`, `handler.member(…)`).
 *
 * A call deliberately judged otherwise goes into ALLOWED, with its reason.
 * An entry that no longer matches a call fails too, so the list cannot rot.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';

const ROOT = join(__dirname, '../../..');
const SCOPES = ['src/__tests__/integration', 'src/__tests__/helpers'];

/**
 * `<file>:<member>:<first 60 characters of the call>` → why it is judged
 * otherwise. Empty: every call in scope passes a strategy today.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([]);

/** adt-strategies' judges that read one document form only. */
const SPECIFIC = new Set([
  'analyseActivation',
  'analyseDeletion',
  'analyseValidation',
  'analyseCheck',
  'analyseUnitTest',
  'analyseCdsTestDoubles',
  'analysePublication',
  'analyseMessageClassMessage',
  'analyseAny',
  // The test side's own stricter activation verdict (helpers/sharedActivation.ts).
  'analyseActivationExecuted',
]);

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full, ext);
    return ext.test(name) ? [full] : [];
  });
}

/** What is wrong with the `analyse` of an options argument, or `undefined`. */
function analyseProblem(
  arg: ts.Expression | undefined,
  checker?: ts.TypeChecker,
): string | undefined {
  if (!arg) return 'no options, so no analyse';
  if (ts.isObjectLiteralExpression(arg)) {
    const own = arg.properties.find(
      (p) => p.name !== undefined && p.name.getText() === 'analyse',
    );
    if (own) {
      if (!ts.isPropertyAssignment(own)) return undefined;
      const value = own.initializer;
      const judge = ts.isCallExpression(value)
        ? value.expression.getText()
        : value.getText();
      return SPECIFIC.has(judge)
        ? `${judge} alone reads no exception document — pass judged(${judge})`
        : undefined;
    }
    // A spread that carries a required `analyse` counts.
    const spread = arg.properties.find(
      (p) =>
        ts.isSpreadAssignment(p) &&
        checker !== undefined &&
        requiresAnalyse(checker.getTypeAtLocation(p.expression), checker),
    );
    return spread ? undefined : 'options without analyse';
  }
  if (checker && requiresAnalyse(checker.getTypeAtLocation(arg), checker)) {
    return undefined;
  }
  return 'options whose type carries no required analyse';
}

function requiresAnalyse(type: ts.Type, checker: ts.TypeChecker): boolean {
  const property = checker.getNonNullableType(type).getProperty('analyse');
  return (
    property !== undefined && (property.flags & ts.SymbolFlags.Optional) === 0
  );
}

function isContractDeclaration(declaration: ts.Declaration): boolean {
  const file = declaration.getSourceFile().fileName;
  return (
    (file.includes('/src/') && !file.includes('/src/__tests__/')) ||
    file.includes('node_modules/@mcp-abap-adt/')
  );
}

/** The index of a declaration's parameter that takes `analyse`, or -1. */
function analyseIndexOf(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): number {
  const parameters = parametersOf(declaration);
  for (const [index, parameter] of (parameters ?? []).entries()) {
    const type = checker.getNonNullableType(
      checker.getTypeAtLocation(parameter),
    );
    const members = type.isUnion() ? type.types : [type];
    if (members.some((member) => member.getProperty('analyse'))) return index;
  }
  return -1;
}

/** The index of the parameter that takes `analyse`, across every overload. */
function optionsIndex(symbol: ts.Symbol, checker: ts.TypeChecker): number {
  for (const declaration of symbol.declarations ?? []) {
    if (!isContractDeclaration(declaration)) continue;
    const parameters =
      ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration)
        ? declaration.parameters
        : ts.isPropertySignature(declaration) &&
            declaration.type &&
            ts.isFunctionTypeNode(declaration.type)
          ? declaration.type.parameters
          : undefined;
    if (!parameters) continue;
    for (const [index, parameter] of parameters.entries()) {
      const type = checker.getNonNullableType(
        checker.getTypeAtLocation(parameter),
      );
      const members = type.isUnion() ? type.types : [type];
      if (members.some((member) => member.getProperty('analyse'))) {
        return index;
      }
    }
  }
  return -1;
}

function keyOf(file: string, member: string, call: ts.Node): string {
  return `${relative(ROOT, file)}:${member}:${call
    .getText()
    .replace(/\s+/g, ' ')
    .slice(0, 60)}`;
}

/** The parameters of a method-like declaration, or `undefined`. */
function parametersOf(
  declaration: ts.Declaration,
): ts.NodeArray<ts.ParameterDeclaration> | undefined {
  if (ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration))
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

/**
 * Every method name the contracts declare with an `analyse`-taking
 * parameter, read off the program's own contract files.
 */
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
        node.name &&
        ts.isIdentifier(node.name) &&
        !names.has(node.name.text) &&
        node.parameters.some((parameter) => {
          const type = checker.getNonNullableType(
            checker.getTypeAtLocation(parameter),
          );
          const members = type.isUnion() ? type.types : [type];
          return members.some((member) => member.getProperty('analyse'));
        })
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
 * A local declaration that stands in for an adt-clients member: a method of
 * that name, declared in the suites or helpers, answering a contract or
 * anything (`Promise<IAdtResponse<…>>`, `Promise<any>`).
 */
function isLocalNarrowing(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): boolean {
  if (isContractDeclaration(declaration)) return false;
  const signatures =
    ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration)
      ? [checker.getSignatureFromDeclaration(declaration)]
      : checker.getTypeAtLocation(declaration).getCallSignatures();
  return signatures.some((signature) => {
    // A thunk (`list: () => client.getX().getVersions(…)`) narrows nothing:
    // it takes no argument, and the call inside it is checked on its own.
    if (!signature || signature.getParameters().length === 0) return false;
    const answered = checker.typeToString(signature.getReturnType());
    return /IAdtResponse|^Promise<any>$|^any$/.test(answered);
  });
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
      ? ts.createSourceFile(name, text, language)
      : getSourceFile(name, language, ...rest);
  };
  const program = ts.createProgram(
    [...files, ...virtual.keys()],
    options,
    host,
  );
  const checker = program.getTypeChecker();
  const members = contractMemberNames(program, checker);
  const findings: string[] = [];
  for (const file of [...files, ...virtual.keys()]) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const name = node.expression.name;
        const key = keyOf(file, name.text, node);
        const symbol = checker.getSymbolAtLocation(name);
        const index = symbol ? optionsIndex(symbol, checker) : -1;
        const receiver = checker.getTypeAtLocation(node.expression.expression);
        if (index >= 0) {
          const problem = analyseProblem(node.arguments[index], checker);
          if (problem) findings.push(`${key} — ${problem}`);
        } else if (members.has(name.text)) {
          // Not a contract declaration, but a member's name: an `any`
          // receiver hides which member it is, and a local declaration that
          // narrows one hides its `analyse`. Both are refused outright —
          // type the receiver from the client's own types.
          if (receiver.flags & ts.TypeFlags.Any) {
            findings.push(
              `${key} — called on an any-typed receiver: type it from the client`,
            );
          } else {
            const narrowing = (symbol?.declarations ?? []).filter(
              (declaration) => isLocalNarrowing(declaration, checker),
            );
            // A local declaration that narrows a member is judged like the
            // member when it carries the `analyse` option; one that drops it
            // hides the option from the compiler, and is refused.
            const localIndex = narrowing
              .map((declaration) => analyseIndexOf(declaration, checker))
              .find((found) => found >= 0);
            if (narrowing.length > 0 && localIndex === undefined) {
              findings.push(
                `${key} — a local declaration narrows the adt-clients member and drops its analyse option: build the type from the client (Pick<…>, the contract interface)`,
              );
            } else if (localIndex !== undefined) {
              const problem = analyseProblem(
                node.arguments[localIndex],
                checker,
              );
              if (problem) findings.push(`${key} — ${problem}`);
            }
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

function jsFindings(): string[] {
  const files = SCOPES.flatMap((scope) =>
    filesUnder(join(ROOT, scope), /\.js$/),
  );
  const findings: string[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
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
          const problem = analyseProblem(
            node.arguments[JS_OPTIONS_INDEX[member] ?? -1],
          );
          if (
            problem &&
            problem !== 'options whose type carries no required analyse'
          ) {
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
 * The guard's own fixtures: the three shapes that hid unjudged calls — a
 * hand-written handler type, a hand-written runner interface, a
 * hand-written client — and an `any` receiver, each refused; the same calls
 * typed from the client and judged pass.
 */
describe('the guard sees through locally narrowed receivers', () => {
  const at = (name: string) => join(ROOT, 'src/__tests__/helpers', name);
  const HEAD = `import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse, IAdtRunnable, ITestRunInformation } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../clients/AdtClient';
`;
  const fixtures = new Map<string, string>([
    [
      at('__guardHandler.ts'),
      `${HEAD}type Handler = {
  readMetadata(config: any): Promise<any>;
  delete(config: any, options?: any): Promise<any>;
};
export async function f(handler: Handler) {
  await handler.readMetadata({});
  await handler.delete({}, {});
}
`,
    ],
    [
      at('__guardRunner.ts'),
      `${HEAD}interface IRunner {
  getStatus(runId: string, withLongPolling?: boolean): Promise<IAdtResponse<unknown>>;
  getResult(runId: string): Promise<IAdtResponse<unknown>>;
}
export async function f(runner: IRunner) {
  await runner.getStatus('R', true);
  await runner.getResult('R');
}
`,
    ],
    [
      at('__guardClient.ts'),
      `${HEAD}interface IGroupClient {
  getFunctionGroup(): {
    readMetadata(config: { functionGroupName: string }): Promise<IAdtResponse<unknown>>;
  };
}
export async function f(client: IGroupClient) {
  await client.getFunctionGroup().readMetadata({ functionGroupName: 'Z' });
}
`,
    ],
    [
      at('__guardAny.ts'),
      `${HEAD}export async function f(handler: any) {
  await handler.readMetadata({}, { analyse: analyseException });
}
`,
    ],
    [
      at('__guardTyped.ts'),
      `${HEAD}type IRunner = IAdtRunnable<string, unknown, object> & ITestRunInformation<unknown, unknown>;
type Handler = Pick<ReturnType<AdtClient['getDomain']>, 'readMetadata' | 'delete'>;
export async function judged(runner: IRunner, handler: Handler, client: Pick<AdtClient, 'getFunctionGroup'>) {
  await runner.getStatus('R', true, { analyse: analyseException });
  await handler.readMetadata({}, { analyse: analyseException });
  await client.getFunctionGroup().readMetadata({ functionGroupName: 'Z' }, { analyse: analyseException });
}
export async function unjudged(runner: IRunner, handler: Handler) {
  await runner.getResult('R');
  await handler.delete({}, {});
}
`,
    ],
  ]);
  const findings = typedFindings([], fixtures);
  const of = (name: string) =>
    findings.filter((finding) => finding.includes(`/${name}:`));

  it('refuses a hand-written handler type that drops analyse', () => {
    expect(of('__guardHandler.ts')).toHaveLength(2);
    expect(of('__guardHandler.ts').join('\n')).toMatch(/drops its analyse/);
  });

  it('refuses a hand-written runner interface', () => {
    expect(of('__guardRunner.ts')).toHaveLength(2);
  });

  it('refuses a hand-written client interface', () => {
    expect(of('__guardClient.ts')).toHaveLength(1);
  });

  it('refuses an any-typed receiver, analyse or not', () => {
    expect(of('__guardAny.ts')).toEqual([
      expect.stringMatching(/any-typed receiver/),
    ]);
  });

  it('passes the same calls typed from the client and judged, and refuses them unjudged', () => {
    const typed = of('__guardTyped.ts');
    expect(typed).toHaveLength(2);
    expect(typed.join('\n')).toMatch(/getResult/);
    expect(typed.join('\n')).toMatch(/delete/);
  });
});
