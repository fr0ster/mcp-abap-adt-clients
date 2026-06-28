import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  getTableVersionSource,
  getTableVersions,
} from '../../core/table/versions';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZT (TABL)</atom:title><atom:entry><atom:content type="text/plain" src="/sap/bc/adt/ddic/tables/zt/source/main/versions/1/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(handler: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return { makeAdtRequest: handler } as unknown as IAbapConnection;
}

describe('getTableVersions', () => {
  it('GETs source/main/versions with the atom-feed Accept and parses it', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtResponse;
    });
    const list = await getTableVersions(c, { tableName: 'ZT' });
    expect(seen.url).toBe('/sap/bc/adt/ddic/tables/ZT/source/main/versions');
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    expect(list).toHaveLength(1);
    expect(list[0].contentUri).toContain('/00000/content');
  });

  it('translates a 404 into UNSUPPORTED_OPERATION (no raw HTTP outward)', async () => {
    expect.assertions(1);
    const c = conn(async () => {
      const err: any = new Error('not found');
      err.response = { status: 404 };
      throw err;
    });
    await expect(
      getTableVersions(c, { tableName: 'ZT' }),
    ).rejects.toMatchObject({ code: 'ADT_UNSUPPORTED_OPERATION' });
  });
});

describe('getTableVersionSource', () => {
  it('GETs the opaque contentUri as text/plain', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return {
        data: 'DEFINE TABLE zt ...',
        status: 200,
        headers: {},
      } as IAdtResponse;
    });
    const src = await getTableVersionSource(c, '/sap/bc/adt/x/00000/content');
    expect(seen.url).toBe('/sap/bc/adt/x/00000/content');
    expect(seen.headers.Accept).toBe('text/plain');
    expect(src).toContain('DEFINE TABLE');
  });
});
