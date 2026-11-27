/**
 * K6 of #304: `Profiler.read` dispatches through a handler map typed per view
 * instead of a switch that cast each view's options. Each view reaches its
 * endpoint with its options, and a view the family does not have — reachable
 * from JavaScript — throws the same error before any request. Snapshot
 * written by the code before the change.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  Profiler,
  profilerDocuments,
} from '../../../runtime/traces/ProfilerDomain';

function recorder() {
  const sent: unknown[] = [];
  const connection = {
    makeAdtRequest: jest.fn(async (request: unknown) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', headers: {}, data: '<x/>' };
    }),
    getBaseUrl: async () => 'https://example.test',
    getSessionId: () => null,
    setSessionType: () => undefined,
    connect: async () => undefined,
  } satisfies IAbapConnection;
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  return {
    profiler: new Profiler(connection, { logger, results: profilerDocuments }),
    sent,
  };
}

describe('each profiler view reaches its endpoint with its options', () => {
  const cases = [
    ['hitlist', undefined],
    ['hitlist', { withSystemEvents: true }],
    ['statements', undefined],
    [
      'statements',
      {
        id: 3,
        withDetails: true,
        autoDrillDownThreshold: 5,
        withSystemEvents: false,
      },
    ],
    ['dbAccesses', undefined],
    ['dbAccesses', { withSystemEvents: true }],
  ] as const;
  it.each(cases)('%s with %j', async (view, options) => {
    const { profiler, sent } = recorder();
    const answer = await profiler.read('TRACEID0123456789', view, options);
    expect({ ok: answer.ok, sent }).toMatchSnapshot();
  });

  it.each(['unknown', 'toString', '__proto__', 'list'])(
    'throws for the view %j before any request',
    async (view) => {
      const { profiler, sent } = recorder();
      // What a JavaScript caller can pass: the compiler refuses it here.
      await expect(profiler.read('T', view as never)).rejects.toThrow(
        `Unknown trace view: ${view}`,
      );
      expect(sent).toEqual([]);
    },
  );
});
