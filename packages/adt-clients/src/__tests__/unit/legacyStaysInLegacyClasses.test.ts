/**
 * No legacy branch outside the legacy classes (spec §2.2, §11.1).
 *
 * Every difference 7.40 needs lives in a legacy class — a `*Legacy` subclass
 * that overrides the members that differ, `absentOnLegacy` for a type 7.40
 * lacks, and the two legacy clients' getters that hand them out. A main
 * handler, a `src/core/shared/*` function the modern handlers call, the
 * connection and the header pairs stay as they are.
 *
 * So this reads `src` with the TypeScript parser (skipping `src/__tests__/`,
 * as `noHardcodedObjectAddresses.test.ts` does) and fails on three things
 * outside the places listed in {@link EXCEPTIONS}:
 *
 * - an identifier containing `legacy`, in any case — a main file that names a
 *   legacy class, imports one, or keeps a `legacy` flag is a branch;
 * - a module specifier containing `legacy`, in any case — of an import, an
 *   `export … from`, an `import x = require()`, an import type, a dynamic
 *   `import()` or a `require()`: a main file that loads a legacy
 *   module under a name of its own (`import * as v`, a side-effect import,
 *   `export *`) names no legacy identifier, and is a branch all the same;
 * - a string or template literal containing `/sap/bc/cts` — the legacy CTS
 *   endpoint, which only the legacy transport handler addresses.
 *
 * Comments are not code and are not read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');

/** The legacy CTS endpoint (below BASIS 7.50 it sits outside `/sap/bc/adt/`). */
const LEGACY_CTS = '/sap/bc/cts';

/** What a node is, as far as this check is concerned. */
type Hit = {
  kind: 'identifier' | 'literal' | 'module';
  node: ts.Node;
  text: string;
};

interface Exception {
  readonly reason: string;
  readonly allows: (file: string, hit: Hit) => boolean;
}

const baseName = (file: string) => file.slice(file.lastIndexOf('/') + 1);

/** Whether `node` sits inside a node `test` accepts. */
function within(node: ts.Node, test: (n: ts.Node) => boolean): boolean {
  for (let n: ts.Node | undefined = node; n; n = n.parent)
    if (test(n)) return true;
  return false;
}

/** The places a legacy name or the legacy endpoint belongs, each with why. */
const EXCEPTIONS: readonly Exception[] = [
  {
    reason:
      'A `*Legacy.ts` file is a legacy class or one of its helpers: every difference 7.40 needs lives there (`absentOnLegacy.ts` included).',
    allows: (file) => baseName(file).endsWith('Legacy.ts'),
  },
  {
    reason:
      'The factories choose the legacy client or executor by `isModernAdtSystem`, as before this change: that choice is the one place a main module names them.',
    allows: (file) =>
      file === 'src/clients/createAdtClient.ts' ||
      file === 'src/clients/createAdtExecutor.ts',
  },
  {
    reason:
      'A barrel re-exports the legacy classes so consumers reach them; a re-export (its names and the legacy module it names) is not a branch. An import, or any other use, in a barrel is.',
    allows: (file, hit) =>
      baseName(file).startsWith('index') &&
      (hit.kind === 'identifier' || hit.kind === 'module') &&
      within(hit.node, ts.isExportDeclaration),
  },
  {
    reason:
      '`src/endpoints/objects.ts` declares every address; the legacy CTS collection is the record `TRANSPORT_REQUEST_LEGACY`, kept apart from `TRANSPORT_REQUEST`, and `RECORDS` lists it.',
    allows: (file, hit) =>
      file === 'src/endpoints/objects.ts' &&
      (hit.kind === 'identifier'
        ? hit.text === 'TRANSPORT_REQUEST_LEGACY'
        : within(
            hit.node,
            (n) =>
              ts.isVariableDeclaration(n) &&
              ts.isIdentifier(n.name) &&
              n.name.text === 'TRANSPORT_REQUEST_LEGACY',
          )),
  },
  {
    reason:
      '`ICreateAndGenerateServiceBindingParamsLegacy` is a contract type of `@mcp-abap-adt/interfaces-adt`, re-exported under its own name: a name of the contract, not a branch here.',
    allows: (_file, hit) =>
      hit.kind === 'identifier' &&
      hit.text === 'ICreateAndGenerateServiceBindingParamsLegacy',
  },
];

/** Text of a literal; a template's substitutions become `${}`. */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isTemplateExpression(node))
    return (
      node.head.text +
      node.templateSpans.map((s) => `\${}${s.literal.text}`).join('')
    );
  return null;
}

/**
 * The module an import, an `export … from`, an `import x = require()`, an
 * import type (`typeof import()`, `import().T`), an `import()` or a
 * `require()` names.
 */
