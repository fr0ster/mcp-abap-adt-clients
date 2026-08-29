/**
 * What the trace parsers map, and what they deliberately do not do.
 *
 * An earlier version of this file had fifty-nine cases, thirty-five of them
 * asserting that a malformed document throws. That validation is gone: judging
 * SAP's own documents is not this library's job, and the guards it grew — six
 * levels of them — ended up asserting things about the wire nobody measured,
 * while inventing a failure mode of their own by refusing timestamps a
 * legitimate Atom feed may carry.
 *
 * What is left tests the two things that are actually ours: the mapping, and
 * the ordering — the latter because comparing timestamps as strings is a defect
 * in our logic regardless of what SAP sends.
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
} from '../../../runtime/traces/traceParsing';

const response = (data: string): IAdtResponse =>
  ({ data, status: 200, statusText: 'OK', headers: {} }) as IAdtResponse;

const FEED = (entries: string) =>
  response(
    `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x">${entries}</atom:feed>`,
  );

const TRACE_ID = 'ABCDEF0123456789ABCD';

describe('trace document mapping', () => {
  describe('the trace feed', () => {
    it('reads the id out of the atom:id URI, and the moment it was recorded', () => {
      const entries = parseTraceEntries(
        FEED(
          `<atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/${TRACE_ID}</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published></atom:entry>`,
        ),
      );
      expect(entries).toEqual([
        {
          id: TRACE_ID,
          recordedAt: '2026-08-28T10:00:00Z',
          user: undefined,
          objectName: undefined,
          uri: `/sap/bc/adt/runtime/traces/abaptraces/${TRACE_ID}`,
          expiresAt: undefined,
        },
      ]);
    });

    it('finds the trc: fields under extendedData', () => {
      const entries = parseTraceEntries(
        FEED(
          `<atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/${TRACE_ID}</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published><trc:extendedData><trc:user>SOMEONE</trc:user><trc:objectName>ZCL_X=====CP</trc:objectName><trc:state trc:value="R" trc:text="Finished"/><trc:expiration>2026-09-25T10:00:00Z</trc:expiration></trc:extendedData></atom:entry>`,
        ),
      );
      expect(entries[0]).toMatchObject({
        user: 'SOMEONE',
        objectName: 'ZCL_X=====CP',
        state: { value: 'R', text: 'Finished' },
        expiresAt: '2026-09-25T10:00:00Z',
      });
    });

    it('finds them directly on the entry too', () => {
      // Which of the two nestings the traces feed really uses has never been
      // read end to end, so the reader looks in both places.
      const entries = parseTraceEntries(
        FEED(
          `<atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/${TRACE_ID}</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published><trc:user>SOMEONE</trc:user></atom:entry>`,
        ),
      );
      expect(entries[0]?.user).toBe('SOMEONE');
    });

    it('falls back to atom:author for the user', () => {
      const entries = parseTraceEntries(
        FEED(
          `<atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/${TRACE_ID}</atom:id><atom:published>2026-08-28T10:00:00Z</atom:published><atom:author><atom:name>SOMEONE</atom:name></atom:author></atom:entry>`,
        ),
      );
      expect(entries[0]?.user).toBe('SOMEONE');
    });

    it('reads a feed with no entries as no traces', () => {
      expect(
        parseTraceEntries(FEED('<atom:title>Traces</atom:title>')),
      ).toEqual([]);
    });
  });

  describe('the three views', () => {
    it('maps a hit list row, including the program it names', () => {
      const parsed = parseHitList(
        response(
          '<?xml version="1.0"?><trc:hitlist xmlns:trc="x" xmlns:adtcore="y"><trc:entry trc:index="1" trc:hitCount="3" trc:recursionDepth="0" trc:description="do it"><trc:callingProgram adtcore:name="ZCL_X" adtcore:type="CLAS/OC" adtcore:uri="/sap/bc/adt/oo/classes/zcl_x" trc:byteCodeOffset="12"/></trc:entry></trc:hitlist>',
        ),
      );
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]).toMatchObject({
        index: 1,
        hitCount: 3,
        recursionDepth: 0,
        description: 'do it',
        callingProgram: {
          name: 'ZCL_X',
          type: 'CLAS/OC',
          uri: '/sap/bc/adt/oo/classes/zcl_x',
          byteCodeOffset: 12,
        },
      });
    });

    it('maps a statement, keeping the anchor that links it to the hit list', () => {
      const parsed = parseStatements(
        response(
          '<?xml version="1.0"?><trc:statements xmlns:trc="x"><trc:statement trc:id="7" trc:index="2" trc:callLevel="3" trc:hitlistAnchor="A1" trc:isProcedureLike="true"/></trc:statements>',
        ),
      );
      expect(parsed.statements[0]).toMatchObject({
        id: '7',
        index: 2,
        callLevel: 3,
        hitlistAnchor: 'A1',
        isProcedureLike: true,
      });
    });

    it('maps a database access with its split access time', () => {
      const parsed = parseDbAccesses(
        response(
          '<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"><trc:dbAccess trc:index="1" trc:tableName="T000" trc:totalCount="4" trc:bufferedCount="1"><trc:accessTime trc:total="120" trc:applicationServer="20" trc:database="100" trc:ratioOfTraceTotal="3"/></trc:dbAccess></trc:dbAccesses>',
        ),
      );
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

    it('reads an empty view as no rows', () => {
      expect(
        parseHitList(
          response('<?xml version="1.0"?><trc:hitlist xmlns:trc="x"/>'),
        ),
      ).toEqual({ entries: [] });
    });

    it('reads one row and many rows the same way', () => {
      // fast-xml-parser gives an object for one child and an array for several.
      const one = parseHitList(
        response(
          '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"/></trc:hitlist>',
        ),
      );
      const many = parseHitList(
        response(
          '<?xml version="1.0"?><trc:hitlist xmlns:trc="x"><trc:entry trc:index="1"/><trc:entry trc:index="2"/></trc:hitlist>',
        ),
      );
      expect(one.entries).toHaveLength(1);
      expect(many.entries).toHaveLength(2);
    });
  });

  describe('the catalogues and the schedule', () => {
    it('reads a catalogue item, whose name is a URI and not a code', () => {
      expect(
        parseNamedItems(
          response(
            '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:name>/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any</nameditem:name><nameditem:description>Any</nameditem:description></nameditem:namedItem></nameditem:namedItemList>',
          ),
        ),
      ).toEqual([
        {
          name: '/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any',
          description: 'Any',
        },
      ]);
    });

    it('reads a stored trace request, catalogue choices and all', () => {
      const [entry] = parseTraceRequests(
        FEED(
          '<atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/requests/26</atom:id>' +
            '<atom:link href="/sap/bc/adt/runtime/traces/abaptraces/B343" rel="http://www.sap.com/adt/relations/runtime/traces/abaptraces/tracefile"/>' +
            '<trc:extendedData><trc:requestIndex>26</trc:requestIndex><trc:description>-</trc:description><trc:isAggregated>true</trc:isAggregated>' +
            '<trc:processType trc:processTypeId="/p/any"/><trc:object trc:objectTypeId="/o/any"/>' +
            '<trc:executions trc:maximal="1" trc:completed="1"/></trc:extendedData></atom:entry>',
        ),
      );
      expect(entry).toMatchObject({
        id: '/sap/bc/adt/runtime/traces/abaptraces/requests/26',
        index: 26,
        description: '-',
        isAggregated: true,
        processTypeId: '/p/any',
        objectTypeId: '/o/any',
        executions: { maximal: 1, completed: 1 },
        traceUri: '/sap/bc/adt/runtime/traces/abaptraces/B343',
      });
    });

    it('reads an empty schedule as nothing scheduled', () => {
      // The runs that fulfil requests consume them, so empty is the normal
      // answer — not a broken endpoint.
      expect(
        parseTraceRequests(FEED('<atom:title>Requests</atom:title>')),
      ).toEqual([]);
    });
  });

  describe('ordering, which is ours to get right', () => {
    it('orders by time, not by text, across UTC offsets', () => {
      // 09:00Z is LATER than 10:00+02:00, and the strings say the opposite.
      // `latestTraceId()` exists to avoid taking a stale trace; comparing as
      // text would make it do exactly that.
      const earlier = { recordedAt: '2026-08-28T10:00:00+02:00' };
      const later = { recordedAt: '2026-08-28T09:00:00Z' };
      expect(later.recordedAt > earlier.recordedAt).toBe(false);
      expect(compareRecordedAt(later, earlier)).toBeGreaterThan(0);
    });

    it('orders across differing fractional-second precision', () => {
      const a = { recordedAt: '2026-08-28T10:00:00.9Z' };
      const b = { recordedAt: '2026-08-28T10:00:00.100Z' };
      expect(b.recordedAt > a.recordedAt).toBe(false);
      expect(compareRecordedAt(a, b)).toBeGreaterThan(0);
    });

    it('gives an unreadable timestamp a stable place instead of throwing', () => {
      // Ordering is not judgement. NaN compares false both ways, which would
      // otherwise leave the result depending on iteration order.
      const bad = { recordedAt: 'unexpected' };
      const good = { recordedAt: '2026-08-28T10:00:00Z' };
      expect(compareRecordedAt(bad, good)).toBeLessThan(0);
      expect(compareRecordedAt(good, bad)).toBeGreaterThan(0);
      expect(compareRecordedAt(bad, bad)).toBe(0);
    });
  });

  describe('what these parsers deliberately do not do', () => {
    it('does not judge a document it cannot read — it maps what is there', () => {
      // Validating SAP's own documents is not this library's job. A body it
      // does not recognise yields nothing rather than an exception, and the
      // caller that needs a different reading supplies its own parser through
      // `readWith`.
      expect(() =>
        parseHitList(
          response('<?xml version="1.0"?><exc:exception xmlns:exc="x"/>'),
        ),
      ).not.toThrow();
      expect(() => parseHitList(response('not xml at all <'))).not.toThrow();
      expect(() => parseHitList(response(''))).not.toThrow();
    });
  });
});
