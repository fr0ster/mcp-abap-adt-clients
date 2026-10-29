/**
 * Running a report's ABAP Unit tests on 7.40: `run` is the synchronous
 * `/testruns` POST, and there is no run to poll. The fixtures are the root
 * package's `programTestRunner.test.ts`'s.
 */

import {
  classTestRunnerDocuments,
  programTestRunnerDocuments,
} from '@mcp-abap-adt/adt-clients';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { expectFailure } from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { createLibraryLogger } from '../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { ClassTestRunnerLegacy } from '../../../executors/class/ClassTestRunnerLegacy';
import { ProgramTestRunnerLegacy } from '../../../executors/program/ProgramTestRunnerLegacy';

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
        headers: { location: '/sap/bc/adt/abapunit/runs/0CC47A-RUN' },
        data: '',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('ProgramTestRunner', () => {
  it('the legacy executor hands out the legacy one', () => {
    const { conn } = makeConn();

    expect(new AdtExecutorLegacy(conn).getProgramTestRunner()).toBeInstanceOf(
      ProgramTestRunnerLegacy,
    );
  });
});

describe('ProgramTestRunnerLegacy', () => {
  it("refuses to poll or fetch without a request, with the class runner's reason", async () => {
    const { conn, calls } = makeConn();
    const runner = new ProgramTestRunnerLegacy(
      conn,
      createLibraryLogger(),
      programTestRunnerDocuments,
    );
    const classRunner = new ClassTestRunnerLegacy(
      conn,
      createLibraryLogger(),
      classTestRunnerDocuments,
    );

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
    expect(calls).toHaveLength(0);
  });

  it('run is one POST to /testruns, not /runs: on 7.40 that POST is the run', async () => {
    const { conn, calls } = makeConn();

    await new ProgramTestRunnerLegacy(
      conn,
      createLibraryLogger(),
      programTestRunnerDocuments,
    ).run('ZR_REPORT');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
    expect(String(calls[0].data)).toContain('<options>');
  });
});
