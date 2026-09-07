/**
 * Five reads took `IReadOptions`, used it for `accept`, and never asked about
 * `withLongPolling` — the four class-include reads and the behaviour
 * implementation's. A caller could set the option and nothing reached the wire.
 *
 * The integration suites cannot catch this: 47 class-include reads went over
 * the wire on E19 in one run and not one of them asked for long polling,
 * because no caller sets it. So the guard has to be here.
 *
 * What each case pins is the *separator*. These URLs already carry
 * `?version=…`, which is exactly why the `'?withLongPolling=true'` literal used
 * elsewhere in this layer could not be reused — and why these reads dropped the
 * option instead of joining it. A second `?` would be silently wrong: SAP reads
 * the query up to it and ignores the rest, so the test asserts the whole URL,
 * not merely that the parameter appears somewhere in it.
 *
 * The two families differ in case — the class reads pass the name through as
 * given, the behaviour implementation lowercases it — so the expectations are
 * spelled out rather than shared.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getBehaviorImplementationImplementations } from '../../../core/behaviorImplementation/read';
import {
  getClassDefinitionsInclude,
  getClassImplementationsInclude,
  getClassMacrosInclude,
  getClassTestClassesInclude,
} from '../../../core/class/read';

function fakeConn(): { conn: IAbapConnection; calls: { url: string }[] } {
  const calls: { url: string }[] = [];
  return {
    conn: {
      makeAdtRequest: jest.fn(async (req: { url: string }) => {
        calls.push(req);
        return { status: 200, data: '' };
      }),
      setSessionType: jest.fn(),
    } as unknown as IAbapConnection,
    calls,
  };
}

const CLASS_INCLUDES = [
  ['definitions', getClassDefinitionsInclude],
  ['macros', getClassMacrosInclude],
  ['testclasses', getClassTestClassesInclude],
  ['implementations', getClassImplementationsInclude],
] as const;

describe('class include reads carry withLongPolling when asked', () => {
  for (const [kind, read] of CLASS_INCLUDES) {
    it(`${kind}: joins onto the existing version query with &`, async () => {
      const { conn, calls } = fakeConn();
      await read(conn, 'ZTEST_CLS', 'active', undefined, {
        withLongPolling: true,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(
        `/sap/bc/adt/oo/classes/ZTEST_CLS/includes/${kind}?version=active&withLongPolling=true`,
      );
    });

    it(`${kind}: sends no such parameter when it is not asked for`, async () => {
      const { conn, calls } = fakeConn();
      await read(conn, 'ZTEST_CLS', 'active');

      expect(calls[0].url).not.toContain('withLongPolling');
    });
  }
});

describe('the behaviour implementation include read', () => {
  // Its version query is conditional, so the base arrives both with and without
  // a `?` — the one case where a hardcoded separator is wrong either way round.
  it('uses & when a version query is already there', async () => {
    const { conn, calls } = fakeConn();
    await getBehaviorImplementationImplementations(
      conn,
      'ZTEST_BP',
      'inactive',
      {
        withLongPolling: true,
      },
    );

    expect(calls[0].url).toBe(
      '/sap/bc/adt/oo/classes/ztest_bp/includes/implementations?version=inactive&withLongPolling=true',
    );
  });

  it('uses ? when the base carries no query at all', async () => {
    const { conn, calls } = fakeConn();
    await getBehaviorImplementationImplementations(conn, 'ZTEST_BP', 'active', {
      withLongPolling: true,
    });

    expect(calls[0].url).toBe(
      '/sap/bc/adt/oo/classes/ztest_bp/includes/implementations?withLongPolling=true',
    );
  });
});