function moduleSpecifierOf(node: ts.Node): ts.StringLiteralLike | null {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  )
    return node.moduleSpecifier;
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    ts.isStringLiteralLike(node.moduleReference.expression)
  )
    return node.moduleReference.expression;
  if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteralLike(node.argument.literal)
  )
    return node.argument.literal;
  if (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
  ) {
    const [argument] = node.arguments;
    if (argument && ts.isStringLiteralLike(argument)) return argument;
  }
  return null;
}

/** Every legacy identifier, module and legacy-endpoint literal in a text. */
function hitsIn(file: string, text: string): Hit[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const hits: Hit[] = [];
  const visit = (node: ts.Node): void => {
    const specifier = moduleSpecifierOf(node);
    if (specifier?.text.toLowerCase().includes('legacy')) {
      hits.push({ kind: 'module', node: specifier, text: specifier.text });
    }
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      if (node.text.toLowerCase().includes('legacy'))
        hits.push({ kind: 'identifier', node, text: node.text });
    } else {
      const literal = literalText(node);
      if (literal?.includes(LEGACY_CTS))
        hits.push({ kind: 'literal', node, text: literal });
    }
    // A template's substitutions are expressions and may hold literals and
    // identifiers of their own.
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

/** `file:line  kind text` for every hit no exception allows. */
function findings(file: string, text: string): string[] {
  return hitsIn(file, text)
    .filter((hit) => !EXCEPTIONS.some((e) => e.allows(file, hit)))
    .map((hit) => {
      const source = hit.node.getSourceFile();
      const { line } = source.getLineAndCharacterOfPosition(
        hit.node.getStart(),
      );
      return `${file}:${line + 1}  ${hit.kind} ${hit.text}`;
    });
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

/**
 * The shared test harness: every file under `src/__tests__/helpers/` but the
 * legacy helpers (`legacy*`), which hold what the legacy classes bring to the
 * harness through its seams (`legacyRegistrations.ts`).
 */
function harnessFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(ROOT, rel), {
      withFileTypes: true,
    })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (
        /\.[cm]?[tj]s$/.test(entry.name) &&
        !entry.name.toLowerCase().startsWith('legacy')
      )
        out.push(next);
    }
  };
  walk('src/__tests__/helpers');
  return out;
}

/** `file:line  module …` for every legacy module a harness file loads. */
function harnessFindings(file: string, text: string): string[] {
  return findings(file, text).filter((finding) =>
    finding.includes('  module '),
  );
}

