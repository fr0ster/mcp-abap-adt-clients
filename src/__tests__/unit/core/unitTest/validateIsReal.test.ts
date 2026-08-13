/**
 * Pins that AdtUnitTest.validate() performs real server-side validation
 * (AdtClass's pattern: POST to the object-name validation endpoint) instead
 * of the self-declared "mock success response" it used to return.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtUnitTest } from '../../../../core/unitTest/AdtUnitTest';

function makeConn(handler: (r: any) => Partial<IAdtResponse> | Error) {
  const calls: Array<{
    url: string;
    method?: string;
    headers?: Record<string, string>;
  }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ url: r.url, method: r.method, headers: r.headers });
      const res = handler(r);
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

  it('issues a real request and reports the server response on success', async () => {
    const { conn, calls } = makeConn((r) => {
      expect(r.method).toBe('POST');
      expect(r.url).toContain('/sap/bc/adt/oo/validation/objectname');
      expect(r.url).toContain('objname=ZCL_CONTAINER');
      return { status: 200, data: '<ok/>' };
    });
    const h = new AdtUnitTest(conn);

    const state = await h.validate({
      tests: [{ containerClass: 'ZCL_CONTAINER', testClass: 'LTCL_TEST' }],
    });

    expect(calls).toHaveLength(1);
    expect(state.errors).toEqual([]);
    expect(state.validationResponse?.data).toBe('<ok/>');
  });

  it('a name the server rejects produces an error, not an empty success', async () => {
    const { conn, calls } = makeConn(() =>
      Object.assign(new Error('invalid object name'), {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: 'Object name is not valid',
        },
      }),
    );
    const h = new AdtUnitTest(conn);

    await expect(
      h.validate({
        tests: [{ containerClass: 'BOGUS NAME', testClass: 'LTCL_TEST' }],
      }),
    ).rejects.toMatchObject({ code: 'ADT_VALIDATION_FAILED', status: 400 });
    expect(calls).toHaveLength(1);
  });
});
