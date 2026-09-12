import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The rule that is easiest to miss and most expensive to miss.
 *
 * `update` replaces; it never merges. That was true of every type before
 * 19.0.0 too — ADT's `PUT` overwrites — but six types hid it by reading the
 * current document and patching the caller's fields into it. When that read
 * left, the rule became something a caller has to know, and nothing in a
 * signature says it.
 *
 * Our own integration harness missed it on all six and wrote empty bodies. A
 * consumer reading only the type they need is likelier to miss it than we were,
 * so the sentence is on every update, and this fails if one loses it.
 */
const CORE = join(__dirname, '../../../core');
const RULE = 'The whole content, every time';

const modules = readdirSync(CORE, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe('update states that it replaces', () => {
  const lowLevel = modules.filter((name) => {
    try {
      return /\nexport async function update\w*\(/.test(
        readFileSync(join(CORE, name, 'update.ts'), 'utf-8'),
      );
    } catch {
      return false;
    }
  });

  it('finds an update function to check', () => {
    expect(lowLevel.length).toBeGreaterThan(20);
  });

  it.each(lowLevel)('%s/update.ts says so', (name) => {
    expect(readFileSync(join(CORE, name, 'update.ts'), 'utf-8')).toContain(
      RULE,
    );
  });

  const handlers = modules.flatMap((name) => {
    let files: string[];
    try {
      files = readdirSync(join(CORE, name));
    } catch {
      return [];
    }
    return files
      .filter((file) => file.startsWith('Adt') && file.endsWith('.ts'))
      .map((file) => [name, file] as const)
      .filter(([, file]) =>
        /\n {2}async (?:update|updateMetadata)</.test(
          readFileSync(join(CORE, name, file), 'utf-8'),
        ),
      );
  });

  it('finds the public members to check', () => {
    expect(handlers.length).toBeGreaterThan(20);
  });

  it.each(handlers)('%s/%s says so on its member', (name, file) => {
    expect(readFileSync(join(CORE, name, file), 'utf-8')).toContain(RULE);
  });
});
