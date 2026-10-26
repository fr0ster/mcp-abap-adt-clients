/**
 * The root package carries no legacy (spec §1, "The AST rule becomes two
 * rules").
 *
 * The classes for SAP_BASIS below 7.50 — the `*Legacy` subclasses, their
 * helpers, their tests and their test environment — live in
 * `@mcp-abap-adt/adt-clients-legacy` (`packages/adt-clients-legacy`), which
 * builds on this package. Nothing here names them, loads them, or addresses
 * the endpoint only they address, and nothing here chooses them: the system
 * type is the consumer's to declare.
 *
 * So this reads every source file under `src` — the library and its tests,
 * the harness's JavaScript included — with the TypeScript parser and fails,
 * with no exception, on:
 *
 * - an identifier containing the word, in any case — a file that names a
 *   legacy class, imports one, or keeps a flag for one;
 * - a module specifier containing it, in any case — of an import, an
 *   `export … from`, an `import x = require()`, an import type, a dynamic
 *   `import()` or a `require()`: a file that loads such a module under a
 *   name of its own names no such identifier, and loads it all the same;
 * - a string or template literal containing it, in any case — a test name, a
 *   configuration key, a class name compared at runtime;
 * - a string or template literal containing the 7.40 CTS endpoint, which only
 *   the legacy transport handler addresses.
 *
 * Comments are not code and are not read: the removal notes stay.
 *
 * The other tracked files under `src` — the configuration base and forms
 * (`.yaml`, `.template`), the XML fixtures, anything that is neither code nor
 * a Markdown note — are read as plain text, every line, for the word and the
 * endpoint: a configuration key or a fixture has no comment to hide in that
 * matters. Only tracked files are read, so a developer's gitignored overlay is
 * never opened.
 *
 * This file
 * holds to its own rule, so the word it looks for is put together at run
 * time.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');

/** The word, in lower case. */
const WORD = ['leg', 'acy'].join('');
/** The word as a class name carries it. */
const SUFFIX = `${WORD.slice(0, 1).toUpperCase()}${WORD.slice(1)}`;
/** The 7.40 CTS endpoint (below BASIS 7.50 it sits outside `/sap/bc/adt/`). */
const CTS = ['/sap/bc', 'cts'].join('/');

/** What a node is, as far as this check is concerned. */
type Hit = {
  kind: 'identifier' | 'literal' | 'module';
  node: ts.Node;
  text: string;
};

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

/** Every hit in a text: the word, or the endpoint. */
function hitsIn(file: string, text: string): Hit[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  const hits: Hit[] = [];
  /** A module specifier is a module hit, never also a literal one. */
  const specifiers = new Set<ts.Node>();
  const visit = (node: ts.Node): void => {
    const specifier = moduleSpecifierOf(node);
    if (specifier) {
      specifiers.add(specifier);
      if (specifier.text.toLowerCase().includes(WORD))
        hits.push({ kind: 'module', node: specifier, text: specifier.text });
    }
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      if (node.text.toLowerCase().includes(WORD))
        hits.push({ kind: 'identifier', node, text: node.text });
    } else if (!specifiers.has(node)) {
      const literal = literalText(node);
      if (
        literal !== null &&
        (literal.toLowerCase().includes(WORD) || literal.includes(CTS))
      )
        hits.push({ kind: 'literal', node, text: literal });
    }
    // A template's substitutions are expressions and may hold literals and
    // identifiers of their own.
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

/** `file:line  kind text` for every hit. */
function findings(file: string, text: string): string[] {
  return hitsIn(file, text).map((hit) => {
    const source = hit.node.getSourceFile();
    const { line } = source.getLineAndCharacterOfPosition(hit.node.getStart());
    return `${file}:${line + 1}  ${hit.kind} ${hit.text}`;
  });
}

/** Every source file under `src`, tests included, walked on disk. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(ROOT, rel), {
      withFileTypes: true,
    })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (
        /\.[cm]?[tj]s$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts')
      )
        out.push(next);
    }
  };
  walk('src');
  return out;
}

/** `file:line  text` for every line of a plain-text file holding either. */
function textFindings(file: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      line.toLowerCase().includes(WORD) || line.includes(CTS)
        ? [`${file}:${index + 1}  text ${line.trim()}`]
        : [],
    );
}

