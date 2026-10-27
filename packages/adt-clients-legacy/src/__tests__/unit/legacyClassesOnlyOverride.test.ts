/**
 * A legacy class is the root class with what 7.40 needs changed, and nothing
 * else (spec §1, "The AST rule becomes two rules" — they hold for test
 * sources too).
 *
 * Every difference 7.40 needs lives in a `*Legacy` subclass of a class
 * `@mcp-abap-adt/adt-clients` exports, and the root package is not touched
 * from here. So this reads every source file of this package's `src`, its
 * tests included, with the TypeScript parser and fails on:
 *
 * - in production code (`src/__tests__/` left out), a class whose name does
 *   not end in `Legacy` — it would escape the rules below;
 * - anywhere, a `*Legacy` class that does not `extends` a class imported (as
 *   a value) from the root package, or that has a member which is not an
 *   override (`override`), a getter, a private helper (`private` or `#name`),
 *   or a constructor that only hands the base its arguments (one `super(…)`
 *   call). The one allowance is named in {@link FORGERIES}: a test class that
 *   borrows a legacy class's name on purpose;
 * - anywhere, a module that patches the root package: an assignment to, or a
 *   `delete` of, anything reached from a root binding or from a `const`
 *   alias of one (`const p = AdtClass.prototype; p.x = …`); an
 *   `Object.defineProperty` / `defineProperties` / `assign` /
 *   `setPrototypeOf`, a `Reflect.set` / `defineProperty` / `deleteProperty`
 *   / `setPrototypeOf` or a `jest.spyOn` on one; or a `declare module` of the
 *   root package (an augmentation that makes the root's surface say what it
 *   does not have).
 *
 * A root binding is a value imported from `@mcp-abap-adt/adt-clients` — by
 * `import`, `import x = require()` or `require()` — or, in a test, from the
 * root package's source by relative path (`…/adt-clients/src/…`).
 *
 * Comments are not code and are not read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');
const ROOT_PACKAGE = '@mcp-abap-adt/adt-clients';
/** Calls whose first argument they change, by the object they are called on. */
const PATCHING_CALLS: Readonly<Record<string, ReadonlySet<string>>> = {
  Object: new Set([
    'defineProperty',
    'defineProperties',
    'assign',
    'setPrototypeOf',
  ]),
  Reflect: new Set([
    'set',
    'defineProperty',
    'deleteProperty',
    'setPrototypeOf',
  ]),
  jest: new Set(['spyOn', 'replaceProperty']),
};

/**
 * Test classes that borrow a legacy class's name on purpose, each with why;
 * an entry that matches no class fails.
 */
const FORGERIES: readonly { file: string; className: string; why: string }[] = [
  {
    file: 'src/__tests__/unit/helpers/legacyIntegrationHeadersOf.test.ts',
    className: 'AdtPackageLegacy',
    why: 'proves that a class merely named like a registered legacy refusal is not taken for one by integrationHeadersOf',
  },
];

/** Whether a module specifier names the root package. */
function isRootSpecifier(specifier: string): boolean {
  return (
    specifier === ROOT_PACKAGE ||
    (specifier.startsWith('.') && specifier.includes('/adt-clients/src/'))
  );
}

/** A `require('…')` of the root package. */
function isRootRequire(node: ts.Node | undefined): boolean {
  return (
    node !== undefined &&
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    node.arguments[0] !== undefined &&
    ts.isStringLiteralLike(node.arguments[0]) &&
    isRootSpecifier(node.arguments[0].text)
  );
}

/** The local names bound by a binding name (`x`, `{ a, b: c }`). */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : boundNames(element.name),
  );
}

/** The local names a file binds as values from the root package. */
function rootBindings(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isRootSpecifier(node.moduleSpecifier.text)
    ) {
      const clause = node.importClause;
      if (clause && !clause.isTypeOnly) {
        if (clause.name) names.add(clause.name.text);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings))
          names.add(bindings.name.text);
        if (bindings && ts.isNamedImports(bindings))
          for (const element of bindings.elements)
            if (!element.isTypeOnly) names.add(element.name.text);
      }
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression) &&
      isRootSpecifier(node.moduleReference.expression.text)
    )
      names.add(node.name.text);
    if (ts.isVariableDeclaration(node) && isRootRequire(node.initializer))
      for (const name of boundNames(node.name)) names.add(name);
    ts.forEachChild(node, visit);
  };
  visit(source);
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
    const [only, ...more] = member.body?.statements ?? [];
    const onlySuper =
      more.length === 0 &&
      only !== undefined &&
      ts.isExpressionStatement(only) &&
      ts.isCallExpression(only.expression) &&
      only.expression.expression.kind === ts.SyntaxKind.SuperKeyword;
    return onlySuper ? null : 'a constructor that does more than call super';
  }
  if (ts.isSemicolonClassElement(member)) return null;
  if (ts.isGetAccessorDeclaration(member)) return null;
  if (hasModifier(member, ts.SyntaxKind.OverrideKeyword)) return null;
  if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) return null;
  if (member.name && ts.isPrivateIdentifier(member.name)) return null;
  return 'a member that is no override, getter or private helper';
}

const isTestFile = (file: string): boolean => file.startsWith('src/__tests__/');

