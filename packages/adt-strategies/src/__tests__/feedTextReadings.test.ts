import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { feedDescriptors, feedEntries } from '../results/feeds';

/**
 * The feed readings read text as written and every repeated Atom element
 * (0.28.0).
 *
 * `FEED_LIST` is the cut of an on-premise system's `GET /sap/bc/adt/feeds`
 * (2026-09-26) the server team keeps in `fr0ster/mcp-abap-adt`
 * `src/__tests__/unit/runtimeReadersFixRound1.test.ts` (`feedListXml`), the
 * user replaced by `SAPUSER01`. The adt-clients corpus records no feed. The
 * other documents are written from it, and say what they change.
 */
const answer = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

const FEED_LIST =
  '<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">' +
  '<atom:entry><atom:id>/sap/bc/adt/runtime/dumps</atom:id><atom:title>ABAP Runtime Errors</atom:title>' +
  '<feed:extendedData xmlns:feed="http://www.sap.com/adt/feeds"><feed:queryVariants>' +
  '<feed:queryVariant queryString="and ( equals ( user , SAPUSER01 ) )" title="Runtime Errors caused by me (SAPUSER01)" isDefault="true"/>' +
  '<feed:queryVariant queryString="and ( equals ( responsible , SAPUSER01 ) )" title="Runtime Errors for objects I am responsible for (SAPUSER01)" isDefault="false"/>' +
  '</feed:queryVariants></feed:extendedData></atom:entry>' +
  '<atom:entry><atom:id>/sap/bc/adt/runtime/systemmessages</atom:id><atom:title>ABAP System Messages</atom:title>' +
  '<feed:extendedData xmlns:feed="http://www.sap.com/adt/feeds"/></atom:entry>' +
  '</atom:feed>';

describe('feed readings keep text as written', () => {
  it('reads the recorded feed list', () => {
    expect(
      feedDescriptors(answer(FEED_LIST)).map((d) => [d.id, d.title]),
    ).toEqual([
      ['/sap/bc/adt/runtime/dumps', 'ABAP Runtime Errors'],
      ['/sap/bc/adt/runtime/systemmessages', 'ABAP System Messages'],
    ]);
  });

  // Written: the first title replaced by digits with leading zeros.
  it('keeps numeric text as written — 0042 is not 42', () => {
    const numeric = FEED_LIST.replace(
      '<atom:title>ABAP Runtime Errors</atom:title>',
      '<atom:title>0042</atom:title>',
    );
    expect(feedDescriptors(answer(numeric))[0].title).toBe('0042');
  });

  // Written: the first entry given two links, `self` first, and an escaped `&`.
  it('reads the entry’s own link among several, its references decoded', () => {
    const linked = FEED_LIST.replace(
      '<atom:title>ABAP Runtime Errors</atom:title>',
      '<atom:title>ABAP Runtime Errors</atom:title>' +
        '<atom:link rel="self" href="/sap/bc/adt/feeds/self"/>' +
        '<atom:link href="/sap/bc/adt/runtime/dumps?$top=100&amp;to=20260930043748"/>',
    );
    expect(feedDescriptors(answer(linked))[0].url).toBe(
      '/sap/bc/adt/runtime/dumps?$top=100&to=20260930043748',
    );
  });

  // Written: an entry with two authors and two categories reads the first.
  it('reads the first of several authors and categories', () => {
    const entry = feedEntries(
      answer(
        '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>e</id><title>t</title>' +
          '<author><name>SAPUSER01</name></author><author><name>SAPUSER02</name></author>' +
          '<category term="dump"/><category term="other"/></entry></feed>',
      ),
    )[0];
    expect([entry.author, entry.category]).toEqual(['SAPUSER01', 'dump']);
  });
});
