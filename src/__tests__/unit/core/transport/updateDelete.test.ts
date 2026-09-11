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
  it('issues exactly one PUT, to the item URL, carrying the document given', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    // The caller reads the request, patches the one mutable field, and passes
    // the whole document. Since 19.0.0 the read is theirs: a member that read
    // and wrote was two requests and a merge nobody outside could change.
    const edited = TRANSPORT_ITEM_XML.replace(
      /tm:desc="[^"]*"/,
      'tm:desc="New description"',
    );

    await new AdtRequest(connection).updateMetadata({
      transportNumber: 'TRLK900438',
      document: edited,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(ITEM_URL);
    expect(String(calls[0].data)).toContain('tm:desc="New description"');
    // Everything else the caller kept is still there — because they kept it.
    expect(String(calls[0].data)).toContain('tm:owner="CB9900000000"');
    expect(String(calls[0].data)).toContain('tm:number="TRLK900438"');
  });

  it('touches neither the collection nor the search-configuration endpoint', async () => {
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).updateMetadata({
      transportNumber: 'TRLK900438',
      description: 'New description',
    });

    for (const call of calls) {
      expect(call.url).not.toBe('/sap/bc/adt/cts/transportrequests');
      expect(call.url).not.toContain('searchconfiguration');
    }
  });

  it('sends what it was given, and judges none of it', async () => {
    // No guard on the document. A caller who passes nothing writes nothing, and
    // the server says what it thinks of that — this package does not answer for
    // it. What the caller must guarantee is that the document is valid.
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).updateMetadata({
      transportNumber: 'TRLK900438',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
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

  it('sends the delete with what it was given, and judges none of it', async () => {
    // No guard on the number since 19.0.0: the URL is built from what was
    // given and the server answers. A caller who names nothing gets the
    // server's words, which a strategy can read.
    const { connection, calls } = connectionOver(() => TRANSPORT_ITEM_XML);

    await new AdtRequest(connection).delete({});

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE');
  });
});
