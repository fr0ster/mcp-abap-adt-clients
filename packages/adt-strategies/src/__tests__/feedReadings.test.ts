import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  feedDescriptors,
  feedEntries,
  feedGatewayErrorDetail,
  feedGatewayErrors,
  feedSystemMessages,
  feedVariants,
} from '../results/feeds';

/**
 * The Atom feed readings, moved from adt-clients where they were
 * `FeedRepository`'s defaults. The entry cases came with them
 * (`FeedRepository.test.ts`); the others pin what each reading takes from an
 * entry, and that a body with nothing to read reads as nothing.
 */
const answer = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

const ENTRY = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>entry1</id>
    <title>Test Entry</title>
    <updated>2026-04-10T10:00:00Z</updated>
    <link href="/sap/bc/adt/runtime/dumps/DUMP1"/>
    <content>Some content</content>
    <author><name>TESTUSER</name></author>
    <category term="dump"/>
  </entry>
</feed>`;

const EMPTY = '<feed xmlns="http://www.w3.org/2005/Atom"></feed>';

describe('feedEntries', () => {
  it('reads an Atom entry into its fields', () => {
    expect(feedEntries(answer(ENTRY))).toEqual([
      {
        id: 'entry1',
        title: 'Test Entry',
        updated: '2026-04-10T10:00:00Z',
        link: '/sap/bc/adt/runtime/dumps/DUMP1',
        content: 'Some content',
        author: 'TESTUSER',
        category: 'dump',
      },
    ]);
  });

  it('reads a feed with no entries as none — an answer, not a failure', () => {
    expect(feedEntries(answer(EMPTY))).toEqual([]);
  });
});

describe('the other feed readings', () => {
  it('feedDescriptors takes id, title, url and category', () => {
    expect(feedDescriptors(answer(ENTRY))).toEqual([
      {
        id: 'entry1',
        title: 'Test Entry',
        url: '/sap/bc/adt/runtime/dumps/DUMP1',
        category: 'dump',
      },
    ]);
  });

  it('feedVariants takes id, title and url', () => {
    expect(feedVariants(answer(ENTRY))).toEqual([
      {
        id: 'entry1',
        title: 'Test Entry',
        url: '/sap/bc/adt/runtime/dumps/DUMP1',
      },
    ]);
  });

  it('feedSystemMessages reads the content as the text and the category as severity', () => {
    expect(feedSystemMessages(answer(ENTRY))).toEqual([
      {
        id: 'entry1',
        title: 'Test Entry',
        text: 'Some content',
        severity: 'dump',
        validFrom: '2026-04-10T10:00:00Z',
        validTo: '',
        createdBy: 'TESTUSER',
      },
    ]);
  });

  it('feedGatewayErrors reads the category as the type and the id as the transaction', () => {
    expect(feedGatewayErrors(answer(ENTRY))).toMatchObject([
      {
        type: 'dump',
        shortText: 'Test Entry',
        transactionId: 'entry1',
        dateTime: '2026-04-10T10:00:00Z',
        username: 'TESTUSER',
      },
    ]);
  });

  it('feedGatewayErrorDetail reads an empty document as empty fields', () => {
    const detail = feedGatewayErrorDetail(answer(''));
    expect(detail.shortText).toBe('');
    expect(detail.callStack).toEqual([]);
  });

  it('reads a body that is not XML, or none, as nothing — never a throw', () => {
    for (const reading of [
      feedEntries,
      feedDescriptors,
      feedVariants,
      feedSystemMessages,
      feedGatewayErrors,
    ]) {
      expect(reading(answer(''))).toEqual([]);
      expect(() => reading(answer('not xml <'))).not.toThrow();
    }
  });
});