/** `file:line  what` for every breach of the rules in a text. */
function findings(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const roots = rootBindings(source);
  const found: string[] = [];
  const at = (node: ts.Node, what: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${file}:${line + 1}  ${what}`);
  };
  /** A root binding, or a `const` alias of something reached from one. */
  const tainted = (name: string | undefined): name is string =>
    name !== undefined && roots.has(name);
  const patches = (node: ts.Node, target: ts.Expression | undefined) => {
    const name = target ? rootOf(target) : undefined;
    if (tainted(name)) at(node, `patches ${name} of ${ROOT_PACKAGE}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.text ?? '(anonymous)';
      const forged = FORGERIES.some(
        (forgery) => forgery.file === file && forgery.className === name,
      );
      if (!name.endsWith('Legacy')) {
        if (!isTestFile(file)) at(node, `class ${name} is not a *Legacy class`);
      } else if (!forged) {
        const base = node.heritageClauses?.find(
          (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
        )?.types[0]?.expression;
        if (!base || !ts.isIdentifier(base) || !roots.has(base.text))
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
    // `const p = AdtClass.prototype`: `p` is the root's from here on.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      tainted(rootOf(node.initializer)) &&
      !isRootRequire(node.initializer)
    )
      roots.add(node.name.text);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      patches(node, node.left);
    if (ts.isDeleteExpression(node)) patches(node, node.expression);
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      PATCHING_CALLS[node.expression.expression.text]?.has(
        node.expression.name.text,
      )
    )
      patches(node, node.arguments[0]);
    if (
      ts.isModuleDeclaration(node) &&
      ts.isStringLiteral(node.name) &&
      isRootSpecifier(node.name.text)
    )
      at(node, `augments ${ROOT_PACKAGE}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Every `.ts` under `src`, tests included, walked on disk. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(ROOT, rel), {
      withFileTypes: true,
    })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith('.ts')) out.push(next);
    }
  };
  walk('src');
  return out;
}

/** The `*Legacy` classes a text declares, by name. */
function legacyClassesIn(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isClassDeclaration(node) || ts.isClassExpression(node)) &&
      node.name?.text.endsWith('Legacy')
    )
      names.push(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

describe('a legacy class is the root class with overrides', () => {
  it('every *Legacy class is a root subclass with overrides, getters and private helpers only, and nothing patches the root, tests included', () => {
    const files = sourceFiles();
    expect(files).toContain('src/clients/AdtClientLegacy.ts');
    expect(files).toContain('src/__tests__/helpers/legacyRegistrations.ts');
    expect(files.length).toBeGreaterThan(60);
    const found = files.flatMap((file) =>
      findings(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
    );
    expect(found).toEqual([]);
  });

  it('names each forgery it allows, and each is there', () => {
    for (const forgery of FORGERIES) {
      expect(forgery.why.length).toBeGreaterThan(40);
      const text = fs.readFileSync(path.join(ROOT, forgery.file), 'utf8');
      expect(legacyClassesIn(forgery.file, text)).toContain(forgery.className);
    }
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

    it('flags an alias, Reflect, jest.spyOn, a require binding and an augmentation', () => {
      const text = [
        "import { AdtClass, CLASS } from '@mcp-abap-adt/adt-clients';",
        "const required = require('@mcp-abap-adt/adt-clients');",
        "import eq = require('@mcp-abap-adt/adt-clients');",
        'const proto = AdtClass.prototype;',
        'proto.read = async () => 1;',
        "Reflect.set(AdtClass.prototype, 'read', 1);",
        "Reflect.defineProperty(CLASS, 'uri', {});",
        "jest.spyOn(AdtClass.prototype, 'read');",
        'required.AdtClass.prototype.read = 1;',
        'eq.CLASS.collection = "";',
        "declare module '@mcp-abap-adt/adt-clients' {",
        '  interface AdtClass { extra(): void }',
        '}',
        "Reflect.get(AdtClass, 'x');",
        'const copy = { ...CLASS };',
        'copy.collection = "";',
      ].join('\n');
      expect(findings(FILE, text)).toEqual([
        `${FILE}:5  patches proto of ${ROOT_PACKAGE}`,
        `${FILE}:6  patches AdtClass of ${ROOT_PACKAGE}`,
        `${FILE}:7  patches CLASS of ${ROOT_PACKAGE}`,
        `${FILE}:8  patches AdtClass of ${ROOT_PACKAGE}`,
        `${FILE}:9  patches required of ${ROOT_PACKAGE}`,
        `${FILE}:10  patches eq of ${ROOT_PACKAGE}`,
        `${FILE}:11  augments ${ROOT_PACKAGE}`,
      ]);
    });

    it('holds a test file to the shape of a *Legacy class and to no patching, and allows only the named forgery', () => {
      const TEST =
        'src/__tests__/unit/helpers/legacyIntegrationHeadersOf.test.ts';
      const OTHER = 'src/__tests__/unit/other.test.ts';
      const text = [
        "import { LockRegistry } from '../../../../../adt-clients/src/core/shared/LockRegistry';",
        'class Recorder { record() {} }',
        'class AdtPackageLegacy { async create() {} }',
        'LockRegistry.prototype.track = () => {};',
      ].join('\n');
      expect(findings(TEST, text)).toEqual([
        `${TEST}:4  patches LockRegistry of ${ROOT_PACKAGE}`,
      ]);
      expect(findings(OTHER, text)).toEqual([
        `${OTHER}:3  class AdtPackageLegacy extends no class of ${ROOT_PACKAGE}`,
        `${OTHER}:3  AdtPackageLegacy.create: a member that is no override, getter or private helper`,
        `${OTHER}:4  patches LockRegistry of ${ROOT_PACKAGE}`,
      ]);
    });
  });
});
