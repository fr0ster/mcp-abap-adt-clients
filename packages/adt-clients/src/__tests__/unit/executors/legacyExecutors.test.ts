/**
 * The legacy executors (SAP_BASIS 7.40 SP04, spec §6.3): a run and the trace
 * type lists are refused without a request; the trace schedule is the modern
 * executor's, request for request.
 */

import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { ClassExecutor } from '../../../executors/class/ClassExecutor';
import { ClassExecutorLegacy } from '../../../executors/class/ClassExecutorLegacy';
import { ProgramExecutor } from '../../../executors/program/ProgramExecutor';
import { ProgramExecutorLegacy } from '../../../executors/program/ProgramExecutorLegacy';
import { headersOf } from '../../helpers/adtHeaders';
import '../../helpers/legacyRegistrations';
import { expectFailure } from '../../helpers/contract';

type Request = Record<string, unknown>;

function connection() {
  const makeAdtRequest = jest.fn(async (_request: Request) => ({
    status: 200,
    statusText: 'OK',
    headers: { location: '/sap/bc/adt/runtime/traces/abaptraces/parameters/P' },
    data: '',
  }));
  return {
    conn: { makeAdtRequest } as unknown as IAbapConnection,
    requests: makeAdtRequest,
  };
}

type Executor = ClassExecutor | ProgramExecutor;

describe('legacy executors', () => {
  it('the legacy executor hands out the legacy class and program executors', () => {
    const { conn } = connection();
    const executor = new AdtExecutorLegacy(conn);
    expect(executor.getClassExecutor()).toBeInstanceOf(ClassExecutorLegacy);
    expect(executor.getProgramExecutor()).toBeInstanceOf(ProgramExecutorLegacy);
  });

  describe.each([
    [
      'class',
      (c: IAbapConnection): Executor => new ClassExecutorLegacy(c),
      (c: IAbapConnection): Executor => new ClassExecutor(c),
      { className: 'ZCL_GUARD' },
      '/sap/bc/adt/oo/classrun',
      'measured',
    ],
    [
      'program',
      (c: IAbapConnection): Executor => new ProgramExecutorLegacy(c),
      (c: IAbapConnection): Executor => new ProgramExecutor(c),
      { programName: 'ZGUARD' },
      '/sap/bc/adt/programs/programrun',
      'not-measured',
    ],
  ] as const)(
    '%s',
    (_name, legacy, modern, target, runEndpoint, runEvidence) => {
      it.each([
        ['run', runEndpoint, runEvidence],
        ['runWithProfiler', runEndpoint, runEvidence],
        [
          'listObjectTypes',
          '/sap/bc/adt/runtime/traces/abaptraces/objecttypes',
          'not-measured',
        ],
        [
          'listProcessTypes',
          '/sap/bc/adt/runtime/traces/abaptraces/processtypes',
          'not-measured',
        ],
      ])(
        '%s is refused without a request, naming %s (%s)',
        async (member, endpoint, evidence) => {
          const { conn, requests } = connection();
          const executor = legacy(conn) as unknown as Record<
            string,
            (...args: unknown[]) => Promise<never>
          >;
          const args =
            member === 'run'
              ? [target]
              : member === 'runWithProfiler'
                ? [target, { profilerId: 'P1' }]
                : [];

          const error = expectFailure(await executor[member](...args), member);

          expect(error.origin).toBe('refusal');
          expect(error.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
          expect(error.message).toContain(member);
          expect(error.message).toContain(endpoint);
          // A measured absence says so; an unmeasured one says only what
          // discovery shows, and that no run has measured it.
          if (evidence === 'measured') {
            expect(error.message).toContain('has no');
            expect(error.message).not.toContain('not measured');
          } else {
            expect(error.message).toContain('does not advertise');
            expect(error.message).toContain('not measured');
            expect(error.message).not.toContain('has no');
          }
          expect(requests).not.toHaveBeenCalled();
        },
      );

      it('listRequests, getRequestsByUri and scheduleTrace send what the modern executor sends', async () => {
        const calls = async (build: typeof legacy) => {
          const { conn, requests } = connection();
          const executor = build(conn);
          await executor.listRequests();
          await executor.getRequestsByUri('/sap/bc/adt/oo/classes/zcl_guard');
          await executor.scheduleTrace({
            headers: headersOf(executor, 'scheduleTrace'),
          });
          return requests.mock.calls.map(([request]) => request);
        };

        const sent = await calls(legacy);

        expect(sent).toHaveLength(3);
        expect(sent).toEqual(await calls(modern));
      });
    },
  );
});
