/**
 * `validate()` checks what is about to be born, and it issues requests.
 *
 * It used to return what its own comment called "a mock success response", and
 * a later attempt validated the wrong thing — a **name** check against a class
 * that already existed, which is meaningless: `validateClassName` takes a
 * package and a description, parameters that only mean anything before an
 * object exists.
 *
 * So validation forks on what is about to be created:
 *
 * - the container class does not exist yet → validate the **name**;
 * - it does → confirm it is there, by reading it;
 * - source was given → check the **code**, whichever branch was taken.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtCdsUnitTest } from '../../../../core/unitTest/AdtCdsUnitTest';
import { AdtUnitTest } from '../../../../core/unitTest/AdtUnitTest';
import { expectResult } from '../../../helpers/contract';
import { createLibraryLogger } from '../../../helpers/testLogger';

type Call = { url: string; method: string; data?: unknown };

function makeConn(
  handler: (call: Call, index: number) => Partial<IAdtWireResponse> | Error,
) {
  const calls: Call[] = [];
  let callIndex = 0;
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      const res = handler(call, callIndex++);
      if (res instanceof Error) throw res;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
        ...res,
      } as IAdtWireResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtUnitTest.validate()', () => {
  it('rejects before any request when no container class is named (zero calls)', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await expect(h.validate({})).rejects.toThrow(/container class name/i);
    expect(calls).toHaveLength(0);
  });

  it('confirms an existing container by reading it, and reports what came back', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('GET');
      expect(r.url).toBe('/sap/bc/adt/oo/classes/ZCL_CONTAINER/source/main');
      return { status: 200, data: 'CLASS zcl_container DEFINITION.' };
    });
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const state = expectResult(
      await h.validate({ className: 'ZCL_CONTAINER' }),
      'state',
    );

    expect(calls).toHaveLength(1);
    expect(state.errors).toEqual([]);
    expect(state.readResult?.data).toBe('CLASS zcl_container DEFINITION.');
  });

  it('checks the test source too, when there is source to check', async () => {
    const { conn, calls } = makeConn((r, i) => {
      if (i === 0) return { status: 200, data: 'CLASS zcl_container.' };
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/checkruns');
      expect(String(r.data)).toContain(
        '/sap/bc/adt/oo/classes/zcl_container/includes/testclasses',
      );
      return { status: 200, data: '<code-ok/>' };
    });
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const state = expectResult(
      await h.validate({
        className: 'ZCL_CONTAINER',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
      'state',
    );

    expect(calls).toHaveLength(2);
    expect(state.checkResult?.data).toBe('<code-ok/>');
  });

  it('validates the NAME when the container does not exist yet — the create path', async () => {
    const { conn, calls } = makeConn((r, i) => {
      if (i === 0) {
        return Object.assign(new Error('not found'), {
          response: { status: 404, statusText: 'Not Found', data: '' },
        });
      }
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/oo/validation/objectname');
      expect(r.url).toContain('objname=ZCL_NEW_TESTS');
      return { status: 200, data: '<name-ok/>' };
    });
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const state = expectResult(
      await h.validate({
        className: 'ZCL_NEW_TESTS',
        packageName: 'ZPKG',
        description: 'tests',
      }),
      'state',
    );

    expect(calls).toHaveLength(2);
    expect(state.validationResponse?.data).toBe('<name-ok/>');
  });
  it('a read that fails for any other reason is reported, not treated as absence', async () => {
    // A 500 is a fact about the request, not about the class. Routing it into
    // the create path would validate a NAME for a class that exists and report
    // something nobody asked — caught in review, 2026-08-14.
    const { conn, calls } = makeConn(() =>
      Object.assign(new Error('server error'), {
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: '',
        },
      }),
    );
    const h = new AdtUnitTest(conn, createLibraryLogger());

    await expect(h.validate({ className: 'ZCL_CONTAINER' })).rejects.toThrow(
      /server error/i,
    );
    expect(calls).toHaveLength(1);
  });
});

describe('AdtCdsUnitTest.validate()', () => {
  it('issues both the name validation and the local-test-class check, in order', async () => {
    const { conn, calls } = makeConn((r, i) => {
      if (i === 0) {
        expect(r.method).toBe('POST');
        expect(r.url).toContain('/sap/bc/adt/oo/validation/objectname');
        expect(r.url).toContain('objname=ZCL_CDS_DUMMY');
        return { status: 200, data: '<name-ok/>' };
      }
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/checkruns');
      expect(String(r.data)).toContain(
        '/sap/bc/adt/oo/classes/zcl_cds_dummy/includes/testclasses',
      );
      return { status: 200, data: '<code-ok/>' };
    });
    const h = new AdtCdsUnitTest(conn, createLibraryLogger());

    const state = expectResult(
      await h.validate({
        className: 'ZCL_CDS_DUMMY',
        packageName: 'ZPKG',
        classTemplate: '<template/>',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
      'state',
    );

    expect(calls).toHaveLength(2);
    expect(state.errors).toEqual([]);
    expect(state.validationResponse?.data).toBe('<name-ok/>');
    expect(state.testClassState?.validationResponse?.data).toBe('<code-ok/>');
  });

  it('a name the server rejects produces an error, not an empty success (one request)', async () => {
    const { conn, calls } = makeConn(() =>
      Object.assign(new Error('invalid object name'), {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: 'Object name is not valid',
        },
      }),
    );
    const h = new AdtCdsUnitTest(conn, createLibraryLogger());

    await expect(
      h.validate({
        className: 'BOGUS NAME',
        // Required since the endpoint was measured to demand it. Without it the
        // handler's own guard throws first and this test would pass while
        // proving the opposite of what it is named for: no request would be
        // sent, and the server's rejection is the thing under test.
        packageName: 'ZPKG',
        classTemplate: '<template/>',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
    ).rejects.toMatchObject({ code: 'ADT_VALIDATION_FAILED', status: 400 });
    expect(calls).toHaveLength(1);
  });

  /**
   * The guard added beside it, pinned separately.
   *
   * `/oo/validation/objectname` answers `400, Parameter packagename could not
   * be found.` without it — measured on E19 — so the handler refuses before
   * sending. That is a caller error with a name rather than a 400 to decode off
   * the wire, and it must cost no request at all.
   */
  it('refuses a missing package before sending anything', async () => {
    const { conn, calls } = makeConn(() => ({ status: 200, data: '<ok/>' }));
    const h = new AdtCdsUnitTest(conn, createLibraryLogger());

    await expect(
      h.validate({
        className: 'ZCL_X',
        classTemplate: '<template/>',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
    ).rejects.toThrow(/Package name is required/);
    expect(calls).toHaveLength(0);
  });

  it('falls back to the parent check when no class is being generated', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('GET');
      expect(r.url).toBe('/sap/bc/adt/oo/classes/ZCL_CONTAINER/source/main');
      return { status: 200, data: 'CLASS zcl_container DEFINITION.' };
    });
    const h = new AdtCdsUnitTest(conn, createLibraryLogger());

    const state = expectResult(
      await h.validate({ className: 'ZCL_CONTAINER' }),
      'state',
    );

    expect(calls).toHaveLength(1);
    expect(state.errors).toEqual([]);
  });
});
