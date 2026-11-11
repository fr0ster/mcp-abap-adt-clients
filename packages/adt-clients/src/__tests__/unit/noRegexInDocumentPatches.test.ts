/**
 * No regular expression in the code that patches SAP's documents.
 *
 * The patches replaced a test helper that matched the first occurrence of a
 * pattern anywhere in the text; that is how an update wrote a package
 * reference's description instead of the object's own. They locate by the
 * document's structure (`src/utils/documentEdit.ts`) in plain string code.
 * Read with the TypeScript parser, as `noHardcodedObjectAddresses` reads
 * addresses: a regex literal or a `RegExp` call is refused.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');

/** Where each regex sits in `text`, as `line: what`. */
function regexesIn(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const at = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      found.push(`${at(node)}: ${node.getText()}`);
    }
    if (
      (ts.isNewExpression(node) || ts.isCallExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'RegExp'
    ) {
      found.push(`${at(node)}: RegExp(…)`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The scanner, the shared patch rules, and every type's `patch.ts`. */
function patchSources(): string[] {
  const core = path.join(ROOT, 'src/core');
  const patches = fs
    .readdirSync(core, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `src/core/${entry.name}/patch.ts`)
    .filter((file) => fs.existsSync(path.join(ROOT, file)));
  return [
    'src/utils/documentEdit.ts',
    'src/core/shared/documentPatch.ts',
    ...patches,
  ].filter((file) => fs.existsSync(path.join(ROOT, file)));
}

describe('regexesIn', () => {
  it('refuses a regex literal', () => {
    expect(regexesIn('x.ts', "const y = 'a'.replace(/a/g, 'b');")).toHaveLength(
      1,
    );
  });

  it('refuses `new RegExp` and a bare `RegExp` call', () => {
    expect(regexesIn('x.ts', "const r = new RegExp('a');")).toHaveLength(1);
    expect(regexesIn('x.ts', "const r = RegExp('a');")).toHaveLength(1);
  });

  it('lets plain string code through', () => {
    expect(regexesIn('x.ts', "const y = 'a/b'.split('/').join('|');")).toEqual(
      [],
    );
  });
});

describe('the document patches', () => {
  const files = patchSources();

  it('include the scanner', () => {
    expect(files).toContain('src/utils/documentEdit.ts');
  });

  it.each(files)('%s holds no regular expression', (file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(regexesIn(file, text)).toEqual([]);
  });
});
