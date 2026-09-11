/**
 * `validate()` issues a request, and it is one request.
 *
 * It used to return what its own comment called "a mock success response". The
 * fix made it real but grew it into a fork — read the class, then validate the
 * name or check the code depending on what was found — and 18.0.0 removed the
 * fork rather than the honesty: `validate` is the container class's name
 * validation, always, and the test source is checked with
 * `getLocalTestClass().validate()` when the consumer wants that second verdict.
 *
 * What survives from the old file is the part that mattered: the answer is the
 * server's, a refusal is a refusal, and a caller error costs no request.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtCdsUnitTest } from '../../../../core/unitTest/AdtCdsUnitTest';
import { AdtUnitTest } from '../../../../core/unitTest/AdtUnitTest';
import { expectFailure, expectResult } from '../../../helpers/contract';
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
  it('validates the container class name — one request, whatever exists', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/oo/validation/objectname');
      expect(r.url).toContain('objname=ZCL_NEW_TESTS');
      return { status: 200, data: '<name-ok/>' };
    });
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const verdict = expectResult(
      await h.validate({
        className: 'ZCL_NEW_TESTS',
        packageName: 'ZPKG',
        description: 'tests',
      }),
      'validation',
    );

    // No probing read first. Whether the class is already there is something
    // the server answers, and it answers it in this document.
    expect(calls).toHaveLength(1);
    expect(verdict).toBe('<name-ok/>');
  });

  it('a refusal is reported as one, not swallowed', async () => {
    const { conn, calls } = makeConn(() =>
      Object.assign(new Error('server error'), {
        response: { status: 500, statusText: 'Server Error', data: '' },
      }),
    );
    const h = new AdtUnitTest(conn, createLibraryLogger());

    const failure = expectFailure(
      await h.validate({
        className: 'ZCL_CONTAINER',
        packageName: 'ZPKG',
        description: 'tests',
      }),
      'validate against a server that failed',
    );

    expect(failure.response?.status).toBe(500);
    expect(calls).toHaveLength(1);
  });
});

describe('AdtCdsUnitTest.validate()', () => {
  it('validates the generated class name — the name check alone', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/oo/validation/objectname');
      expect(r.url).toContain('objname=ZCL_CDS_DUMMY');
      return { status: 200, data: '<name-ok/>' };
    });
    const h = new AdtCdsUnitTest(conn, createLibraryLogger());

    const verdict = expectResult(
      await h.validate({
        className: 'ZCL_CDS_DUMMY',
        packageName: 'ZPKG',
        classTemplate: '<template/>',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
      'validation',
    );

    expect(calls).toHaveLength(1);
    expect(verdict).toBe('<name-ok/>');
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

    const failure = expectFailure(
      await h.validate({
        className: 'BOGUS NAME',
        // Required since the endpoint was measured to demand it. Without it the
        // handler's own guard throws first and this test would pass while
        // proving the opposite of what it is named for: no request would be
        // sent, and the server's rejection is the thing under test.
        packageName: 'ZPKG',
        classTemplate: '<template/>',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
      'validate a name the server rejects',
    );

    // The status is on `response`, where the answer it came on is — not on
    // invented fields beside the message.
    expect(failure.response?.status).toBe(400);
    expect(failure.message).toContain('invalid object name');
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
  it('falls back to the parent when no class is being generated', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/oo/validation/objectname');
      return { status: 200, data: '<name-ok/>' };
    });
    const h = new AdtCdsUnitTest(conn, createLibraryLogger());

    const verdict = expectResult(
      await h.validate({ className: 'ZCL_CONTAINER', packageName: 'ZPKG' }),
      'validation',
    );

    expect(calls).toHaveLength(1);
    expect(verdict).toBe('<name-ok/>');
  });
});
