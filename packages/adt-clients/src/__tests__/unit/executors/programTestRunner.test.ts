/**
 * Running a report's ABAP Unit tests: the same `/abapunit/runs` as a class's,
 * naming the report as `osl:object type="PROG"`. On a legacy system `run` is the
 * synchronous `/testruns` POST, and there is no run to poll.
 */

import { unitTestRunId } from '@mcp-abap-adt/adt-strategies';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { ClassTestRunnerLegacy } from '../../../executors/class/ClassTestRunnerLegacy';
import {
  ProgramTestRunner,
  programTestRunnerDocuments,
} from '../../../executors/program/ProgramTestRunner';
import { ProgramTestRunnerLegacy } from '../../../executors/program/ProgramTestRunnerLegacy';
import { expectFailure, expectResult } from '../../helpers/contract';
import { createLibraryLogger } from '../../helpers/testLogger';

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
  it('one POST to /runs naming the report as PROG, and the id from the header', async () => {
    const { conn, calls } = makeConn();
    const runner = new ProgramTestRunner(conn, createLibraryLogger(), {
      ...programTestRunnerDocuments,
      run: unitTestRunId,
    });

    const runId = expectResult(await runner.run('zr_report'), 'start a run');

    expect(runId).toBe('0CC47A-RUN');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain(
      '<osl:object name="ZR_REPORT" type="PROG"/>',
    );
  });

  it('asks about a run by its id, as a class runner does', async () => {
    const { conn, calls } = makeConn();
    const runner = new ProgramTestRunner(conn, createLibraryLogger());

    await runner.getStatus('0CC47A-RUN', false);
    await runner.getResult('0CC47A-RUN');

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /sap/bc/adt/abapunit/runs/0CC47A-RUN',
      'GET /sap/bc/adt/abapunit/results/0CC47A-RUN',
    ]);
  });

  it('is what AdtExecutor hands out, and the legacy one from the legacy executor', () => {
    const { conn } = makeConn();

    expect(new AdtExecutor(conn).getProgramTestRunner()).toBeInstanceOf(
      ProgramTestRunner,
    );
    expect(new AdtExecutorLegacy(conn).getProgramTestRunner()).toBeInstanceOf(
      ProgramTestRunnerLegacy,
    );
  });
});

describe('ProgramTestRunnerLegacy', () => {
  it("refuses to poll or fetch without a request, with the class runner's reason", async () => {
    const { conn, calls } = makeConn();
    const runner = new ProgramTestRunnerLegacy(conn, createLibraryLogger());
    const classRunner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

    const status = expectFailure(await runner.getStatus(), 'status');
    const result = expectFailure(await runner.getResult(), 'result');

    expect(status).toEqual(
      expectFailure(await classRunner.getStatus(), 'class status'),
    );
    expect(result).toEqual(
      expectFailure(await classRunner.getResult(), 'class result'),
    );
    expect(status.origin).toBe('refusal');
    expect(status.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(calls).toHaveLength(0);
  });

  it('run is one POST to /testruns, not /runs: on 7.40 that POST is the run', async () => {
    const { conn, calls } = makeConn();

    await new ProgramTestRunnerLegacy(conn, createLibraryLogger()).run(
      'ZR_REPORT',
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
    expect(String(calls[0].data)).toContain('<options>');
  });
});
