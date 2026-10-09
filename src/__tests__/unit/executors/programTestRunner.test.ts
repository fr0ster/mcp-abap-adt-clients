/**
 * Running a report's ABAP Unit tests: the same `/abapunit/runs` as a class's,
 * naming the report as `osl:object type="PROG"`, and refused on a legacy system.
 */

import { unitTestRunId } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
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
  it('refuses every member without a request', async () => {
    const { conn, calls } = makeConn();
    const runner = new ProgramTestRunnerLegacy(conn, createLibraryLogger());

    expectFailure(await runner.run(), 'no report run below 7.50');
    expectFailure(await runner.getStatus(), 'no run to poll');
    expectFailure(await runner.getResult(), 'no result to fetch');
    expect(calls).toHaveLength(0);
  });
});
