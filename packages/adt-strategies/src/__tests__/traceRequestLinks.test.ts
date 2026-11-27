import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { traceSchedulingRequests } from '../results/traces';

/**
 * C6 of #304: the trace file link is found without a type predicate. An empty
 * `href` still counts as none, and the first non-empty one is taken, as before.
 */
const TRACEFILE =
  'http://www.sap.com/adt/relations/runtime/traces/abaptraces/tracefile';
const feed = (links: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data:
    '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x">' +
    `<atom:entry><atom:id>/r/1</atom:id>${links}<trc:extendedData/></atom:entry></atom:feed>`,
});

describe('the trace file of a stored request', () => {
  it('skips an empty href and takes the next', () => {
    const [entry] = traceSchedulingRequests(
      feed(
        `<atom:link href="" rel="${TRACEFILE}"/><atom:link href="/t/2" rel="${TRACEFILE}"/>`,
      ),
    );
    expect(entry?.traceUri).toBe('/t/2');
  });

  it('reads a link with no href, or none, as no trace file', () => {
    expect(
      traceSchedulingRequests(feed(`<atom:link rel="${TRACEFILE}"/>`))[0]
        ?.traceUri,
    ).toBeUndefined();
    expect(traceSchedulingRequests(feed(''))[0]?.traceUri).toBeUndefined();
  });

  it('ignores a link of another relation', () => {
    expect(
      traceSchedulingRequests(feed('<atom:link href="/t/3" rel="x/other"/>'))[0]
        ?.traceUri,
    ).toBeUndefined();
  });
});
