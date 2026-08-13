/**
 * Pins that validate() on AdtUnitTest and AdtCdsUnitTest performs real checks
 * instead of the self-declared "mock success response" AdtUnitTest.validate()
 * used to return unconditionally (with AdtCdsUnitTest inheriting it).
 *
 * What gets checked depends on what is actually created:
 * - AdtUnitTest: the container class already exists (a run does not create
 *   it), so validate() confirms it is there. IUnitTestConfig carries the
 *   local test class only by name, never its source, so the code check
 *   (checkClassLocalTestClass) cannot be wired in from this config.
 * - AdtCdsUnitTest: create() also builds a brand-new global dummy class, so
 *   validate() checks both: the new name (validateClassName) and the local
 *   test class code it puts inside it (checkClassLocalTestClass).
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtCdsUnitTest } from '../../../../core/unitTest/AdtCdsUnitTest';
import { AdtUnitTest } from '../../../../core/unitTest/AdtUnitTest';

interface RecordedCall {
  url: string;
  method?: string;
  data?: unknown;
}

function makeConn(
  handler: (
    r: RecordedCall,
    callIndex: number,
  ) => Partial<IAdtResponse> | Error,
) {
  const calls: RecordedCall[] = [];
  let callIndex = 0;
  const conn = {
    makeAdtRequest: async (r: {
      url: string;
      method?: string;
      data?: unknown;
    }): Promise<IAdtResponse> => {
      const call: RecordedCall = { url: r.url, method: r.method, data: r.data };
      calls.push(call);
      const res = handler(call, callIndex++);
      if (res instanceof Error) throw res;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
        ...res,
      } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtUnitTest.validate()', () => {
  it('rejects before any request when no tests are defined (zero calls)', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const h = new AdtUnitTest(conn);

    await expect(h.validate({ tests: [] })).rejects.toThrow(
      /at least one test definition/i,
    );
    expect(calls).toHaveLength(0);
  });

  it('confirms the container class exists and reports the read result (one request)', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('GET');
      expect(r.url).toBe('/sap/bc/adt/oo/classes/ZCL_CONTAINER/source/main');
      return { status: 200, data: 'CLASS zcl_container DEFINITION.' };
    });
    const h = new AdtUnitTest(conn);

    const state = await h.validate({
      tests: [{ containerClass: 'ZCL_CONTAINER', testClass: 'LTCL_TEST' }],
    });

    expect(calls).toHaveLength(1);
    expect(state.errors).toEqual([]);
    expect(state.validationResponse?.data).toBe(
      'CLASS zcl_container DEFINITION.',
    );
  });

  it('a container class that does not exist rejects (not an empty success)', async () => {
    const { conn, calls } = makeConn(() =>
      Object.assign(new Error('not found'), {
        response: { status: 404, statusText: 'Not Found', data: '' },
      }),
    );
    const h = new AdtUnitTest(conn);

    await expect(
      h.validate({
        tests: [{ containerClass: 'ZCL_MISSING', testClass: 'LTCL_TEST' }],
      }),
    ).rejects.toMatchObject({ code: 'ADT_OBJECT_NOT_FOUND', status: 404 });
    expect(calls).toHaveLength(1);
  });
});

describe('AdtCdsUnitTest.validate()', () => {
  it('rejects before any request when neither a new class nor tests are given (zero calls)', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const h = new AdtCdsUnitTest(conn);

    await expect(h.validate({})).rejects.toThrow(
      /at least one test definition/i,
    );
    expect(calls).toHaveLength(0);
  });

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
    const h = new AdtCdsUnitTest(conn);

    const state = await h.validate({
      className: 'ZCL_CDS_DUMMY',
      packageName: 'ZPKG',
      classTemplate: '<template/>',
      testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
    });

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
    const h = new AdtCdsUnitTest(conn);

    await expect(
      h.validate({
        className: 'BOGUS NAME',
        classTemplate: '<template/>',
        testClassSource: 'CLASS ltcl_test DEFINITION FOR TESTING.',
      }),
    ).rejects.toMatchObject({ code: 'ADT_VALIDATION_FAILED', status: 400 });
    expect(calls).toHaveLength(1);
  });

  it('falls back to the parent check (container existence) for a plain test run', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('GET');
      expect(r.url).toBe('/sap/bc/adt/oo/classes/ZCL_CONTAINER/source/main');
      return { status: 200, data: 'CLASS zcl_container DEFINITION.' };
    });
    const h = new AdtCdsUnitTest(conn);

    const state = await h.validate({
      tests: [{ containerClass: 'ZCL_CONTAINER', testClass: 'LTCL_TEST' }],
    });

    expect(calls).toHaveLength(1);
    expect(state.errors).toEqual([]);
  });
});
