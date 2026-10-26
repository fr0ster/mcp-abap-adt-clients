/**
 * The scan behind `headersPassed.test.ts`: every call of a member that takes
 * `options.headers`, in a file whose tests reach SAP, passes `headers` itself
 * (the rules are that file's). Shared so a package of this repository whose
 * suites run on this harness scans its own tests the same way, by importing
 * this module by relative path.
 */

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';

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

/**
 * Where a scan runs: its `src/__tests__` (findings are named relative to it),
 * the tsconfig its program takes its options from, and what counts as library
 * code — a declaration under one of `library` and under none of `tests`
 * (installed packages always count).
 */
export interface IHeadersScan {
  tests: string;
  tsconfig: string;
  library: readonly string[];
  testDirs: readonly string[];
}

export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(dir, entry.name))
      : SCANNED.some((extension) => entry.name.endsWith(extension))
        ? [join(dir, entry.name)]
        : [],
  );
}

function compilerOptions(tsconfig: string): ts.CompilerOptions {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    tsconfig,
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
  scan: IHeadersScan,
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
    (scan.library.some((dir) => declaredIn.startsWith(dir + sep)) &&
      !scan.testDirs.some((dir) => declaredIn.startsWith(dir + sep)));
  if (!library) return false;
  return !signature.getParameters().some((parameter) => {
    const type = checker.getNonNullableType(
      checker.getTypeOfSymbolAtLocation(parameter, call),
    );
    return type.getProperty('headers') !== undefined;
  });
}

/** `<file>:<line> <call>` for every call of a header member without headers. */
export function callsWithoutHeaders(
  scan: IHeadersScan,
  files: readonly string[],
): string[] {
  const program = ts.createProgram(files, compilerOptions(scan.tsconfig));
  const checker = program.getTypeChecker();
  const found: string[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) {
      found.push(`${relative(scan.tests, file)}: not read`);
      continue;
    }
    const at = (node: ts.Node, what: string) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${relative(scan.tests, file)}:${line + 1} ${what}`);
    };
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        HEADER_MEMBERS.has(node.expression.name.text) &&
        !passesHeaders(checker, node) &&
        !takesNoHeaders(scan, checker, node)
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
