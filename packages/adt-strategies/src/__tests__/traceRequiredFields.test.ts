/**
 * D2 of #304: a trace reading throws, naming the field, when SAP's answer
 * lacks a field its result type requires. Before, the field read as
 * `undefined` under a type that said `string` or `number`. Each case fails
 * against the casting code and passes after; the complete documents beside
 * them read exactly as before.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  profilerDbAccesses,
  profilerHitList,
  profilerStatements,
  profilerTraceEntries,
  traceSchedulingRequests,
  traceSchedulingTypes,
} from '../results/traces';

const response = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

const TRACE_ID = 'ABCDEF0123456789ABCD';
/** Every part of a complete entry, so a case can leave one out. */
const PARTS: Record<string, string> = {
  id: `<atom:id>/sap/bc/adt/runtime/traces/abaptraces/${TRACE_ID}</atom:id>`,
  recordedAt: '<atom:published>2026-08-28T10:00:00Z</atom:published>',
  host: '<trc:host>somehost</trc:host>',
  size: '<trc:size>8</trc:size>',
  runtime: '<trc:runtime>554</trc:runtime>',
  runtimeABAP: '<trc:runtimeABAP>553</trc:runtimeABAP>',
  runtimeSystem: '<trc:runtimeSystem>1</trc:runtimeSystem>',
  runtimeDatabase: '<trc:runtimeDatabase>0</trc:runtimeDatabase>',
  expiresAt: '<trc:expiration>2026-09-24T06:09:50Z</trc:expiration>',
  system: '<trc:system>ABC</trc:system>',
  client: '<trc:client>100</trc:client>',
  user: '<trc:user>SAPUSER01</trc:user>',
  isAggregated: '<trc:isAggregated>false</trc:isAggregated>',
  objectName:
    '<trc:objectName>ZAC_SHR_RUN01=================CP</trc:objectName>',
  'state.value': 'value="R"',
  'state.text': 'text="Finished"',
  amdpFileSize: '<trc:amdpFileSize>0</trc:amdpFileSize>',
};
const ATOM = new Set(['id', 'recordedAt']);
const STATE = new Set(['state.value', 'state.text']);

function entryWithout(field?: string): string {
  const keep = (name: string) => (name === field ? '' : (PARTS[name] ?? ''));
  const ext = Object.keys(PARTS)
    .filter((k) => !ATOM.has(k) && !STATE.has(k))
    .map(keep)
    .join('');
  const state = `<trc:state ${keep('state.value')} ${keep('state.text')}/>`;
  return `<atom:entry>${keep('id')}${keep('recordedAt')}<trc:extendedData>${ext}${state}</trc:extendedData></atom:entry>`;
}
const feed = (entry: string) =>
  response(
    `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x">${entry}</atom:feed>`,
  );

describe('a trace entry that lacks a required field', () => {
  it('reads a complete entry as before', () => {
    // Captured from the reading before D2 (f845e00c^) over this same feed.
    expect(profilerTraceEntries(feed(entryWithout()))).toEqual([
      {
        id: 'ABCDEF0123456789ABCD',
        recordedAt: '2026-08-28T10:00:00Z',
        uri: '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD',
        user: 'SAPUSER01',
        objectName: 'ZAC_SHR_RUN01=================CP',
        state: {
          value: 'R',
          text: 'Finished',
        },
        expiresAt: '2026-09-24T06:09:50Z',
        system: 'ABC',
        client: '100',
        host: 'somehost',
        size: 8,
        runtime: 554,
        runtimeABAP: 553,
        runtimeSystem: 1,
        runtimeDatabase: 0,
        isAggregated: false,
        amdpFileSize: 0,
      },
    ]);
  });

  for (const field of Object.keys(PARTS)) {
    it(`throws naming ${field}`, () => {
      expect(() => profilerTraceEntries(feed(entryWithout(field)))).toThrow(
        `traces: ${field} is missing`,
      );
    });
  }
});

describe('a view row that lacks a required field', () => {
  const hitlist = (entry: string) =>
    response(
      `<?xml version="1.0"?><trc:hitlist xmlns:trc="x" xmlns:adtcore="y">${entry}</trc:hitlist>`,
    );
  const cases: [string, () => unknown][] = [
    ['hitlist.index', () => profilerHitList(hitlist('<trc:entry/>'))],
    [
      'timing.time',
      () =>
        profilerHitList(
          hitlist(
            '<trc:entry trc:index="1"><trc:grossTime percentage="1"/></trc:entry>',
          ),
        ),
    ],
    [
      'timing.percentage',
      () =>
        profilerHitList(
          hitlist(
            '<trc:entry trc:index="1"><trc:grossTime time="1"/></trc:entry>',
          ),
        ),
    ],
    [
      'program.name',
      () =>
        profilerHitList(
          hitlist(
            '<trc:entry trc:index="1"><trc:callingProgram adtcore:uri="/u"/></trc:entry>',
          ),
        ),
    ],
    [
      'program.uri',
      () =>
        profilerHitList(
          hitlist(
            '<trc:entry trc:index="1"><trc:callingProgram adtcore:name="ZCL_X"/></trc:entry>',
          ),
        ),
    ],
    [
      'statement.id',
      () =>
        profilerStatements(
          response(
            '<?xml version="1.0"?><trc:statements xmlns:trc="x"><trc:statement trc:index="2"/></trc:statements>',
          ),
        ),
    ],
    [
      'statement.index',
      () =>
        profilerStatements(
          response(
            '<?xml version="1.0"?><trc:statements xmlns:trc="x"><trc:statement trc:id="7"/></trc:statements>',
          ),
        ),
    ],
    [
      'dbAccess.index',
      () =>
        profilerDbAccesses(
          response(
            '<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"><trc:dbAccess trc:tableName="T000"/></trc:dbAccesses>',
          ),
        ),
    ],
    [
      'catalogue.name',
      () =>
        traceSchedulingTypes(
          response(
            '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:description>Any</nameditem:description></nameditem:namedItem></nameditem:namedItemList>',
          ),
        ),
    ],
    [
      'catalogue.description',
      () =>
        traceSchedulingTypes(
          response(
            '<?xml version="1.0"?><nameditem:namedItemList xmlns:nameditem="x"><nameditem:namedItem><nameditem:name>/x</nameditem:name></nameditem:namedItem></nameditem:namedItemList>',
          ),
        ),
    ],
    [
      'request.id',
      () =>
        traceSchedulingRequests(
          response(
            '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trc="x"><atom:entry><trc:extendedData/></atom:entry></atom:feed>',
          ),
        ),
    ],
  ];
  for (const [field, read] of cases) {
    it(`throws naming ${field}`, () => {
      expect(read).toThrow(`traces: ${field} is missing`);
    });
  }
});
