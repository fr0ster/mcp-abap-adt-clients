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

/** Typed files: every member call without a judged `analyse`. */
function typedFindings(): string[] {
  const files = SCOPES.flatMap((scope) =>
    filesUnder(join(ROOT, scope), /\.ts$/),
  );
  const config = ts.readConfigFile(
    join(ROOT, 'tsconfig.json'),
    ts.sys.readFile,
  );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const findings: string[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const name = node.expression.name;
        const symbol = checker.getSymbolAtLocation(name);
        const index = symbol ? optionsIndex(symbol, checker) : -1;
        if (index >= 0) {
          const problem = analyseProblem(node.arguments[index], checker);
          if (problem) {
            findings.push(`${keyOf(file, name.text, node)} — ${problem}`);
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

describe('integration suites and helpers judge every adt-clients call', () => {
  const findings = [...typedFindings(), ...jsFindings()];
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
