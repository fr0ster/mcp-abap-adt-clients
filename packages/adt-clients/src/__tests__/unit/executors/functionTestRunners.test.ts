/**
 * A function group's and a function module's ABAP Unit runs: the same
 * `/abapunit/runs` as a class's, naming the object as `FUGR` or `FUNC`.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import { FunctionGroupTestRunner } from '../../../executors/functionGroup';
import { FunctionModuleTestRunner } from '../../../executors/functionModule';
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

    // One of two runner classes: each gates `run` on its own receiver, so
    // the call goes through what both take.
    const runner: { run(name: string): Promise<unknown> } = new Runner(
      conn,
      createLibraryLogger(),
    );
    await runner.run(name);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain(
      `<osl:object name="${name.toUpperCase()}" type="${type}"/>`,
    );
  });
});

describe('the executors hand them out', () => {
  it('modern', () => {
    const { conn } = makeConn();

    expect(new AdtExecutor(conn).getFunctionGroupTestRunner()).toBeInstanceOf(
      FunctionGroupTestRunner,
    );
    expect(new AdtExecutor(conn).getFunctionModuleTestRunner()).toBeInstanceOf(
      FunctionModuleTestRunner,
    );
  });
});
