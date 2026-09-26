import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getInterfaceVersions } from '../../core/interface/versions';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZIF (INTF)</atom:title><atom:entry><atom:content type="text/plain" src="/sap/bc/adt/oo/interfaces/zif/source/main/versions/1/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(handler: (o: any) => Promise<IAdtWireResponse>): IAbapConnection {
  return { makeAdtRequest: handler } as unknown as IAbapConnection;
}

describe('getInterfaceVersions', () => {
  it('builds the interface source/main/versions URL with the feed Accept, and answers the feed', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtWireResponse;
    });
    const answer = await getInterfaceVersions(c, { interfaceName: 'ZIF' });
    expect(seen.url).toBe('/sap/bc/adt/oo/interfaces/ZIF/source/main/versions');
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    // The feed as it arrived — `objectVersions` in adt-strategies reads it.
    expect(answer.data).toBe(FEED);
  });

  it('lets a 406 through as the transport raised it, not as a library error', async () => {
    const err: any = new Error('not acceptable');
    err.response = { status: 406 };
    const c = conn(async () => {
      throw err;
    });
    // A system without the resource said so; the member hands that to the
    // caller's analyse (`analyseUnsupportedStatus([404, 406], …)` names it).
    await expect(
      getInterfaceVersions(c, { interfaceName: 'ZIF' }),
    ).rejects.toBe(err);
  });
});
