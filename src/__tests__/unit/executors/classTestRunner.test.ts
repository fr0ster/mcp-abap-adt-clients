/**
 * Running a class's ABAP Unit tests: one request per member, and nothing that
 * manages the tests themselves — that is the local test class's.
 */

import { unitTestRunId } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import {
  ClassTestRunner,
  classTestRunnerDocuments,
} from '../../../executors/class/ClassTestRunner';
import { ClassTestRunnerLegacy } from '../../../executors/class/ClassTestRunnerLegacy';
import { expectFailure, expectResult } from '../../helpers/contract';
import { createLibraryLogger } from '../../helpers/testLogger';

type Call = { url: string; method: string; data?: unknown };

const RUN_STARTED = {
  status: 200,
  headers: { location: '/sap/bc/adt/abapunit/runs/00155D-3F2A' },
  data: '<aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit"/>',
};

function makeConn(handler?: (call: Call) => Partial<IAdtWireResponse>) {
  const calls: Call[] = [];
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
        ...handler?.(call),
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('ClassTestRunner — running', () => {
  it('named test classes: one POST to /runs, and the id from the header', async () => {
    const { conn, calls } = makeConn(() => RUN_STARTED);
    const runner = new ClassTestRunner(conn, createLibraryLogger(), {
      ...classTestRunnerDocuments,
      run: unitTestRunId,
    });

    const runId = expectResult(
      await runner.run([{ containerClass: 'ZCL_TESTS', testClass: 'LTCL' }]),
      'start a run',
    );

    expect(runId).toBe('00155D-3F2A');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain('<aunit:tests>');
  });

  it('a class name runs the whole class, by object', async () => {
    const { conn, calls } = makeConn(() => RUN_STARTED);
    const runner = new ClassTestRunner(conn, createLibraryLogger());

    await runner.run('zcl_tests');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain(
      '<osl:object name="ZCL_TESTS" type="CLAS"/>',
    );
  });

  it('asking about a run is a separate request, taking the id', async () => {
    const { conn, calls } = makeConn();
    const runner = new ClassTestRunner(conn, createLibraryLogger());

    await runner.getStatus('00155D-3F2A', false);
    await runner.getResult('00155D-3F2A');

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /sap/bc/adt/abapunit/runs/00155D-3F2A',
      'GET /sap/bc/adt/abapunit/results/00155D-3F2A',
    ]);
  });

  it('manages nothing: no create, update, delete or lock', () => {
    const { conn } = makeConn();
    const runner = new ClassTestRunner(conn, createLibraryLogger());

    for (const name of ['create', 'read', 'update', 'delete', 'lock']) {
      expect(name in runner).toBe(false);
    }
  });

  it('is what AdtExecutor hands out, and the legacy one from the legacy executor', () => {
    const { conn } = makeConn();

    expect(new AdtExecutor(conn).getClassTestRunner()).toBeInstanceOf(
      ClassTestRunner,
    );
    expect(new AdtExecutorLegacy(conn).getClassTestRunner()).toBeInstanceOf(
      ClassTestRunnerLegacy,
    );
  });
});

describe('ClassTestRunnerLegacy', () => {
  it('runs each distinct container whole, on /testruns', async () => {
    const { conn, calls } = makeConn();
    const runner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

    await runner.run([
      { containerClass: 'ZCL_TESTS', testClass: 'LTCL_A' },
      { containerClass: 'ZCL_TESTS', testClass: 'LTCL_B' },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
    const body = String(calls[0].data);
    expect(body.match(/objectReference /g)).toHaveLength(1);
    expect(body).toContain('/sap/bc/adt/oo/classes/zcl_tests');
  });

  it('refuses to poll or fetch without a request: the POST answered the result', async () => {
    const { conn, calls } = makeConn();
    const runner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

    expectFailure(await runner.getStatus(), 'no run to poll');
    expectFailure(await runner.getResult(), 'no result to fetch');
    expect(calls).toHaveLength(0);
  });
});
