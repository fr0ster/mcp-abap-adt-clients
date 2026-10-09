/**
 * Our packages declare the same range for every dependency they share, so the
 * installed tree holds one copy. For the contract packages it is critical: two
 * copies of `@mcp-abap-adt/interfaces-adt` are two types to TypeScript, and
 * test:check failed with TS2742 the one time the ranges drifted (^11 in the
 * strategies, ^12 here).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >;
const all = (p: Record<string, Record<string, string> | undefined>) => ({
  ...p.devDependencies,
  ...p.peerDependencies,
  ...p.dependencies,
});

describe('shared dependency ranges', () => {
  it('adt-clients and adt-strategies declare the same range for what they share', () => {
    const root = all(read('package.json'));
    const strategies = all(read('packages/adt-strategies/package.json'));
    const drift = Object.entries(strategies)
      .filter(([name]) => name in root && root[name] !== strategies[name])
      .map(
        ([name, range]) =>
          `${name}: strategies ${range}, adt-clients ${root[name]}`,
      );
    expect(drift).toEqual([]);
  });
});
