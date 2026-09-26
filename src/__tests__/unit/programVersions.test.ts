import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  getProgramVersionSource,
  getProgramVersions,
} from '../../core/program/versions';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZPROG (PROG)</atom:title><atom:entry><atom:content type="text/plain" src="/sap/bc/adt/programs/programs/zprog/source/main/versions/1/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(handler: (o: any) => Promise<IAdtWireResponse>): IAbapConnection {
  return { makeAdtRequest: handler } as unknown as IAbapConnection;
}

describe('getProgramVersions', () => {
  it('GETs source/main/versions with the atom-feed Accept, and answers the feed', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtWireResponse;
    });
    const answer = await getProgramVersions(c, { programName: 'ZPROG' });
    expect(seen.url).toBe(
      '/sap/bc/adt/programs/programs/ZPROG/source/main/versions',
    );
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    // The feed as it arrived — `objectVersions` in adt-strategies reads it.
    expect(answer.data).toBe(FEED);
  });

  it('lets a 404 through as the transport raised it, not as a library error', async () => {
    const err: any = new Error('not found');
    err.response = { status: 404 };
    const c = conn(async () => {
      throw err;
    });
    // A system without the resource said so; the member hands that to the
    // caller's analyse (`analyseUnsupportedStatus([404, 406], …)` names it).
    await expect(getProgramVersions(c, { programName: 'ZPROG' })).rejects.toBe(
      err,
    );
  });
});

describe('getProgramVersionSource', () => {
  it('GETs the opaque contentUri as text/plain', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return {
        data: 'REPORT zprog.',
        status: 200,
        headers: {},
      } as IAdtWireResponse;
    });
    const answer = await getProgramVersionSource(
      c,
      '/sap/bc/adt/x/00000/content',
    );
    expect(seen.url).toBe('/sap/bc/adt/x/00000/content');
    expect(seen.headers.Accept).toBe('text/plain');
    expect(String(answer.data)).toContain('REPORT');
  });
});
