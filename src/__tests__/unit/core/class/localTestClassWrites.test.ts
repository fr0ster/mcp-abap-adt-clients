/**
 * Writing a class's tests is one PUT of its `testclasses` include, whatever
 * the caller calls it. These moved here from the unit-test handler, which
 * delegated every one of them to this class until 24.0.0 removed it.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtLocalTestClass } from '../../../../core/class/AdtLocalTestClass';
import { createLibraryLogger } from '../../../helpers/testLogger';

type Call = { url: string; method: string; data?: unknown };

function makeConn() {
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
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtLocalTestClass — writing the tests', () => {
  it('update given a lock handle takes no lock of its own', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtLocalTestClass(conn, createLibraryLogger());

    await h.update(
      {
        className: 'ZCL_TESTS',
        source: 'CLASS ltcl DEFINITION FOR TESTING.',
      },
      { lockHandle: 'HELD-BY-CALLER' },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toContain('/includes/testclasses');
    expect(calls[0].url).toContain('lockHandle=HELD-BY-CALLER');
  });

  it('update accepts empty source inside a caller-held lock', async () => {
    // Clearing the tests while holding the container's lock is the only route
    // there is: delete() takes no lock handle of its own. A truthy guard
    // rejected the empty string once — caught in review, 2026-08-14.
    const { conn, calls } = makeConn();
    const h = new AdtLocalTestClass(conn, createLibraryLogger());

    await h.update(
      { className: 'ZCL_TESTS' },
      { lockHandle: 'HELD-BY-CALLER', source: '' },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].data).toBe('');
  });

  it('delete empties the include and deletes no object', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtLocalTestClass(conn, createLibraryLogger());

    await h.delete({ className: 'ZCL_TESTS' });

    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].data).toBe('');
  });
});