describe('legacy stays in legacy classes', () => {
  it('no shared harness file loads a legacy module', () => {
    const files = harnessFiles();
    expect(files).toContain('src/__tests__/helpers/adtHeaders.ts');
    expect(files).toContain('src/__tests__/helpers/sessionConfig.ts');
    expect(files).not.toContain('src/__tests__/helpers/legacyRegistrations.ts');
    const found = files.flatMap((file) =>
      harnessFindings(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
    );
    expect(found).toEqual([]);
  });

  it('flags a harness file that loads a legacy module, however it loads it', () => {
    const harness = 'src/__tests__/helpers/sessionConfig.ts';
    const text = [
      "import { AdtClientLegacy } from '../../clients/AdtClientLegacy';",
      "const r = require('./legacyRegistrations');",
      "import './legacyRegistrations';",
      'const isLegacy = true;',
    ].join('\n');
    expect(harnessFindings(harness, text)).toEqual([
      `${harness}:1  module ../../clients/AdtClientLegacy`,
      `${harness}:2  module ./legacyRegistrations`,
      `${harness}:3  module ./legacyRegistrations`,
    ]);
  });

  it('no main file names a legacy class or addresses /sap/bc/cts', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap((file) =>
      findings(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
    );
    expect(found).toEqual([]);
  });

  it('every exception carries its reason', () => {
    for (const exception of EXCEPTIONS)
      expect(exception.reason.length).toBeGreaterThan(40);
  });

  describe('the check itself', () => {
    const MAIN = 'src/core/class/AdtClass.ts';

    it('flags a legacy import, a legacy flag and a legacy call in a main file', () => {
      const text = [
        "import { AdtClassLegacy } from './AdtClassLegacy';",
        'const isLegacy = true;',
        'const LEGACY_MODE = 1;',
        'new AdtClassLegacy();',
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  module ./AdtClassLegacy`,
        `${MAIN}:1  identifier AdtClassLegacy`,
        `${MAIN}:2  identifier isLegacy`,
        `${MAIN}:3  identifier LEGACY_MODE`,
        `${MAIN}:4  identifier AdtClassLegacy`,
      ]);
    });

    it('flags a legacy module specifier however the import names nothing legacy', () => {
      const text = [
        "import './AdtClassLegacy';",
        "import * as variant from './AdtClassLegacy';",
        "import plain from '../shared/refusalLegacy';",
        "export * from './AdtClassLegacy';",
        "export { a as b } from '../shared/deleteLegacy';",
        "const lazy = () => import('./AdtClassLegacy');",
        "import { AdtClass } from './AdtClass';",
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  module ./AdtClassLegacy`,
        `${MAIN}:2  module ./AdtClassLegacy`,
        `${MAIN}:3  module ../shared/refusalLegacy`,
        `${MAIN}:4  module ./AdtClassLegacy`,
        `${MAIN}:5  module ../shared/deleteLegacy`,
        `${MAIN}:6  module ./AdtClassLegacy`,
      ]);
    });

    it('flags a legacy module loaded by require, import = require or an import type', () => {
      const text = [
        "import variant = require('./AdtClassLegacy');",
        "const loaded = require('../shared/refusalLegacy');",
        "type Variant = typeof import('./AdtClassLegacy');",
        "let shape: import('../shared/deleteLegacy').Shape;",
        "const plain = require('./AdtClass');",
        "other('./AdtClassLegacy');",
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  module ./AdtClassLegacy`,
        `${MAIN}:2  module ../shared/refusalLegacy`,
        `${MAIN}:3  module ./AdtClassLegacy`,
        `${MAIN}:4  module ../shared/deleteLegacy`,
      ]);
    });

    it('lets a barrel re-export from a legacy module, but not import from one', () => {
      const barrel = 'src/executors/index.ts';
      const text = [
        "export * from './abapUnitRunLegacy';",
        "export { x } from './abapUnitRunLegacy';",
        "import './abapUnitRunLegacy';",
      ].join('\n');
      expect(findings(barrel, text)).toEqual([
        `${barrel}:3  module ./abapUnitRunLegacy`,
      ]);
    });

    it('flags the legacy endpoint in a string, a template and a substitution', () => {
      const text = [
        "const a = '/sap/bc/cts/transportrequests';",
        // Template literals, so the samples' placeholders stay text.
        `const b = \`\${base}/sap/bc/cts/x\`;`,
        `const c = \`\${'/sap/bc/cts'}/\${name}\`;`,
        "const d = '/sap/bc/adt/cts/transportrequests';",
      ].join('\n');
      expect(findings(MAIN, text).map((f) => f.split('  ')[0])).toEqual([
        `${MAIN}:1`,
        `${MAIN}:2`,
        `${MAIN}:3`,
      ]);
    });

    it('does not read comments', () => {
      const text = [
        '// AdtClassLegacy uses /sap/bc/cts',
        '/** a legacy system */',
        'const x = 1;',
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([]);
    });

    it('lets a barrel re-export a legacy class, and nothing else', () => {
      const barrel = 'src/core/class/index.ts';
      const text = [
        "export { AdtClassLegacy } from './AdtClassLegacy';",
        "import { AdtClassLegacy as L } from './AdtClassLegacy';",
      ].join('\n');
      expect(findings(barrel, text)).toEqual([
        `${barrel}:2  module ./AdtClassLegacy`,
        `${barrel}:2  identifier AdtClassLegacy`,
      ]);
    });

    it('lets objects.ts declare the legacy record, and no other address on /sap/bc/cts', () => {
      const objects = 'src/endpoints/objects.ts';
      const text = [
        "export const TRANSPORT_REQUEST_LEGACY = { collection: '/sap/bc/cts/transportrequests' };",
        "export const OTHER = { collection: '/sap/bc/cts/other' };",
        'export const RECORDS = { TRANSPORT_REQUEST_LEGACY };',
        'export const OTHER_LEGACY = 1;',
      ].join('\n');
      expect(findings(objects, text)).toEqual([
        `${objects}:2  literal /sap/bc/cts/other`,
        `${objects}:4  identifier OTHER_LEGACY`,
      ]);
    });

    it('lets a legacy file and the factories name the legacy classes', () => {
      const text = "import { AdtClientLegacy } from './AdtClientLegacy';";
      expect(findings('src/core/class/AdtClassLegacy.ts', text)).toEqual([]);
      expect(findings('src/clients/absentOnLegacy.ts', text)).toEqual([]);
      expect(findings('src/clients/createAdtClient.ts', text)).toEqual([]);
      expect(findings('src/clients/createAdtExecutor.ts', text)).toEqual([]);
      expect(findings('src/clients/AdtClient.ts', text)).toEqual([
        'src/clients/AdtClient.ts:1  module ./AdtClientLegacy',
        'src/clients/AdtClient.ts:1  identifier AdtClientLegacy',
      ]);
    });
  });
});
