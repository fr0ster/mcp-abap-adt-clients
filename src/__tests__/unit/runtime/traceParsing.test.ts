/**
 * The trace parsers refuse to invent an empty result.
 *
 * Review found that an unparseable body, or a document with an unexpected root,
 * became `{ entries: [] }` — indistinguishable from a genuinely empty trace, and
 * satisfied by the `Array.isArray` assertion the integration tests used. That
 * matters more here than it would elsewhere: the module itself states that the
 * feed's exact nesting was never read end to end, so "the shape is not what we
 * expect" is a live possibility, not a theoretical one.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  compareRecordedAt,
  parseDbAccesses,
  parseHitList,
  parseNamedItems,
  parseStatements,
  parseTraceEntries,
  parseTraceRequests,
  TraceDocumentError,
} from '../../../runtime/traces/traceParsing';

const response = (data: string, status = 200): IAdtResponse =>
  ({ data, status, statusText: 'OK', headers: {} }) as IAdtResponse;

const PARSERS: Array<[string, (r: IAdtResponse) => unknown]> = [
  ['parseTraceEntries', parseTraceEntries],
  ['parseHitList', parseHitList],
  ['parseStatements', parseStatements],
  ['parseDbAccesses', parseDbAccesses],
  ['parseNamedItems', parseNamedItems],
];

describe('trace document parsing', () => {
  describe.each(PARSERS)('%s', (_name, parse) => {
    it('throws on an empty body instead of reporting an empty result', () => {
      // ADT answers 200 with an empty body when a resource is not ready.
      expect(() => parse(response(''))).toThrow(TraceDocumentError);
    });

    it('throws on unparseable XML', () => {
      expect(() => parse(response('<hitlist><entry'))).toThrow(
        TraceDocumentError,
      );
    });

    it('throws on a well-formed document with the wrong root', () => {
      // The realistic case: a valid ADT answer of a different shape, or an
      // error document served with a 200.
      expect(() =>
        parse(response('<?xml version="1.0"?><exc:exception xmlns:exc="x"/>')),
      ).toThrow(TraceDocumentError);
    });
  });

  it('names what it got, so the reader is not left guessing', () => {
    try {
      parseHitList(response('<?xml version="1.0"?><statements/>'));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TraceDocumentError);
      expect((error as Error).message).toContain('<hitlist>');
      expect((error as Error).message).toContain('<statements>');
    }
  });

  describe('a recognised root with unrecognised rows is not an empty result', () => {
    it('throws when a hit list has children under an unexpected name', () => {
      // The live risk: the row schema of the three views was never confirmed
      // against a raw capture, so a wrong guess must be audible.
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:row trc:index="1"/></trc:hitlist>',
          ),
        ),
      ).toThrow(/expected <entry> rows, found <row>/);
    });

    it('throws when statements have children under an unexpected name', () => {
      expect(() =>
        parseStatements(
          response(
            '<?xml version="1.0"?><trc:statements xmlns:trc="x"><trc:stmt trc:id="1"/></trc:statements>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('throws when db accesses have children under an unexpected name', () => {
      expect(() =>
        parseDbAccesses(
          response(
            '<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"><trc:access trc:index="1"/></trc:dbAccesses>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('throws when a catalogue has children under an unexpected name', () => {
      expect(() =>
        parseNamedItems(
          response(
            '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:item/></nameditem:namedItemList>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('throws when a feed has entries whose ids are unreadable', () => {
      // Reporting a full feed as "no traces" is the failure this prevents.
      expect(() =>
        parseTraceEntries(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:id>urn:something:else</atom:id></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(/is missing a recognisable trace id/);
    });

    it('still reads a feed whose entries are recognisable', () => {
      const entries = parseTraceEntries(
        response(
          '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published></atom:entry></atom:feed>',
        ),
      );
      expect(entries).toHaveLength(1);
      expect(entries[0]?.recordedAt).toBe('2026-08-28T10:00:00Z');
    });
  });

  describe('a recognised row with a missing required field is not a row', () => {
    it('refuses an empty <statement/> instead of inventing id and index', () => {
      // The fabrication that survived every earlier guard: `id: ''`,
      // `index: 0` — a row that was never in the document, and one that
      // `typeof id === 'string'` happily confirms.
      expect(() =>
        parseStatements(
          response(
            '<?xml version="1.0"?><trc:statements xmlns:trc="x"><trc:statement/></trc:statements>',
          ),
        ),
      ).toThrow(/is missing an id/);
    });

    it('refuses a hit list entry with no index', () => {
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:hitCount="3"/></trc:hitlist>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('refuses a db access with no index', () => {
      expect(() =>
        parseDbAccesses(
          response(
            '<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"><trc:dbAccess trc:tableName="T000"/></trc:dbAccesses>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('refuses a catalogue item with no description', () => {
      expect(() =>
        parseNamedItems(
          response(
            '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:name>/x</nameditem:name></nameditem:namedItem></nameditem:namedItemList>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('accepts a present-but-empty value — emptiness is not absence', () => {
      const items = parseNamedItems(
        response(
          '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:name>/x</nameditem:name><nameditem:description/></nameditem:namedItem></nameditem:namedItemList>',
        ),
      );
      expect(items).toEqual([{ name: '/x', description: '' }]);
    });

    it('drops no entry silently: one unreadable entry among readable ones throws', () => {
      // Previously only an all-unreadable feed threw, so a feed of ten traces
      // could come back as nine with nothing said.
      expect(() =>
        parseTraceEntries(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom">' +
              '<atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published></atom:entry>' +
              '<atom:entry><atom:id>urn:not:a:trace</atom:id></atom:entry>' +
              '</atom:feed>',
          ),
        ),
      ).toThrow(/position 1/);
    });

    it('refuses a program reference with only some of name/type/uri', () => {
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"><trc:callingProgram adtcore:name="ZX" xmlns:adtcore="y"/></trc:entry></trc:hitlist>',
          ),
        ),
      ).toThrow(/only some of name\/type\/uri/);
    });
  });

  describe('a present element that cannot be read is not an absent one', () => {
    it('refuses a self-closing <callingProgram/>', () => {
      // It parses to the empty string, so a `typeof !== object` test read it as
      // missing and dropped it without a word.
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"><trc:callingProgram/></trc:entry></trc:hitlist>',
          ),
        ),
      ).toThrow(/program reference is present/);
    });

    it('refuses a callingProgram whose children are unexpected', () => {
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"><trc:callingProgram><trc:unexpected/></trc:callingProgram></trc:entry></trc:hitlist>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('still accepts a row with no program reference at all', () => {
      // Absence is the property not being there; that is legitimate.
      const parsed = parseHitList(
        response(
          '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"/></trc:hitlist>',
        ),
      );
      expect(parsed.entries[0]?.callingProgram).toBeUndefined();
    });

    it('refuses an accessTime that carries none of its four members', () => {
      expect(() =>
        parseDbAccesses(
          response(
            '<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"><trc:dbAccess trc:index="1"><trc:accessTime/></trc:dbAccess></trc:dbAccesses>',
          ),
        ),
      ).toThrow(/<accessTime> element is present/);
    });

    it('refuses a state element with no value', () => {
      expect(() =>
        parseTraceEntries(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published><trc:state/></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(/state element with no value/);
    });

    it('still accepts an entry with no state at all', () => {
      const entries = parseTraceEntries(
        response(
          '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published></atom:entry></atom:feed>',
        ),
      );
      expect(entries[0]?.state).toBeUndefined();
    });
  });

  describe('a boolean is never invented from silence', () => {
    const scheduleEntry = (extended: string) =>
      response(
        '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id><trc:extendedData>' +
          extended +
          '</trc:extendedData></atom:entry></atom:feed>',
      );

    it('leaves isAggregated undefined when the field is absent', () => {
      // `=== 'true'` answered `false`, which claims aggregation was off on the
      // strength of the document not mentioning it.
      const [entry] = parseTraceRequests(
        scheduleEntry('<trc:description>-</trc:description>'),
      );
      expect(entry?.isAggregated).toBeUndefined();
    });

    it('reads both conventions', () => {
      expect(
        parseTraceRequests(
          scheduleEntry('<trc:isAggregated>true</trc:isAggregated>'),
        )[0]?.isAggregated,
      ).toBe(true);
      expect(
        parseTraceRequests(
          scheduleEntry('<trc:isAggregated>false</trc:isAggregated>'),
        )[0]?.isAggregated,
      ).toBe(false);
      expect(
        parseTraceRequests(
          scheduleEntry('<trc:isAggregated>X</trc:isAggregated>'),
        )[0]?.isAggregated,
      ).toBe(true);
    });

    it('refuses a value that is neither', () => {
      expect(() =>
        parseTraceRequests(
          scheduleEntry('<trc:isAggregated>unexpected</trc:isAggregated>'),
        ),
      ).toThrow(/neither a boolean/);
    });

    it('refuses an unrecognised statement flag rather than reading it as false', () => {
      expect(() =>
        parseStatements(
          response(
            '<?xml version="1.0"?><trc:statements xmlns:trc="x"><trc:statement trc:id="1" trc:index="1" trc:isProcedureLike="maybe"/></trc:statements>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });
  });

  describe('the schedule treats nested elements the same way', () => {
    const scheduled = (extended: string) =>
      response(
        '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id><trc:extendedData>' +
          extended +
          '</trc:extendedData></atom:entry></atom:feed>',
      );

    it('refuses a self-closing <executions/>', () => {
      expect(() => parseTraceRequests(scheduled('<trc:executions/>'))).toThrow(
        /<executions> element is present/,
      );
    });

    it('refuses <executions> with unexpected children', () => {
      expect(() =>
        parseTraceRequests(
          scheduled('<trc:executions><trc:unexpected/></trc:executions>'),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('refuses a present <processType/> with no id', () => {
      expect(() => parseTraceRequests(scheduled('<trc:processType/>'))).toThrow(
        /<processType> element is present/,
      );
    });

    it('refuses a present <object/> with no id', () => {
      expect(() => parseTraceRequests(scheduled('<trc:object/>'))).toThrow(
        /<object> element is present/,
      );
    });

    it('reads them when they carry what they should', () => {
      const [entry] = parseTraceRequests(
        scheduled(
          '<trc:processType trc:processTypeId="/p/any"/><trc:object trc:objectTypeId="/o/any"/><trc:executions trc:maximal="1" trc:completed="1"/>',
        ),
      );
      expect(entry?.processTypeId).toBe('/p/any');
      expect(entry?.objectTypeId).toBe('/o/any');
      expect(entry?.executions).toEqual({ maximal: 1, completed: 1 });
    });

    it('accepts their absence', () => {
      const [entry] = parseTraceRequests(
        scheduled('<trc:description>-</trc:description>'),
      );
      expect(entry?.processTypeId).toBeUndefined();
      expect(entry?.objectTypeId).toBeUndefined();
      expect(entry?.executions).toBeUndefined();
    });

    it('refuses a present-but-empty <extendedData/>', () => {
      // This test previously asserted the opposite — that the empty container
      // parsed fine — while its own comment described the vanishing fields as
      // the defect. A test that pins the fault it documents is worse than none.
      expect(() =>
        parseTraceRequests(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id><trc:extendedData/></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(/<extendedData> element carrying none of/);
    });

    it('refuses an <extendedData> whose children are all unexpected', () => {
      expect(() =>
        parseTraceRequests(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id><trc:extendedData><trc:unexpected/></trc:extendedData></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('accepts an entry with no extendedData at all', () => {
      // Absence of optional metadata is legitimate; a present container that
      // says nothing is not.
      const [entry] = parseTraceRequests(
        response(
          '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id></atom:entry></atom:feed>',
        ),
      );
      expect(entry?.id).toBe('/sap/bc/adt/x/1');
      expect(entry?.description).toBeUndefined();
    });
  });

  describe('the trace feed treats extendedData the same way', () => {
    const feedEntry = (extra: string) =>
      response(
        '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published>' +
          extra +
          '</atom:entry></atom:feed>',
      );

    it('refuses a present-but-empty <extendedData/>', () => {
      expect(() => parseTraceEntries(feedEntry('<trc:extendedData/>'))).toThrow(
        /<extendedData> element carrying none of/,
      );
    });

    it('accepts an entry with no extendedData at all', () => {
      const entries = parseTraceEntries(feedEntry(''));
      expect(entries).toHaveLength(1);
      expect(entries[0]?.user).toBeUndefined();
    });

    it('accepts an empty extendedData when the fields sit on the entry', () => {
      // Which of the two nestings is real is the one thing this file does not
      // claim to know, so the check must not decide it.
      const entries = parseTraceEntries(
        feedEntry('<trc:extendedData/><trc:user>SOMEONE</trc:user>'),
      );
      expect(entries[0]?.user).toBe('SOMEONE');
    });
  });

  describe('a number is never dropped for being unreadable', () => {
    it('refuses a non-numeric hitCount instead of reporting no hit count', () => {
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1" trc:hitCount="unexpected"/></trc:hitlist>',
          ),
        ),
      ).toThrow(/not a finite number/);
    });

    it('refuses Infinity, which is not NaN and would otherwise pass', () => {
      expect(() =>
        parseHitList(
          response(
            '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1" trc:hitCount="Infinity"/></trc:hitlist>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('refuses a partly unreadable <executions>, which readAll alone let pass', () => {
      // `completed` parses, so the container looked understood; `maximal` did
      // not, and vanished.
      expect(() =>
        parseTraceRequests(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id><trc:extendedData><trc:executions trc:maximal="unexpected" trc:completed="1"/></trc:extendedData></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('refuses an unreadable requestIndex', () => {
      expect(() =>
        parseTraceRequests(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/x/1</atom:id><trc:extendedData><trc:requestIndex>unexpected</trc:requestIndex></trc:extendedData></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(/not a finite number/);
    });

    it('still treats an absent optional number as absent', () => {
      const parsed = parseHitList(
        response(
          '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"/></trc:hitlist>',
        ),
      );
      expect(parsed.entries[0]?.hitCount).toBeUndefined();
    });

    it('reads a negative and a zero, which truthiness checks would lose', () => {
      const parsed = parseHitList(
        response(
          '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="0" trc:recursionDepth="-1"/></trc:hitlist>',
        ),
      );
      expect(parsed.entries[0]?.index).toBe(0);
      expect(parsed.entries[0]?.recursionDepth).toBe(-1);
    });
  });

  describe('timestamps are validated, and ordered as time', () => {
    const feedWith = (published: string) =>
      response(
        `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>${published}</atom:published></atom:entry></atom:feed>`,
      );

    it('refuses a published value that is not a timestamp', () => {
      // Carried as a string, it would sort above every real ISO timestamp and
      // be chosen as the newest trace.
      expect(() => parseTraceEntries(feedWith('unexpected'))).toThrow(
        /not an RFC 3339 date-time/,
      );
    });

    it('refuses an unparseable expiration', () => {
      expect(() =>
        parseTraceEntries(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published><trc:expiration>whenever</trc:expiration></atom:entry></atom:feed>',
          ),
        ),
      ).toThrow(TraceDocumentError);
    });

    it('orders by time, not by text, across UTC offsets', () => {
      // 09:00Z is LATER than 10:00+02:00 (08:00Z), and the strings say the
      // opposite. This is why `latestTraceId()` cannot compare them as strings.
      const earlier = { recordedAt: '2026-08-28T10:00:00+02:00' };
      const later = { recordedAt: '2026-08-28T09:00:00Z' };
      expect(later.recordedAt > earlier.recordedAt).toBe(false);
      expect(compareRecordedAt(later, earlier)).toBeGreaterThan(0);
    });

    it('orders correctly across differing fractional-second precision', () => {
      const a = { recordedAt: '2026-08-28T10:00:00.9Z' };
      const b = { recordedAt: '2026-08-28T10:00:00.100Z' };
      expect(b.recordedAt > a.recordedAt).toBe(false);
      expect(compareRecordedAt(a, b)).toBeGreaterThan(0);
    });

    it('orders beyond the millisecond, which Date.parse cannot', () => {
      // Both are 100ms to `Date.parse`, so a comparison through it calls them
      // equal and keeps whichever was seen first.
      const earlier = { recordedAt: '2026-08-28T10:00:00.1001Z' };
      const later = { recordedAt: '2026-08-28T10:00:00.1009Z' };
      expect(Date.parse(later.recordedAt)).toBe(Date.parse(earlier.recordedAt));
      expect(compareRecordedAt(later, earlier)).toBeGreaterThan(0);
    });

    it.each([
      ['2026-02-30T10:00:00Z', 'a day that does not exist'],
      ['2026-08-28', 'a date with no time'],
      ['2026-08-28T10:00:00', 'a time with no offset'],
      ['August 28, 2026', 'a human-readable date'],
      ['2026-08-28T25:00:00Z', 'an hour out of range'],
      ['2026-08-28T10:00:00+99:00', 'an offset out of range'],
    ])('refuses %s (%s), which Date.parse would accept or roll over', (raw) => {
      expect(() => parseTraceEntries(feedWith(raw))).toThrow(
        /not an RFC 3339 date-time/,
      );
    });

    it('accepts a real Atom timestamp with an offset', () => {
      const entries = parseTraceEntries(feedWith('2026-08-28T10:00:00+02:00'));
      expect(entries[0]?.recordedAt).toBe('2026-08-28T10:00:00+02:00');
    });

    it.each([
      ['2026-08-28t10:00:00Z', 'lowercase t'],
      ['2026-08-28T10:00:00z', 'lowercase z'],
      ['2026-08-28t10:00:00z', 'both lowercase'],
      ['1990-12-31T23:59:60Z', 'a leap second in UTC'],
      ['1990-12-31T15:59:60-08:00', "the RFC's own leap-second example"],
    ])('accepts %s (%s), which RFC 3339 permits', (raw) => {
      // Rejecting a legitimate Atom timestamp turns a working read into an
      // error — the opposite failure to the one this guard exists for.
      expect(parseTraceEntries(feedWith(raw))).toHaveLength(1);
    });

    it('still refuses :60 where it is not a leap second', () => {
      expect(() => parseTraceEntries(feedWith('2026-08-28T10:00:60Z'))).toThrow(
        /not an RFC 3339 date-time/,
      );
    });

    it('orders a leap second before the next minute', () => {
      expect(
        compareRecordedAt(
          { recordedAt: '1991-01-01T00:00:00Z' },
          { recordedAt: '1990-12-31T23:59:60Z' },
        ),
      ).toBeGreaterThan(0);
    });

    it('accepts a leap day that does exist', () => {
      const entries = parseTraceEntries(feedWith('2024-02-29T10:00:00Z'));
      expect(entries).toHaveLength(1);
    });
  });

  describe('a recognised document may legitimately be empty', () => {
    it('accepts a feed with no entries', () => {
      expect(
        parseTraceEntries(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Traces</atom:title></atom:feed>',
          ),
        ),
      ).toEqual([]);
    });

    it('accepts a feed that carries only its own metadata', () => {
      // title/updated with no `entry` is an empty feed, not a misread one.
      expect(
        parseTraceEntries(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Traces</atom:title><atom:updated>2026-08-28T10:00:00Z</atom:updated></atom:feed>',
          ),
        ),
      ).toEqual([]);
    });

    it('accepts a hit list with no rows', () => {
      expect(
        parseHitList(
          response('<?xml version="1.0"?><trc:hitlist xmlns:trc="x"/>'),
        ),
      ).toEqual({ entries: [] });
    });
  });

  describe('a recognised document is read', () => {
    it('reads a catalogue', () => {
      const items = parseNamedItems(
        response(
          '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:name>/sap/bc/adt/x/any</nameditem:name><nameditem:description>Any</nameditem:description></nameditem:namedItem></nameditem:namedItemList>',
        ),
      );
      expect(items).toEqual([
        { name: '/sap/bc/adt/x/any', description: 'Any' },
      ]);
    });

    it('reads a database access with its split access time', () => {
      const parsed = parseDbAccesses(
        response(
          '<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"><trc:dbAccess trc:index="1" trc:tableName="T000" trc:totalCount="4" trc:bufferedCount="1"><trc:accessTime trc:total="120" trc:applicationServer="20" trc:database="100" trc:ratioOfTraceTotal="3"/></trc:dbAccess></trc:dbAccesses>',
        ),
      );
      expect(parsed.accesses).toHaveLength(1);
      expect(parsed.accesses[0]).toMatchObject({
        index: 1,
        tableName: 'T000',
        totalCount: 4,
        bufferedCount: 1,
        accessTime: {
          total: 120,
          applicationServer: 20,
          database: 100,
          ratioOfTraceTotal: 3,
        },
      });
    });
  });
});
