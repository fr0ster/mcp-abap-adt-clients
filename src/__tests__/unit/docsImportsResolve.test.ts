/**
 * Every `import … from '@mcp-abap-adt/adt-clients'` in the docs must resolve.
 *
 * This exists because the manual version of it failed three times. The last
 * failure is the instructive one: the check was run BEFORE a batch of exports
 * was removed, passed, and the result was reported afterwards as though it
 * still held. A snapshot of a moving surface is not a check. This one runs on
 * every suite, so it cannot go stale.
 *
 * CHANGELOG.md is deliberately excluded. A changelog documents what an API
 * *used to* look like — a migration note showing the old import is correct
 * precisely because it no longer resolves. Every other document describes the
 * current API and is held to it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as ts from 'typescript';

const REPO_ROOT = resolve(__dirname, '../../..');
const PACKAGE_NAME = '@mcp-abap-adt/adt-clients';

/** Names the package entry point actually exports, values and types alike. */
function publicExports(): Set<string> {
  const entry = resolve(REPO_ROOT, 'src/index.ts');
  const program = ts.createProgram([entry], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  if (!source) throw new Error('src/index.ts did not load');
  const symbol = checker.getSymbolAtLocation(source);
  if (!symbol) throw new Error('src/index.ts exported no module symbol');
  return new Set(checker.getExportsOfModule(symbol).map((s) => s.getName()));
}

function markdownFiles(): string[] {
  const found: string[] = [resolve(REPO_ROOT, 'README.md')];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.md')) {
        found.push(full);
      }
    }
  };
  walk(resolve(REPO_ROOT, 'docs'));
  return found;
}

/** Imported names, per file, for imports that name this package. */
function importedNames(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const pattern = new RegExp(
    `import\\s*(?:type\\s*)?\\{([^}]+)\\}\\s*from\\s*'${PACKAGE_NAME}'`,
    'g',
  );
  const names: string[] = [];
  for (const match of text.matchAll(pattern)) {
    for (const raw of match[1].split(',')) {
      // `X as Y` imports X; the local alias is the consumer's business.
      const name = raw.trim().split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

describe('documented imports resolve against the real public surface', () => {
  const exported = publicExports();
  const files = markdownFiles();

  it('finds documentation to check', () => {
    // Guards against the check silently passing because it looked nowhere.
    expect(files.length).toBeGreaterThan(0);
    expect(exported.size).toBeGreaterThan(0);
  });

  it.each(
    files.map((f) => [f.replace(`${REPO_ROOT}/`, ''), f]),
  )('%s imports only names the package exports', (_label, file) => {
    const unresolved = importedNames(file).filter((n) => !exported.has(n));

    expect(unresolved).toEqual([]);
  });
});
