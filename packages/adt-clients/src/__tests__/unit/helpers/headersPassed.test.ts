import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  callsWithoutHeaders as callsWithoutHeadersIn,
  filesUnder,
  type IHeadersScan,
} from './headersPassedScan';

/**
 * Every call of a member that takes `options.headers` (MIGRATION-36.md), in a
 * file whose tests reach SAP, passes `headers` itself.
 *
 * The compiler already refuses a typed call without them, but not a call it
 * cannot type: a JavaScript helper (`test-helper.js`), a receiver typed `any`,
 * or a test's own structural type with `options?: any`. Such a call reaches
 * the member with no pair, and it throws before the request leaves. So this
 * reads every `.ts`, `.js`, `.mjs` and `.cjs` file under `integration`,
 * `admin` and `helpers` with the TypeScript checker and requires, at every
 * call of one of those member names, an object-literal argument with a
 * `headers` property. The one exemption is a call the checker resolves to a
 * signature declared in library code (`src` outside `src/__tests__`, or an
 * installed package) that has no `headers` parameter: a `Map`'s `delete`, a
 * hash's `update`, a profiler's `delete`.
 * The `headers` must sit in the options argument: the position the resolved
 * signature gives its `headers` parameter, or, for a call the checker cannot
 * type, the last of at least two arguments. A member taken off its object
 * (`.bind`, `.call`, `.apply`, `x['update']`, or destructured) is reported
 * too, since its arguments cannot be seen at the call.
 */

const TESTS = join(__dirname, '..', '..');
const ROOT = join(TESTS, '..', '..');
const SCAN: IHeadersScan = {
  tests: TESTS,
  tsconfig: join(ROOT, 'tsconfig.json'),
  library: [join(ROOT, 'src')],
  testDirs: [TESTS],
};
const callsWithoutHeaders = (files: readonly string[]): string[] =>
  callsWithoutHeadersIn(SCAN, files);

describe('header members are called with headers', () => {
  it('in every integration, admin and helper file, JavaScript included', () => {
    const files = ['integration', 'admin', 'helpers'].flatMap((dir) =>
      filesUnder(join(TESTS, dir)),
    );
    expect(files.some((file) => file.endsWith('test-helper.js'))).toBe(true);
    expect(callsWithoutHeaders(files)).toEqual([]);
  });

  it('reports a call it cannot see the headers of, and passes one that needs none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'headers-passed-'));
    const file = (name: string, text: string) => {
      writeFileSync(join(dir, name), text);
      return join(dir, name);
    };
    const program = join(ROOT, 'src', 'core', 'program', 'AdtProgram')
      .split(sep)
      .join('/');
    try {
      const found = callsWithoutHeaders([
        file(
          'helper.js',
          [
            'async function write(handler, config) {',
            '  await handler.update(config, { source: "x" });',
            '  await handler.activate(config, { headers: pair });',
            '  const call = handler.updateMetadata.bind(handler);',
            "  await handler['delete'](config);",
            '  const { update } = handler;',
            '  const { inner: { activate: run } } = { inner: handler };',
            "  await handler.update({ programName: 'Z', headers: pair });",
            '}',
            '',
          ].join('\n'),
        ),
        file(
          'typed.ts',
          [
            `import { AdtProgram } from '${program}';`,
            'type Handler = { delete(config: unknown, options?: any): Promise<unknown> };',
            'export async function run(handler: Handler, seen: Map<string, number>, typed: AdtProgram) {',
            '  await handler.delete({}, { analyse: true });',
            "  seen.delete('x');",
            "  await typed.update({ programName: 'Z', headers: pair }, { source: 'x' });",
            "  await typed.update({ programName: 'Z' }, { source: 'x', headers: pair });",
            '}',
            '',
          ].join('\n'),
        ),
      ]).map((line) => line.slice(line.lastIndexOf(sep) + 1));
      expect(found).toEqual([
        'helper.js:2 update() without headers',
        'helper.js:4 updateMetadata.bind',
        "helper.js:5 ['delete']",
        'helper.js:6 { update } destructured',
        'helper.js:7 { activate } destructured',
        'helper.js:8 update() without headers',
        'typed.ts:4 delete() without headers',
        'typed.ts:6 update() without headers',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
