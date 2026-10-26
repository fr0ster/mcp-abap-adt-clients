/**
 * A legacy class is the root class with what 7.40 needs changed, and nothing
 * else (spec §1, "The AST rule becomes two rules").
 *
 * Every difference 7.40 needs lives in a `*Legacy` subclass of a class
 * `@mcp-abap-adt/adt-clients` exports, and the root package is not touched
 * from here. So this reads every source file of this package's `src`
 * (`src/__tests__/` left out) with the TypeScript parser and fails on:
 *
 * - a class whose name does not end in `Legacy` — it would escape the rules
 *   below;
 * - a `*Legacy` class that does not `extends` a class imported (as a value)
 *   from `@mcp-abap-adt/adt-clients`;
 * - a member of one that is not an override (`override`), a getter, a
 *   private helper (`private` or `#name`), or a constructor that only hands
 *   the base its arguments (one `super(…)` call) — a public member of its
 *   own is a member the root class does not have;
 * - a module that patches the root package: an assignment to, or a `delete`
 *   of, anything reached from a binding imported from it, or an
 *   `Object.defineProperty` / `defineProperties` / `assign` /
 *   `setPrototypeOf` on one.
 *
 * Comments are not code and are not read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');
const ROOT_PACKAGE = '@mcp-abap-adt/adt-clients';
const PATCHING_CALLS = new Set([
  'defineProperty',
  'defineProperties',
  'assign',
  'setPrototypeOf',
]);

/** The local names a file imports as values from the root package. */
function rootBindings(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== ROOT_PACKAGE
    )
      continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    if (clause.name) names.add(clause.name.text);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings))
      names.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings))
      for (const element of bindings.elements)
        if (!element.isTypeOnly) names.add(element.name.text);
  }
  return names;
}

/** The identifier an expression is reached from: `a` of `a.b[c].d`. */
function rootOf(expression: ts.Expression): string | undefined {
  let at: ts.Expression = expression;
  for (;;) {
    if (ts.isIdentifier(at)) return at.text;
    if (
      ts.isPropertyAccessExpression(at) ||
      ts.isElementAccessExpression(at) ||
      ts.isParenthesizedExpression(at) ||
      ts.isNonNullExpression(at) ||
      ts.isAsExpression(at)
    )
      at = at.expression;
    else return undefined;
  }
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
    (modifier) => modifier.kind === kind,
  ) ?? false;

/** Why a class member is not one a legacy class may have, or null. */
function memberProblem(member: ts.ClassElement): string | null {
  if (ts.isConstructorDeclaration(member)) {
    const statements = member.body?.statements ?? [];
    const onlySuper =
      statements.length === 1 &&
      ts.isExpressionStatement(statements[0] as ts.Statement) &&
      ts.isCallExpression(
        (statements[0] as ts.ExpressionStatement).expression,
      ) &&
      (
        (statements[0] as ts.ExpressionStatement)
          .expression as ts.CallExpression
      ).expression.kind === ts.SyntaxKind.SuperKeyword;
    return onlySuper ? null : 'a constructor that does more than call super';
  }
  if (ts.isSemicolonClassElement(member)) return null;
  if (ts.isGetAccessorDeclaration(member)) return null;
  if (hasModifier(member, ts.SyntaxKind.OverrideKeyword)) return null;
  if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) return null;
  if (member.name && ts.isPrivateIdentifier(member.name)) return null;
  return 'a member that is no override, getter or private helper';
}

