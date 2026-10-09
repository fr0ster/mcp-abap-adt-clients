/**
 * No object address outside src/endpoints/.
 *
 * Reads src/ with the TypeScript parser (decision 3: a checker reads code with
 * a parser, not with a pattern), skipping src/__tests__/ — a test states the
 * wire string it expects. Fails on any string or template literal that
 * CONTAINS a path a registry record declares: a literal that merely started
 * with one would miss the sixteen payloads embedding an address
 * (`adtcore:uri="/sap/bc/adt/…"`) and the error messages naming one.

 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ts from 'typescript';
import { RECORDS } from '../../../endpoints/objects';

const ENFORCED = Object.keys(RECORDS) as (keyof typeof RECORDS)[];

const ROOT = path.resolve(__dirname, '../../../..');

/** Every string-valued field of the named records. */
function declaredPaths(names: readonly (keyof typeof RECORDS)[]): string[] {
  const paths = new Set<string>();
  for (const name of names) {
    for (const value of Object.values(RECORDS[name])) {
      if (typeof value === 'string') paths.add(value);
    }
  }
  return [...paths];
}

/**
 * Whether `text` contains `p` as a whole path: it does unless the segment
 * carries on, so `/programs/programs` does not match `/programs/programrun`.
 */
function containsPath(text: string, p: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(p, from);
    if (at < 0) return false;
    // A match unless the path segment carries on — whatever else follows
    // (punctuation, a quote, a tag, a newline) ends it.
    if (!/[A-Za-z0-9_-]/.test(text.charAt(at + p.length))) return true;
    from = at + 1;
  }
}

/** Text of a literal; a template's substitutions become `${}`. */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return (
      node.head.text +
      node.templateSpans.map((s) => `\${}${s.literal.text}`).join('')
    );
  }
  return null;
}

/**
 * Every literal in a source text, nested ones included: a template's
 * substitutions are expressions and may hold literals of their own —
 * `${'/sap/bc/adt/programs/programs'}/${name}` must not slip through because
 * its outer template reads as `${}/${}`.
 */
function literalsIn(
  fileName: string,
  text: string,
): { line: number; text: string }[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const out: { line: number; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    const literal = literalText(node);
    if (literal !== null) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      out.push({ line: line + 1, text: literal });
      if (ts.isTemplateExpression(node)) {
        for (const span of node.templateSpans) visit(span.expression);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/**
 * The source files the check reads: every `.ts` under `<root>/src`, walked on
 * disk. Not `git ls-files`: a module created and not yet staged would pass the
 * check until someone ran `git add`.
 */
function sourceFiles(root: string = ROOT): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(root, rel), {
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

function violations(paths: string[]): string[] {
  const files = sourceFiles().filter(
    (f) => !f.startsWith('src/__tests__/') && !f.startsWith('src/endpoints/'),
  );
  const found: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const literal of literalsIn(file, text)) {
      const hit = paths.find((p) => containsPath(literal.text, p));
      if (hit) found.push(`${file}:${literal.line}  ${hit}`);
    }
  }
  return found;
}

describe('containsPath', () => {
  it('matches a whole path and what may follow it', () => {
    expect(
      containsPath(
        '/sap/bc/adt/programs/programs/zrep',
        '/sap/bc/adt/programs/programs',
      ),
    ).toBe(true);
    expect(
      containsPath(
        '/sap/bc/adt/programs/programs?x=1',
        '/sap/bc/adt/programs/programs',
      ),
    ).toBe(true);
    expect(
      containsPath(
        'uri="/sap/bc/adt/ddic/tables"/>',
        '/sap/bc/adt/ddic/tables',
      ),
    ).toBe(true);
    expect(
      containsPath(
        '/sap/bc/adt/programs/programs${}',
        '/sap/bc/adt/programs/programs',
      ),
    ).toBe(true);
  });
  it('matches whatever punctuation follows, not only a listed few', () => {
    const domains = '/sap/bc/adt/ddic/domains';
    expect(containsPath(`endpoint (${domains}).`, domains)).toBe(true);
    expect(containsPath(`${domains}, then`, domains)).toBe(true);
    expect(containsPath(`${domains};`, domains)).toBe(true);
    expect(containsPath(`${domains}&x`, domains)).toBe(true);
    expect(containsPath(`<a>${domains}</a>`, domains)).toBe(true);
    expect(containsPath(`${domains}\n`, domains)).toBe(true);
  });
  it('does not match a longer sibling segment', () => {
    expect(
      containsPath(
        '/sap/bc/adt/programs/programrun/zrep',
        '/sap/bc/adt/programs/programs',
      ),
    ).toBe(false);
    expect(
      containsPath('/sap/bc/adt/ddic/tablesettings', '/sap/bc/adt/ddic/tables'),
    ).toBe(false);
  });
});

describe('literalsIn', () => {
  it('reaches a literal inside a template substitution', () => {
    const texts = literalsIn(
      'x.ts',
      "const u = `${'/sap/bc/adt/programs/programs'}/${name}`;",
    ).map((l) => l.text);
    expect(texts).toContain('/sap/bc/adt/programs/programs');
  });
  it('reaches a literal nested two templates deep', () => {
    const texts = literalsIn(
      'x.ts',
      'const u = `a${`b${"/sap/bc/adt/ddic/tables"}`}`;',
    ).map((l) => l.text);
    expect(texts).toContain('/sap/bc/adt/ddic/tables');
  });
});

describe('every builder lands under a declared path', () => {
  // A function-valued field is invisible to declaredPaths(). Each one must build
  // an address under some string path the record family declares, or a literal
  // spelling that address elsewhere would pass the check unseen.
  const sample: Record<string, string[]> = {
    CLASS_INCLUDE: ['zcl_x', 'testclasses'],
    ENHANCEMENT: ['enhoxh', 'zenh'],
    SERVICE_BINDING: ['odatav2', 'zui_b'],
  };
  const all = declaredPaths(Object.keys(RECORDS) as (keyof typeof RECORDS)[]);
  for (const [name, record] of Object.entries(RECORDS)) {
    for (const [field, value] of Object.entries(record)) {
      if (typeof value !== 'function') continue;
      it(`${name}.${field}`, () => {
        const args = sample[name] ?? ['zz1', 'zz2'];
        const built = (value as (...a: string[]) => string)(...args);
        expect(all.some((p) => containsPath(built, p))).toBe(true);
      });
    }
  }
});

describe('object addresses come from src/endpoints/ only', () => {
  it('reads a file git does not track yet', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addr-gate-'));
    fs.mkdirSync(path.join(dir, 'src', 'core'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'fresh.ts'), '');
    fs.writeFileSync(path.join(dir, 'src', 'core', 'module.ts'), '');
    fs.writeFileSync(path.join(dir, 'src', 'core', 'notes.md'), '');
    try {
      expect(sourceFiles(dir).sort()).toEqual([
        'src/core/module.ts',
        'src/fresh.ts',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads the files directly under src/ too', () => {
    expect(sourceFiles()).toContain('src/index.ts');
  });

  it('no enforced path is written anywhere else in src/', () => {
    expect(violations(declaredPaths(ENFORCED))).toEqual([]);
  });
});
