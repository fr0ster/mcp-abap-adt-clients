/**
 * A function group's and a function module's ABAP Unit runners on 7.40:
 * there is no run to poll; what they send is in
 * `legacySyncTestRunners.test.ts`. The fixtures are the root package's
 * `functionTestRunners.test.ts`'s.
 */

import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { expectFailure } from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { createLibraryLogger } from '../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { ClassTestRunnerLegacy } from '../../../executors/class/ClassTestRunnerLegacy';
import { FunctionGroupTestRunnerLegacy } from '../../../executors/functionGroup/FunctionGroupTestRunnerLegacy';
import { FunctionModuleTestRunnerLegacy } from '../../../executors/functionModule/FunctionModuleTestRunnerLegacy';

type Call = { url: string; method: string; data?: unknown };

function makeConn() {
  const calls: Call[] = [];
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      return {
        status: 201,
        statusText: 'Created',
        headers: { location: '/sap/bc/adt/abapunit/runs/RUN' },
        data: '',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe.each([
  ['FunctionGroupTestRunnerLegacy', FunctionGroupTestRunnerLegacy],
  ['FunctionModuleTestRunnerLegacy', FunctionModuleTestRunnerLegacy],
] as const)('%s', (_label, Runner) => {
  it("refuses to poll or fetch without a request, with the class runner's reason", async () => {
    const { conn, calls } = makeConn();
    const runner = new Runner(conn, createLibraryLogger());
    const classRunner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    const status = expectFailure(await runner.getStatus(), 'status');
    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    const result = expectFailure(await runner.getResult(), 'result');

    expect(status).toEqual(
      // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
      expectFailure(await classRunner.getStatus(), 'class status'),
    );
    expect(result).toEqual(
      // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
      expectFailure(await classRunner.getResult(), 'class result'),
    );
    expect(status.origin).toBe('refusal');
    expect(status.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(status.message).toContain('no run to poll');
    expect(result.message).toContain('no result to fetch');
    expect(calls).toHaveLength(0);
  });
});

describe('the executors hand them out', () => {
  it('legacy', () => {
    const { conn } = makeConn();

    expect(
      new AdtExecutorLegacy(conn).getFunctionGroupTestRunner(),
    ).toBeInstanceOf(FunctionGroupTestRunnerLegacy);
    expect(
      new AdtExecutorLegacy(conn).getFunctionModuleTestRunner(),
    ).toBeInstanceOf(FunctionModuleTestRunnerLegacy);
  });
});
