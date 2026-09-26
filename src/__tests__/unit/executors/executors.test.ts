/**
 * The executors: every member one request, its answer read by the result set
 * the executor was built with and judged by the caller's `analyse`.
 *
 * The readings are imported from the strategies package source until its index
 * exports them.
 */

import {
  traceSchedulingProfilerId,
  traceSchedulingRequests,
  traceSchedulingTypes,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtAnalyseOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ClassExecutor,
  classExecutorDocuments,
} from '../../../executors/class/ClassExecutor';
import {
  ProgramExecutor,
  programExecutorDocuments,
} from '../../../executors/program/ProgramExecutor';
import { expectResult } from '../../helpers/contract';

const LOCATION = '/sap/bc/adt/runtime/traces/abaptraces/parameters/P1';
const CATALOGUE = `<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:name>/uri/a</nameditem:name><nameditem:description>A</nameditem:description></nameditem:namedItem></nameditem:namedItemList>`;
const EMPTY_FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"/>`;

function connection() {
  return {
    makeAdtRequest: jest.fn(
      async (request: { url: string; method: string }) => {
        if (request.url.endsWith('/parameters') && request.method === 'POST') {
          return { status: 201, data: '', headers: { location: LOCATION } };
        }
        if (request.url.includes('types')) {
          return { status: 200, data: CATALOGUE, headers: {} };
        }
        if (request.url.includes('/requests')) {
          return { status: 200, data: EMPTY_FEED, headers: {} };
        }
        return { status: 200, data: 'run output', headers: {} };
      },
    ),
  } as unknown as IAbapConnection;
}

const refuse: IAdtAnalyseOptions = {
  analyse: () => ({ origin: 'refusal', message: 'refused by the caller' }),
};

describe.each([
  [
    'ClassExecutor',
    (c: IAbapConnection) => new ClassExecutor(c),
    { className: 'ZCL_X' },
    '/sap/bc/adt/oo/classrun/ZCL_X?profilerId=',
  ],
  [
    'ProgramExecutor',
    (c: IAbapConnection) => new ProgramExecutor(c),
    { programName: 'ZPROG' },
    '/sap/bc/adt/programs/programrun/ZPROG?profilerId=',
  ],
] as const)('%s', (_name, build, target, profiledUrl) => {
  it('answers every document as it arrived by default', async () => {
    const c = connection();
    const executor = build(c) as unknown as ClassExecutor;

    expect(expectResult(await executor.run(target as never), 'run')).toBe(
      'run output',
    );
    expect(
      expectResult(
        await executor.runWithProfiler(target as never, { profilerId: 'P1' }),
        'profiled run',
      ),
    ).toBe('run output');
    expect(expectResult(await executor.listObjectTypes(), 'types')).toBe(
      CATALOGUE,
    );
    expect(expectResult(await executor.listRequests(), 'requests')).toBe(
      EMPTY_FEED,
    );
    // The request id is in Location, not the body: the document is empty.
    expect(expectResult(await executor.scheduleTrace(), 'scheduled')).toBe('');
    expect(c.makeAdtRequest).toHaveBeenCalledTimes(5);
    expect(
      (c.makeAdtRequest as jest.Mock).mock.calls.some((call) =>
        String(call[0].url).startsWith(profiledUrl),
      ),
    ).toBe(true);
  });

  it("answers the caller's refusal on every member", async () => {
    const executor = build(connection()) as unknown as ClassExecutor;
    const answers = [
      await executor.run(target as never, refuse),
      await executor.runWithProfiler(target as never, {
        profilerId: 'P1',
        ...refuse,
      }),
      await executor.listObjectTypes(refuse),
      await executor.listProcessTypes(refuse),
      await executor.listRequests(refuse),
      await executor.getRequestsByUri('/uri', refuse),
      await executor.scheduleTrace(refuse),
    ];
    expect(answers.every((a) => !a.ok)).toBe(true);
  });
});

describe('the scheduling readings, given at construction', () => {
  it('reads the catalogue, the schedule and the request id', async () => {
    const executor = new ClassExecutor(connection(), undefined, {
      ...classExecutorDocuments,
      types: traceSchedulingTypes,
      requests: traceSchedulingRequests,
      scheduled: traceSchedulingProfilerId,
    });

    expect(expectResult(await executor.listProcessTypes(), 'types')).toEqual([
      { name: '/uri/a', description: 'A' },
    ]);
    expect(expectResult(await executor.listRequests(), 'requests')).toEqual([]);
    expect(expectResult(await executor.scheduleTrace(), 'scheduled')).toBe(
      LOCATION,
    );
  });

  // It used to throw 'Trace scheduling returned no request id'. That SAP did
  // not say is the caller's to judge; the answer comes back.
  it('an answer without Location reads as no id, not a throw', async () => {
    const c = {
      makeAdtRequest: jest
        .fn()
        .mockResolvedValue({ status: 201, data: '', headers: {} }),
    } as unknown as IAbapConnection;
    const executor = new ProgramExecutor(c, undefined, {
      ...programExecutorDocuments,
      scheduled: traceSchedulingProfilerId,
    });
    expect(expectResult(await executor.scheduleTrace(), 'scheduled')).toBe('');
  });
});
