import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';

/**
 * Every call of a member that takes `options.headers` (MIGRATION-36.md), in a
 * file whose tests reach SAP, passes `headers` itself.
 *
 * The compiler already refuses a typed call without them, but not a call it
 * cannot type: a JavaScript helper (`test-helper.js`), a receiver typed `any`,
 * or a test's own structural type with `options?: any`. Such a call reaches
 * the member with no pair, and it throws before the request leaves. So this
 * reads every `.ts`, `.js`, `.mjs` and `.cjs` file under `integration`,
 * `admin` and `helpers` with the TypeScript checker and requires, at every
 * call of one of those member names, an object-literal argument with a
 * `headers` property. The one exemption is a call the checker resolves to a
 * signature declared in library code (`src` outside `src/__tests__`, or an
 * installed package) that has no `headers` parameter: a `Map`'s `delete`, a
 * hash's `update`, a profiler's `delete`.
 * The `headers` must sit in the options argument: the position the resolved
 * signature gives its `headers` parameter, or, for a call the checker cannot
 * type, the last of at least two arguments. A member taken off its object
 * (`.bind`, `.call`, `.apply`, `x['update']`, or destructured) is reported
 * too, since its arguments cannot be seen at the call.
 */

/** The members that take `options.headers` since 36.0.0 (MIGRATION-36.md). */
const HEADER_MEMBERS = new Set([
  'create',
  'update',
  'updateMetadata',
  'delete',
  'checkDeletion',
  'check',
  'activate',
  'checkState',
  'removeObject',
  'addObject',
  'createTask',
  'changeTaskType',
  'moveObjects',
  'getWhereUsed',
  'getWhereUsedScope',
  'getVirtualFoldersContents',
  'fetchNodeStructure',
  'activateObjectsGroup',
  'checkDeletionGroup',
  'deleteObjectsGroup',
  'getSqlQuery',
  'getTableContents',
  'scheduleTrace',
  'link',
  'pull',
  'checkExternalRepo',
  'setBreakpoints',
  'getChildVariables',
  'getVariables',
  'syncBreakpoints',
  'setDebuggerSettings',
  'getDataPreview',
]);

const SCANNED = ['.ts', '.js', '.mjs', '.cjs'];

const TESTS = join(__dirname, '..', '..');
const ROOT = join(TESTS, '..', '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(dir, entry.name))
      : SCANNED.some((extension) => entry.name.endsWith(extension))
        ? [join(dir, entry.name)]
        : [],
  );
}

function compilerOptions(): ts.CompilerOptions {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    join(ROOT, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    },
  );
  return {
    ...(parsed?.options ?? {}),
    allowJs: true,
    checkJs: false,
    noEmit: true,
  };
}

/** Whether an argument is an object literal that names `headers`. */
function namesHeaders(argument: ts.Expression | undefined): boolean {
  // A later spread can still erase it (`{ headers, ...{ headers: undefined } }`):
  // this catches a forgotten pair, not deliberate evasion.
  return (
    argument !== undefined &&
    ts.isObjectLiteralExpression(argument) &&
    argument.properties.some(
      (property) => property.name?.getText() === 'headers',
    )
  );
}

/**
 * The index of the options argument: from the resolved signature, the
 * parameter whose type carries `headers`. A call the checker cannot type (a
 * JavaScript helper, an `any` receiver) has none; there the options are the
 * last of at least two arguments, after the config, as every header member
 * takes them.
 */
function optionsIndex(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): number | undefined {
  const signature = checker.getResolvedSignature(call);
  const index = signature
    ?.getParameters()
    .findIndex(
      (parameter) =>
        checker
          .getNonNullableType(
            checker.getTypeOfSymbolAtLocation(parameter, call),
          )
          .getProperty('headers') !== undefined,
    );
  if (index !== undefined && index >= 0) return index;
  return call.arguments.length >= 2 ? call.arguments.length - 1 : undefined;
}

function passesHeaders(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): boolean {
  const index = optionsIndex(checker, call);
  return index !== undefined && namesHeaders(call.arguments[index]);
}

