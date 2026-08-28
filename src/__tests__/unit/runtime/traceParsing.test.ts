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
  parseDbAccesses,
  parseHitList,
  parseNamedItems,
  parseStatements,
  parseTraceEntries,
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
      ).toThrow(/none carried a recognisable trace id/);
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
