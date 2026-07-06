import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtClass } from '../../core/class/AdtClass';
import { AdtLocalTypes } from '../../core/class/AdtLocalTypes';
import { getClassIncludeVersions } from '../../core/class/versions';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZCL (CLAS)</atom:title><atom:entry><atom:content type="text/plain" src="/sap/bc/adt/oo/classes/zcl/includes/main/versions/1/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(handler: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return {
    makeAdtRequest: handler,
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('getClassIncludeVersions', () => {
  it('targets the main include by default via AdtClass.getVersions', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtResponse;
    });
    const cls = new AdtClass(c);
    const list = await cls.getVersions({ className: 'ZCL' });
    expect(seen.url).toBe('/sap/bc/adt/oo/classes/ZCL/includes/main/versions');
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    expect(list).toHaveLength(1);
  });

  it('AdtLocalTypes targets the implementations include', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtResponse;
    });
    const local = new AdtLocalTypes(c);
    await local.getVersions({ className: 'ZCL' });
    expect(seen.url).toBe(
      '/sap/bc/adt/oo/classes/ZCL/includes/implementations/versions',
    );
  });

  it('translates a 404 into UNSUPPORTED_OPERATION', async () => {
    expect.assertions(1);
    const c = conn(async () => {
      const err: any = new Error('not found');
      err.response = { status: 404 };
      throw err;
    });
    await expect(
      getClassIncludeVersions(c, 'ZCL', 'main'),
    ).rejects.toMatchObject({ code: 'ADT_UNSUPPORTED_OPERATION' });
  });
});
