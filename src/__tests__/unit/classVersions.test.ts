import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClass } from '../../core/class/AdtClass';
import { AdtLocalTypes } from '../../core/class/AdtLocalTypes';
import { getClassIncludeVersions } from '../../core/class/versions';
import { expectResult } from '../helpers/contract';

const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of ZCL (CLAS)</atom:title><atom:entry><atom:content type="text/plain" src="/sap/bc/adt/oo/classes/zcl/includes/main/versions/1/00000/content"/><atom:id>00000</atom:id></atom:entry></atom:feed>`;

function conn(handler: (o: any) => Promise<IAdtWireResponse>): IAbapConnection {
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
      return { data: FEED, status: 200, headers: {} } as IAdtWireResponse;
    });
    const cls = new AdtClass(c);
    const feed = expectResult(
      await cls.getVersions({ className: 'ZCL' }),
      'versions',
    );
    expect(seen.url).toBe('/sap/bc/adt/oo/classes/ZCL/includes/main/versions');
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    // The feed as it arrived — `objectVersions` in adt-strategies reads it.
    expect(feed).toBe(FEED);
  });

  it('AdtLocalTypes targets the implementations include', async () => {
    let seen: any;
    const c = conn(async (o) => {
      seen = o;
      return { data: FEED, status: 200, headers: {} } as IAdtWireResponse;
    });
    const local = new AdtLocalTypes(c);
    await local.getVersions({ className: 'ZCL' });
    expect(seen.url).toBe(
      '/sap/bc/adt/oo/classes/ZCL/includes/implementations/versions',
    );
  });

  it('lets a 404 through as the transport raised it, not as a library error', async () => {
    const err: any = new Error('not found');
    err.response = { status: 404 };
    const c = conn(async () => {
      throw err;
    });
    // A system without the resource said so; the member hands that to the
    // caller's analyse (`analyseUnsupportedStatus([404, 406], …)` names it).
    await expect(getClassIncludeVersions(c, 'ZCL', 'main')).rejects.toBe(err);
  });

  it('the member answers that 404 as a connection failure carrying the response', async () => {
    const c = conn(async () => {
      const err: any = new Error('not found');
      err.response = { status: 404, data: '', headers: {} };
      throw err;
    });
    const answer = await new AdtClass(c).getVersions({ className: 'ZCL' });
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.getError().origin).toBe('connection');
      expect(answer.getError().response?.status).toBe(404);
    }
  });
});
