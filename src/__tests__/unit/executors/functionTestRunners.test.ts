/**
 * A function group's and a function module's ABAP Unit runs: the same
 * `/abapunit/runs` as a class's, naming the object as `FUGR` or `FUNC`, and
 * refused on a legacy system.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import {
  FunctionGroupTestRunner,
  FunctionGroupTestRunnerLegacy,
} from '../../../executors/functionGroup/FunctionGroupTestRunner';
import {
  FunctionModuleTestRunner,
  FunctionModuleTestRunnerLegacy,
} from '../../../executors/functionModule/FunctionModuleTestRunner';
import { expectFailure } from '../../helpers/contract';
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
        headers: { location: '/sap/bc/adt/abapunit/runs/RUN' },
        data: '',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe.each([
  ['FunctionGroupTestRunner', FunctionGroupTestRunner, 'z_group', 'FUGR'],
  ['FunctionModuleTestRunner', FunctionModuleTestRunner, 'z_module', 'FUNC'],
] as const)('%s', (_label, Runner, name, type) => {
  it(`one POST to /runs naming the object as ${type}`, async () => {
    const { conn, calls } = makeConn();

    await new Runner(conn, createLibraryLogger()).run(name);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain(
      `<osl:object name="${name.toUpperCase()}" type="${type}"/>`,
    );
  });
});

describe.each([
  ['FunctionGroupTestRunnerLegacy', FunctionGroupTestRunnerLegacy],
  ['FunctionModuleTestRunnerLegacy', FunctionModuleTestRunnerLegacy],
] as const)('%s', (_label, Runner) => {
  it('refuses every member without a request', async () => {
    const { conn, calls } = makeConn();
    const runner = new Runner(conn, createLibraryLogger());

    expectFailure(await runner.run(), 'no run below 7.50');
    expectFailure(await runner.getStatus(), 'no run to poll');
    expectFailure(await runner.getResult(), 'no result to fetch');
    expect(calls).toHaveLength(0);
  });
});

describe('the executors hand them out', () => {
  it('modern and legacy', () => {
    const { conn } = makeConn();

    expect(new AdtExecutor(conn).getFunctionGroupTestRunner()).toBeInstanceOf(
      FunctionGroupTestRunner,
    );
    expect(new AdtExecutor(conn).getFunctionModuleTestRunner()).toBeInstanceOf(
      FunctionModuleTestRunner,
    );
    expect(
      new AdtExecutorLegacy(conn).getFunctionGroupTestRunner(),
    ).toBeInstanceOf(FunctionGroupTestRunnerLegacy);
    expect(
      new AdtExecutorLegacy(conn).getFunctionModuleTestRunner(),
    ).toBeInstanceOf(FunctionModuleTestRunnerLegacy);
  });
});