/** A resolved signature, declared in library code, that takes no headers. */
function takesNoHeaders(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): boolean {
  const signature = checker.getResolvedSignature(call);
  const declaration = signature?.getDeclaration();
  if (!signature || !declaration) return false;
  // Library code only: the package's own sources or an installed package
  // (the TypeScript lib included). A type a test declares proves nothing.
  const declaredIn = declaration.getSourceFile().fileName.split('/').join(sep);
  const library =
    declaredIn.includes(`${sep}node_modules${sep}`) ||
    (declaredIn.startsWith(join(ROOT, 'src') + sep) &&
      !declaredIn.startsWith(TESTS + sep));
  if (!library) return false;
  return !signature.getParameters().some((parameter) => {
    const type = checker.getNonNullableType(
      checker.getTypeOfSymbolAtLocation(parameter, call),
    );
    return type.getProperty('headers') !== undefined;
  });
}

/** `<file>:<line> <call>` for every call of a header member without headers. */
function callsWithoutHeaders(files: readonly string[]): string[] {
  const program = ts.createProgram(files, compilerOptions());
  const checker = program.getTypeChecker();
  const found: string[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) {
      found.push(`${relative(TESTS, file)}: not read`);
      continue;
    }
    const at = (node: ts.Node, what: string) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${relative(TESTS, file)}:${line + 1} ${what}`);
    };
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        HEADER_MEMBERS.has(node.expression.name.text) &&
        !passesHeaders(checker, node) &&
        !takesNoHeaders(checker, node)
      )
        at(node, `${node.expression.name.text}() without headers`);
      if (
        ts.isPropertyAccessExpression(node) &&
        ['bind', 'call', 'apply'].includes(node.name.text) &&
        ts.isPropertyAccessExpression(node.expression) &&
        HEADER_MEMBERS.has(node.expression.name.text)
      )
        at(node, `${node.expression.name.text}.${node.name.text}`);
      if (
        ts.isElementAccessExpression(node) &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        HEADER_MEMBERS.has(node.argumentExpression.text)
      )
        at(node, `['${node.argumentExpression.text}']`);
      // `const { update } = handler`, at any depth: the member leaves its
      // object, and a later `update(config)` cannot be read as its call.
      if (
        ts.isBindingElement(node) &&
        ts.isObjectBindingPattern(node.parent) &&
        HEADER_MEMBERS.has((node.propertyName ?? node.name).getText())
      )
        at(
          node,
          `{ ${(node.propertyName ?? node.name).getText()} } destructured`,
        );
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

describe('header members are called with headers', () => {
  it('in every integration, admin and helper file, JavaScript included', () => {
    const files = ['integration', 'admin', 'helpers'].flatMap((dir) =>
      filesUnder(join(TESTS, dir)),
    );
    expect(files.some((file) => file.endsWith('test-helper.js'))).toBe(true);
    expect(callsWithoutHeaders(files)).toEqual([]);
  });

  it('reports a call it cannot see the headers of, and passes one that needs none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'headers-passed-'));
    const file = (name: string, text: string) => {
      writeFileSync(join(dir, name), text);
      return join(dir, name);
    };
    const program = join(ROOT, 'src', 'core', 'program', 'AdtProgram')
      .split(sep)
      .join('/');
    try {
      const found = callsWithoutHeaders([
        file(
          'helper.js',
          [
            'async function write(handler, config) {',
            '  await handler.update(config, { source: "x" });',
            '  await handler.activate(config, { headers: pair });',
            '  const call = handler.updateMetadata.bind(handler);',
            "  await handler['delete'](config);",
            '  const { update } = handler;',
            '  const { inner: { activate: run } } = { inner: handler };',
            "  await handler.update({ programName: 'Z', headers: pair });",
            '}',
            '',
          ].join('\n'),
        ),
        file(
          'typed.ts',
          [
            `import { AdtProgram } from '${program}';`,
            'type Handler = { delete(config: unknown, options?: any): Promise<unknown> };',
            'export async function run(handler: Handler, seen: Map<string, number>, typed: AdtProgram) {',
            '  await handler.delete({}, { analyse: true });',
            "  seen.delete('x');",
            "  await typed.update({ programName: 'Z', headers: pair }, { source: 'x' });",
            "  await typed.update({ programName: 'Z' }, { source: 'x', headers: pair });",
            '}',
            '',
          ].join('\n'),
        ),
      ]).map((line) => line.slice(line.lastIndexOf(sep) + 1));
      expect(found).toEqual([
        'helper.js:2 update() without headers',
        'helper.js:4 updateMetadata.bind',
        "helper.js:5 ['delete']",
        'helper.js:6 { update } destructured',
        'helper.js:7 { activate } destructured',
        'helper.js:8 update() without headers',
        'typed.ts:4 delete() without headers',
        'typed.ts:6 update() without headers',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
