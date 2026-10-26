/**
 * The scan behind "`integrationHeadersOf` is the only resolver in tests that
 * reach SAP" (`integrationHeadersOf.test.ts`), shared so a package of this
 * repository whose suites run on this harness scans its own tests the same
 * way, by importing this module by relative path.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import * as ts from 'typescript';

/** The files the scan reads: what Jest's `*.test.[tj]s` matches, and `.mjs` / `.cjs`. */
export const SCANNED = ['.ts', '.js', '.mjs', '.cjs'];

/**
 * `const { integrationHeadersOf } = require('…')`: a CommonJS file (the
 * JavaScript `test-helper.js`) taking the strict resolver and nothing else.
 */
function takesOnlyStrictResolver(call: ts.CallExpression): boolean {
  const declaration = call.parent;
  if (
    !ts.isVariableDeclaration(declaration) ||
    declaration.initializer !== call ||
    !ts.isObjectBindingPattern(declaration.name)
  )
    return false;
  const elements = declaration.name.elements;
  return (
    elements.length > 0 &&
    elements.every(
      (element) =>
        !element.dotDotDotToken &&
        (element.propertyName ?? element.name).getText() ===
          'integrationHeadersOf',
    )
  );
}

/** Whether a CommonJS name starts `exports` or `module.exports`. */
function isExportsName(node: ts.Node): boolean {
  const text = node.getText();
  return (
    text === 'exports' ||
    text.startsWith('exports.') ||
    text === 'module.exports' ||
    text.startsWith('module.exports.')
  );
}

/**
 * Whether `node` is part of what a CommonJS module exports: the right side
 * of an assignment to `exports` / `module.exports` (or one of their
 * properties), or an argument of `Object.assign(exports | module.exports, …)`.
 */
function assignedToExports(node: ts.Node): boolean {
  for (let at: ts.Node = node; at.parent; at = at.parent) {
    const parent = at.parent;
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      parent.right === at &&
      isExportsName(parent.left)
    )
      return true;
    if (
      ts.isCallExpression(parent) &&
      parent.expression.getText() === 'Object.assign' &&
      parent.arguments[0] !== undefined &&
      isExportsName(parent.arguments[0])
    )
      return true;
  }
  return false;
}

/**
 * Under `root` (a package's `src/__tests__`), read with the TypeScript parser
 * — `definition` is the harness's `helpers/adtHeaders` (without extension),
 * this root's own unless a package that runs on the harness names it:
 * - no file but `helpers/adtHeaders.ts` itself re-exports anything from it,
 *   in any form (`export *`, `export * as`, named, type-only);
 * - a file in the directories whose tests reach SAP (integration, admin,
 *   helpers) imports from it only `integrationHeadersOf`, the registration
 *   seams ({@link STRICT_IMPORTS}) and types, and does not load it with
 *   `require` or `import()`.
 * Each offence is `<file>: <what>`.
 */
/**
 * What a file that reaches SAP may import from `helpers/adtHeaders`: the strict
 * resolver, and the seams through which a handler class from elsewhere
 * registers its pairs and refusals — they add pairs, and resolve none.
 */
export const STRICT_IMPORTS = new Set([
  'integrationHeadersOf',
  'registerHeaderPairs',
  'registerRefusedMembers',
  'registerRefusingHandler',
]);

export function resolverOffenders(
  root: string,
  definition: string = join(root, 'helpers', 'adtHeaders'),
): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : SCANNED.some((extension) => entry.name.endsWith(extension))
          ? [join(dir, entry.name)]
          : [],
    );
  const reachesSap = ['integration', 'admin', 'helpers'];
  const offences: string[] = [];
  for (const path of walk(root)) {
    const file = relative(root, path);
    if (path === `${definition}.ts`) continue;
    const strict = reachesSap.includes(file.split(sep)[0] ?? '');
    const isDefinition = (specifier: ts.Node | undefined): boolean => {
      if (!specifier || !ts.isStringLiteral(specifier)) return false;
      const text = specifier.text;
      if (!text.startsWith('.')) return false;
      const target = resolve(dirname(path), text);
      return (
        target === definition ||
        SCANNED.some((extension) => target === `${definition}${extension}`)
      );
    };
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isExportDeclaration(node) && isDefinition(node.moduleSpecifier))
        offences.push(`${file}: re-exports helpers/adtHeaders`);
      // `import h = require('…')`, and `export import h = require('…')`.
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        isDefinition(node.moduleReference.expression)
      ) {
        if (
          node.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          )
        )
          offences.push(`${file}: re-exports helpers/adtHeaders`);
        else if (strict && !node.isTypeOnly)
          offences.push(`${file}: imports the whole module`);
      }
      if (
        strict &&
        ts.isImportDeclaration(node) &&
        isDefinition(node.moduleSpecifier)
      ) {
        const clause = node.importClause;
        if (clause && !clause.isTypeOnly) {
          if (clause.name) offences.push(`${file}: imports a default`);
          const bindings = clause.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings))
            offences.push(`${file}: imports the whole module`);
          if (bindings && ts.isNamedImports(bindings))
            for (const element of bindings.elements) {
              const name = (element.propertyName ?? element.name).text;
              if (!element.isTypeOnly && !STRICT_IMPORTS.has(name))
                offences.push(`${file}: imports ${name}`);
            }
        }
        if (!clause) offences.push(`${file}: imports the module for effect`);
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require')) &&
        isDefinition(node.arguments[0])
      ) {
        if (assignedToExports(node))
          offences.push(`${file}: re-exports helpers/adtHeaders`);
        else if (strict && !takesOnlyStrictResolver(node))
          offences.push(`${file}: loads the module at runtime`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return offences;
}
