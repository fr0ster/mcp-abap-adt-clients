/**
 * Managing a class's tests, and running them, are different operations.
 *
 * Until 12.0.0 they shared one method: `create` started a run, which is why
 * `update` and `delete` looked like capabilities ADT withheld. These assert the
 * split — that `create` creates the container class, that `update` writes only
 * the include, that `delete` empties it without touching the class, and that
 * `run` needs none of them to have been called.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtUnitTest } from '../../../../core/unitTest/AdtUnitTest';
import { createLibraryLogger } from '../../../helpers/testLogger';

type Call = { url: string; method: string; data?: unknown };

const RUN_STARTED = {
  status: 200,
  headers: { location: '/sap/bc/adt/abapunit/runs/00155D-3F2A' },
  data: '<aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit"/>',
};

function makeConn(
  handler?: (call: Call, index: number) => Partial<IAdtResponse> | Error,
) {
  const calls: Call[] = [];
  let i = 0;
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      const res = handler?.(call, i++) ?? {};
      if (res instanceof Error) throw res;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH</LOCK_HANDLE></DATA></asx:values></asx:abap>',
        ...res,
      } as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtUnitTest — managing the tests', () => {
  it('create POSTs the container class before writing anything into it', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await h.create({
      className: 'ZCL_TESTS',
      packageName: '$TMP',
      description: 'tests',
      testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
    });

    // The class is created first — a POST to the classes collection — and only
    // then is the include written.
    const post = calls.find(
      (c) => c.method === 'POST' && c.url.endsWith('/oo/classes'),
    );
    expect(post).toBeDefined();

    const put = calls.find(
      (c) => c.method === 'PUT' && c.url.includes('/includes/testclasses'),
    );
    expect(put).toBeDefined();
    expect(String(put?.data)).toContain('ltcl');
    expect(calls.indexOf(post as Call)).toBeLessThan(
      calls.indexOf(put as Call),
    );
  });

  it('update writes only the include — no class is created', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await h.update({
      className: 'ZCL_TESTS',
      testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
    });

    expect(
      calls.some((c) => c.method === 'POST' && c.url.endsWith('/oo/classes')),
    ).toBe(false);
    expect(
      calls.some(
        (c) => c.method === 'PUT' && c.url.includes('/includes/testclasses'),
      ),
    ).toBe(true);
  });

  it('update given a lock handle takes no lock of its own', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await h.update(
      {
        className: 'ZCL_TESTS',
        testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
      },
      { lockHandle: 'HELD-BY-CALLER' },
    );

    expect(calls.some((c) => c.url.includes('_action=LOCK'))).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('lockHandle=HELD-BY-CALLER');
  });

  it('update accepts empty source inside a caller-held lock', async () => {
    // Clearing the tests while holding the container's lock is the only route
    // there is: delete() takes no lock handle. A truthy guard here rejected the
    // empty string and made that impossible — caught in review, 2026-08-14.
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await h.update(
      { className: 'ZCL_TESTS' },
      { lockHandle: 'HELD-BY-CALLER', sourceCode: '' },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].data).toBe('');
  });

  it('delete empties the include and deletes no object', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await h.delete({ className: 'ZCL_TESTS' });

    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    const put = calls.find(
      (c) => c.method === 'PUT' && c.url.includes('/includes/testclasses'),
    );
    expect(put).toBeDefined();
    expect(put?.data).toBe('');
  });

  it('lock locks the container class, not the include', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const handle = await h.lock({ className: 'ZCL_TESTS' });

    expect(handle).toBe('LH');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/oo/classes/zcl_tests?_action=LOCK&accessMode=MODIFY',
    );
  });
});

describe('AdtUnitTest — what it does not have', () => {
  it("carries no method for the container class's own operations", () => {
    // These threw, or returned an empty state, until 12.0.0. Activation, the
    // syntax check, version history and the transport belong to the container
    // class and are reached through getClass() — a unit test has no resource
    // for any of them, so it has no method claiming one.
    const { conn } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    for (const name of [
      'activate',
      'check',
      'getVersions',
      'getVersionSource',
      'readTransport',
    ]) {
      expect(name in h).toBe(false);
    }
  });

  it('still carries the run conveniences, which no contract promises', () => {
    // getRunId and the two response getters are this handler remembering its
    // own last call. That is not a capability — nothing in ADT is "the run I
    // started last" — so they stay as methods and out of every interface.
    const { conn } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    for (const name of ['getRunId', 'getStatusResponse', 'getResultResponse']) {
      expect(typeof (h as unknown as Record<string, unknown>)[name]).toBe(
        'function',
      );
    }
  });
});

describe('AdtUnitTest — running', () => {
  it('run issues the run request with no preceding create or update', async () => {
    const { conn, calls } = makeConn(() => RUN_STARTED);
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const runId = await h.run([
      { containerClass: 'ZCL_TESTS', testClass: 'LTCL' },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(runId).toBe('00155D-3F2A');
  });

  it('rejects an empty test list before issuing anything', async () => {
    const { conn, calls } = makeConn();
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await expect(h.run([])).rejects.toThrow(/at least one test definition/i);
    expect(calls).toHaveLength(0);
  });

  it('asking about a run is a separate request, taking the id', async () => {
    const { conn, calls } = makeConn(() => ({ data: '<aunit:runStatus/>' }));
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await h.getStatus('00155D-3F2A', false);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toContain('/abapunit/runs/00155D-3F2A');
  });
});
