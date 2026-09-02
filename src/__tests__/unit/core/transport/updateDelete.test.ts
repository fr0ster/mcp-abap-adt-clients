/**
 * `AdtRequest.update()` and `.delete()` used to throw "not supported" for both
 * operations. Both claims were false: ADT changes a request's description
 * (read-modify-write, like `AdtPackage`) and deletes an empty request via
 * `DELETE` on the item resource. This pins the request shape so neither stub
 * can silently come back.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtRequest } from '../../../../core/transport/AdtRequest';

const ITEM_URL = '/sap/bc/adt/cts/transportrequests/TRLK900438';

// A realistic single-item GET body — same attribute set and nesting the
// collection returns for one <tm:request> (captured shape, see
// transportTree.withTargets.xml), not an empty stand-in. An empty body is
// exactly the historical failure this read-modify-write approach guards
// against (ADT answers a not-yet-ready object with HTTP 200 and no content).
const TRANSPORT_ITEM_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<tm:request xmlns:tm="http://www.sap.com/cts/adt/tm" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom" ' +
  'tm:number="TRLK900438" tm:parent="" tm:owner="CB9900000000" ' +
  'tm:desc="Original description" tm:type="K" tm:status="D" tm:target="" ' +
  'tm:target_desc="" tm:cts_project="" tm:cts_project_desc="" ' +
  'tm:lastchanged_timestamp="20260811064450" ' +
  'tm:uri="/sap/bc/adt/vit/wb/object_type/%20%20%20%20rq/object_name/TRLK900438">' +
  '<tm:long_desc/>' +
  '<atom:link href="/sap/bc/adt/cts/transportrequests/TRLK900438" ' +
  'rel="http://www.sap.com/cts/relations/adturi" ' +
  'type="application/vnd.sap.adt.transportrequests.v1+xml" ' +
  'title="Transport Organizer ADT URI"/>' +
  '<tm:task tm:number="TRLK900439" tm:parent="TRLK900438" ' +
  'tm:owner="CB9900000000" tm:desc="Test" tm:type="Unclassified" ' +
  'tm:status="D" tm:target="" tm:target_desc="" tm:cts_project="" ' +
  'tm:cts_project_desc="" tm:lastchanged_timestamp="20260811064451" ' +
  'tm:uri="/sap/bc/adt/vit/wb/object_type/%20%20%20%20rq/object_name/TRLK900439">' +
  '<tm:long_desc/>' +
  '<atom:link href="/sap/bc/adt/cts/transportrequests/TRLK900439" ' +
  'rel="http://www.sap.com/cts/relations/adturi" ' +
  'type="application/vnd.sap.adt.transportrequests.v1+xml" ' +
  'title="Transport Organizer ADT URI"/>' +
  '</tm:task>' +
  '</tm:request>';

const connectionOver = (bodyFor: (url: string) => string) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: bodyFor(options.url),
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('AdtRequest.update()', () => {
  it('issues exactly GET then PUT, both to the item URL, with the new description in the PUT body', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).update({
      transportNumber: 'TRLK900438',
      description: 'New description',
    });

    expect(calls).toHaveLength(2);

    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(ITEM_URL);

    expect(calls[1].method).toBe('PUT');
    expect(calls[1].url).toBe(ITEM_URL);
    expect(String(calls[1].data)).toContain('tm:desc="New description"');
    // Every other field from the GET survives the patch — read-modify-write,
    // not a body rebuilt from scratch.
    expect(String(calls[1].data)).toContain('tm:owner="CB9900000000"');
    expect(String(calls[1].data)).toContain('tm:number="TRLK900438"');
  });

  it('touches neither the collection nor the search-configuration endpoint', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).update({
      transportNumber: 'TRLK900438',
      description: 'New description',
    });

    for (const call of calls) {
      expect(call.url).not.toBe('/sap/bc/adt/cts/transportrequests');
      expect(call.url).not.toContain('searchconfiguration');
    }
  });

  it('rejects without a description before any request goes out', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await expect(
      new AdtRequest(connection).update({ transportNumber: 'TRLK900438' }),
    ).rejects.toThrow(/description/i);

    expect(calls).toHaveLength(0);
  });

  it('rejects without a transport number before any request goes out', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await expect(
      new AdtRequest(connection).update({ description: 'New description' }),
    ).rejects.toThrow(/transport request number/i);

    expect(calls).toHaveLength(0);
  });
});

describe('AdtRequest.delete()', () => {
  it('issues exactly one DELETE to the item URL', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).delete({ transportNumber: 'TRLK900438' });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toBe(ITEM_URL);
  });

  it('touches neither the collection nor the search-configuration endpoint', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).delete({ transportNumber: 'TRLK900438' });

    for (const call of calls) {
      expect(call.url).not.toBe('/sap/bc/adt/cts/transportrequests');
      expect(call.url).not.toContain('searchconfiguration');
    }
  });

  it('rejects without a transport number before any request goes out', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await expect(new AdtRequest(connection).delete({})).rejects.toThrow(
      /transport request number/i,
    );

    expect(calls).toHaveLength(0);
  });
});