/** The tracked files under `src` that are neither code nor a Markdown note. */
function textFiles(): string[] {
  return execSync('git ls-files src', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(
      (file) =>
        file !== '' &&
        !/\.[cm]?[tj]s$/.test(file) &&
        !file.endsWith('.md') &&
        fs.existsSync(path.join(ROOT, file)),
    );
}

describe('the root package carries no 7.40 classes', () => {
  it('no configuration or fixture file under src carries the word or the 7.40 CTS endpoint', () => {
    const files = textFiles();
    expect(files).toContain('src/__tests__/helpers/test-config.yaml.template');
    expect(files).toContain('src/__tests__/helpers/overlays/onprem.yaml');
    expect(files.some((file) => file.endsWith('.xml'))).toBe(true);
    const found = files.flatMap((file) =>
      textFindings(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
    );
    expect(found).toEqual([]);
  });

  it('reads such a file as text, comments included', () => {
    const file = 'src/__tests__/helpers/overlays/onprem.yaml';
    expect(
      textFindings(
        file,
        [
          `# "environment.is_${WORD}": true`,
          `${WORD}_env:`,
          `  available_in: ["onprem", "${WORD}"]`,
          `<a href="${CTS}/x"/>`,
          '  available_in: ["onprem"]',
        ].join('\n'),
      ).map((line) => line.split('  ')[0]),
    ).toEqual([`${file}:1`, `${file}:2`, `${file}:3`, `${file}:4`]);
  });

  it('no source file names one, loads one, or addresses the 7.40 CTS endpoint', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain('src/__tests__/helpers/test-helper.js');
    expect(files).toContain('src/__tests__/helpers/sessionConfig.ts');
    const found = files.flatMap((file) =>
      findings(file, fs.readFileSync(path.join(ROOT, file), 'utf8')),
    );
    expect(found).toEqual([]);
  });

  describe('the check itself', () => {
    const MAIN = 'src/core/class/AdtClass.ts';
    const L = SUFFIX;
    const UPPER = WORD.toUpperCase();

    it('flags an import, a flag and a call in a library file', () => {
      const text = [
        `import { AdtClass${L} } from './AdtClass${L}';`,
        `const is${L} = true;`,
        `const ${UPPER}_MODE = 1;`,
        `new AdtClass${L}();`,
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  module ./AdtClass${L}`,
        `${MAIN}:1  identifier AdtClass${L}`,
        `${MAIN}:2  identifier is${L}`,
        `${MAIN}:3  identifier ${UPPER}_MODE`,
        `${MAIN}:4  identifier AdtClass${L}`,
      ]);
    });

    it('flags a module specifier however the import names nothing', () => {
      const text = [
        `import './AdtClass${L}';`,
        `import * as variant from './AdtClass${L}';`,
        `import plain from '../shared/refusal${L}';`,
        `export * from './AdtClass${L}';`,
        `export { a as b } from '../shared/delete${L}';`,
        `const lazy = () => import('./AdtClass${L}');`,
        "import { AdtClass } from './AdtClass';",
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  module ./AdtClass${L}`,
        `${MAIN}:2  module ./AdtClass${L}`,
        `${MAIN}:3  module ../shared/refusal${L}`,
        `${MAIN}:4  module ./AdtClass${L}`,
        `${MAIN}:5  module ../shared/delete${L}`,
        `${MAIN}:6  module ./AdtClass${L}`,
      ]);
    });

    it('flags a module loaded by require, import = require or an import type', () => {
      const text = [
        `import variant = require('./AdtClass${L}');`,
        `const loaded = require('../shared/refusal${L}');`,
        `type Variant = typeof import('./AdtClass${L}');`,
        `let shape: import('../shared/delete${L}').Shape;`,
        "const plain = require('./AdtClass');",
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  module ./AdtClass${L}`,
        `${MAIN}:2  module ../shared/refusal${L}`,
        `${MAIN}:3  module ./AdtClass${L}`,
        `${MAIN}:4  module ../shared/delete${L}`,
      ]);
    });

    it('flags the word in a string, a template and a test name, in a JavaScript file too', () => {
      const text = [
        `const a = 'is_${WORD}';`,
        `it('a ${WORD} system', () => {});`,
        `const b = \`\${base}.${L}\`;`,
        "const c = 'modern';",
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([
        `${MAIN}:1  literal is_${WORD}`,
        `${MAIN}:2  literal a ${WORD} system`,
        `${MAIN}:3  literal \${}.${L}`,
      ]);
      const js = 'src/__tests__/helpers/test-helper.js';
      expect(findings(js, `const k = config.environment.is_${WORD};`)).toEqual([
        `${js}:1  identifier is_${WORD}`,
      ]);
    });

    it('flags the 7.40 CTS endpoint in a string, a template and a substitution', () => {
      const text = [
        `const a = '${CTS}/transportrequests';`,
        `const b = \`\${base}${CTS}/x\`;`,
        `const c = \`\${'${CTS}'}/\${name}\`;`,
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
        `// AdtClass${L} uses ${CTS}`,
        `/** a ${WORD} system */`,
        'const x = 1;',
      ].join('\n');
      expect(findings(MAIN, text)).toEqual([]);
    });

    it('allows nothing anywhere: a barrel, a factory, a test, the harness', () => {
      const text = `export { AdtClient${L} } from './AdtClient${L}';`;
      for (const file of [
        'src/index.core.ts',
        'src/clients/createAdtClient.ts',
        'src/__tests__/unit/capabilities/behaviour.test.ts',
        'src/__tests__/helpers/sessionConfig.ts',
      ])
        expect(findings(file, text)).toEqual([
          `${file}:1  module ./AdtClient${L}`,
          `${file}:1  identifier AdtClient${L}`,
        ]);
    });
  });
});