/** `file:line  what` for every breach of the rules in a text. */
function findings(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imported = rootBindings(source);
  const found: string[] = [];
  const at = (node: ts.Node, what: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${file}:${line + 1}  ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.text ?? '(anonymous)';
      if (!name.endsWith('Legacy'))
        at(node, `class ${name} is not a *Legacy class`);
      else {
        const base = node.heritageClauses?.find(
          (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
        )?.types[0]?.expression;
        if (!base || !ts.isIdentifier(base) || !imported.has(base.text))
          at(node, `class ${name} extends no class of ${ROOT_PACKAGE}`);
        for (const member of node.members) {
          const problem = memberProblem(member);
          if (problem)
            at(
              member,
              `${name}.${member.name?.getText(source) ?? 'constructor'}: ${problem}`,
            );
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const target = rootOf(node.left);
      if (target && imported.has(target))
        at(node, `patches ${target} of ${ROOT_PACKAGE}`);
    }
    if (ts.isDeleteExpression(node)) {
      const target = rootOf(node.expression);
      if (target && imported.has(target))
        at(node, `patches ${target} of ${ROOT_PACKAGE}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Object' &&
      PATCHING_CALLS.has(node.expression.name.text)
    ) {
      const [first] = node.arguments;
      const target = first ? rootOf(first) : undefined;
      if (target && imported.has(target))
        at(node, `patches ${target} of ${ROOT_PACKAGE}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Every `.ts` under `src`, walked on disk, `src/__tests__/` left out. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(ROOT, rel), {
      withFileTypes: true,
    })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (next !== 'src/__tests__') walk(next);
      } else if (entry.name.endsWith('.ts')) out.push(next);
    }
  };
  walk('src');
  return out;
}

describe('a legacy class is the root class with overrides', () => {
  it('every class here is a *Legacy subclass of a root class, with overrides, getters and private helpers only, and nothing patches the root', () => {
    const files = sourceFiles();
    expect(files).toContain('src/clients/AdtClientLegacy.ts');
    expect(files.length).toBeGreaterThan(20);
    const found = files.flatMap((file) =>
      findings(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
    );
    expect(found).toEqual([]);
  });

  describe('the check itself', () => {
    const FILE = 'src/core/class/AdtClassLegacy.ts';

    it('takes overrides, getters, private helpers and a constructor that only calls super', () => {
      const text = [
        "import { AdtClass } from '@mcp-abap-adt/adt-clients';",
        'export class AdtClassLegacy extends AdtClass {',
        '  constructor(a: unknown) { super(a); }',
        '  override async delete() { return 1; }',
        '  get kind() { return 1; }',
        '  private refuse() { return 1; }',
        '  #own = 1;',
        '}',
      ].join('\n');
      expect(findings(FILE, text)).toEqual([]);
    });

    it('flags a public member of its own, a constructor that does more, a base from elsewhere', () => {
      const text = [
        "import { AdtClass } from '@mcp-abap-adt/adt-clients';",
        "import type { AdtProgram } from '@mcp-abap-adt/adt-clients';",
        "import { Other } from './other';",
        'export class AdtClassLegacy extends AdtClass {',
        '  constructor(a: unknown) { super(a); this.x = 1; }',
        '  async read() { return 1; }',
        '  protected helper() { return 1; }',
        '}',
        'export class AdtProgramLegacy extends AdtProgram {}',
        'export class AdtOtherLegacy extends Other {}',
        'export class AdtNoBaseLegacy {}',
        'export class Helper {}',
      ].join('\n');
      expect(findings(FILE, text)).toEqual([
        `${FILE}:5  AdtClassLegacy.constructor: a constructor that does more than call super`,
        `${FILE}:6  AdtClassLegacy.read: a member that is no override, getter or private helper`,
        `${FILE}:7  AdtClassLegacy.helper: a member that is no override, getter or private helper`,
        `${FILE}:9  class AdtProgramLegacy extends no class of ${ROOT_PACKAGE}`,
        `${FILE}:10  class AdtOtherLegacy extends no class of ${ROOT_PACKAGE}`,
        `${FILE}:11  class AdtNoBaseLegacy extends no class of ${ROOT_PACKAGE}`,
        `${FILE}:12  class Helper is not a *Legacy class`,
      ]);
    });

    it('flags a module that patches the root package', () => {
      const text = [
        "import { AdtClass, CLASS } from '@mcp-abap-adt/adt-clients';",
        "import * as root from '@mcp-abap-adt/adt-clients';",
        'AdtClass.prototype.read = async () => 1;',
        "Object.defineProperty(AdtClass.prototype, 'x', {});",
        'delete (CLASS as any).collection;',
        'root.CLASS.uri = () => "";',
        'Object.assign(AdtClass, {});',
        'const local = { a: 1 };',
        'local.a = 2;',
      ].join('\n');
      expect(findings(FILE, text)).toEqual([
        `${FILE}:3  patches AdtClass of ${ROOT_PACKAGE}`,
        `${FILE}:4  patches AdtClass of ${ROOT_PACKAGE}`,
        `${FILE}:5  patches CLASS of ${ROOT_PACKAGE}`,
        `${FILE}:6  patches root of ${ROOT_PACKAGE}`,
        `${FILE}:7  patches AdtClass of ${ROOT_PACKAGE}`,
      ]);
    });

    it('does not read comments', () => {
      const text = [
        '// export class Helper {}',
        '/** AdtClass.prototype.read = 1 */',
        'const x = 1;',
      ].join('\n');
      expect(findings(FILE, text)).toEqual([]);
    });
  });
});
