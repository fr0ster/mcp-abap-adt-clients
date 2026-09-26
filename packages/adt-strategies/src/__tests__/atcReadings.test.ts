import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  atcRunStatus,
  atcStartedRun,
  atcSystemCheckVariant,
  atcWaitingRun,
  atcWorklistId,
} from '../results/atc';

/**
 * The ATC readings, moved with their cases from adt-clients (`AdtAtc.test.ts`),
 * where `AdtAtc` applied them to every answer and threw where a value was
 * missing. The documents are the trial's captures
 * (`docs/evidence/2026-08-16-atc-trial-probe.md` in adt-clients) and variants a
 * server may validly send that differ from them only in attribute order or
 * namespace prefix.
 *
 * Where a value is missing the reading answers `''` now, never a plausible
 * default — the cases that used to assert a rejection assert that instead.
 */
const answer = (
  data: string,
  headers: Record<string, string> = {},
  status = 200,
): IAdtWireResponse => ({ data, status, statusText: 'OK', headers });

// The properties as the trial sent them: four of them, and the one this client
// needs is not the first.
const CUSTOMIZING = `<?xml version="1.0" encoding="utf-8"?>
<atc:customizing xmlns:atc="http://www.sap.com/adt/atc"><properties>
<property name="ciCheckFlavour" value="true"/>
<property name="systemCheckVariant" value="ABAP_CLOUD_DEVELOPMENT_DEFAULT"/>
<property name="isCCSTunnelEnabled" value="false"/>
<property name="isTransportableExemptionTypeUsed" value="true"/>
</properties></atc:customizing>`;

const WORKLIST_ID = '0ABD945AC5681FE1A6C51EE2E3AB6030';
const RUN_ID = '6E27F48C3C661FD1A6C51F2A0B7C4030';

const WAITING_RUN = `<?xml version="1.0" encoding="utf-8"?>
<atcworklist:worklistRun xmlns:atcworklist="http://www.sap.com/adt/atc/worklist">
<atcworklist:worklistId>${WORKLIST_ID}</atcworklist:worklistId>
<atcworklist:infos><atcinfo:info xmlns:atcinfo="http://www.sap.com/adt/atc/info">
<atcinfo:type>FINDING_STATS</atcinfo:type><atcinfo:description>0,0,1</atcinfo:description>
</atcinfo:info></atcworklist:infos></atcworklist:worklistRun>`;

const STATUS_FINISHED = `<?xml version="1.0" encoding="utf-8"?>
<runs:run runs:status="finished" xmlns:runs="http://www.sap.com/adt/backgroundruns"><runs:result>
<atom:link href="/sap/bc/adt/atc/results/RESULT99" rel="http://www.sap.com/abap/checks/atc/relations/results/displayid" xmlns:atom="http://www.w3.org/2005/Atom"/>
<atom:link href="/sap/bc/adt/atc/worklists/${WORKLIST_ID}" rel="http://www.sap.com/abap/checks/atc/relations/results/worklistid" xmlns:atom="http://www.w3.org/2005/Atom"/>
</runs:result></runs:run>`;

describe('atcSystemCheckVariant', () => {
  it('finds systemCheckVariant among the properties, not by position', () => {
    expect(atcSystemCheckVariant(answer(CUSTOMIZING))).toBe(
      'ABAP_CLOUD_DEVELOPMENT_DEFAULT',
    );
  });

  it('finds it with the attributes the other way round', () => {
    expect(
      atcSystemCheckVariant(
        answer(
          '<atc:customizing><properties><property value="ZREVERSED" name="systemCheckVariant"/></properties></atc:customizing>',
        ),
      ),
    ).toBe('ZREVERSED');
  });

  it('reads a customizing without one as no variant, rather than throwing', () => {
    expect(atcSystemCheckVariant(answer('<atc:customizing/>'))).toBe('');
    expect(atcSystemCheckVariant(answer(''))).toBe('');
  });
});

describe('atcWorklistId', () => {
  it('answers the bare id, trimmed', () => {
    expect(atcWorklistId(answer(` ${WORKLIST_ID}\n`))).toBe(WORKLIST_ID);
  });

  it('reads an empty body as no id', () => {
    expect(atcWorklistId(answer('   '))).toBe('');
  });
});

describe('atcStartedRun', () => {
  it('takes the run id from Location', () => {
    expect(
      atcStartedRun(
        answer('', { location: `/sap/bc/adt/atc/runs/${RUN_ID}` }, 201),
      ),
    ).toEqual({ waited: false, runId: RUN_ID });
  });

  it('finds Location whatever its capitalisation, and Content-Location too', () => {
    expect(
      atcStartedRun(answer('', { Location: `/x/runs/${RUN_ID}/` }, 201)).runId,
    ).toBe(RUN_ID);
    expect(
      atcStartedRun(
        answer('', { 'content-location': `/x/runs/${RUN_ID}` }, 201),
      ).runId,
    ).toBe(RUN_ID);
  });

  // It used to reject with ATC_NO_RUN_LOCATION. Falling back to the worklist
  // id would still be wrong — it would fetch a run that does not exist — so
  // the id is empty, and `analyse` decides what that means.
  it('reads a run accepted without Location as no run id', () => {
    expect(atcStartedRun(answer('', {}, 201))).toEqual({
      waited: false,
      runId: '',
    });
  });
});

describe('atcWaitingRun', () => {
  it('returns the stats verbatim and the echoed worklist id', () => {
    expect(atcWaitingRun(answer(WAITING_RUN))).toEqual({
      waited: true,
      worklistId: WORKLIST_ID,
      findingStats: '0,0,1',
    });
  });

  // It used to reject with ATC_NO_FINDING_STATS. A confident "0,0,0" would be
  // indistinguishable from a clean check; '' is not.
  it('reads a run with no FINDING_STATS as empty stats, never "0,0,0"', () => {
    expect(atcWaitingRun(answer('<atcworklist:worklistRun/>'))).toEqual({
      waited: true,
      worklistId: undefined,
      findingStats: '',
    });
  });

  it('finds FINDING_STATS past an earlier info and with description first', () => {
    const result = atcWaitingRun(
      answer(`<atcworklist:worklistRun>
<atcworklist:worklistId>${WORKLIST_ID}</atcworklist:worklistId>
<atcworklist:infos>
<atcinfo:info><atcinfo:type>SOMETHING_ELSE</atcinfo:type><atcinfo:description>9,9,9</atcinfo:description></atcinfo:info>
<atcinfo:info><atcinfo:description>4,5,6</atcinfo:description><atcinfo:type>FINDING_STATS</atcinfo:type></atcinfo:info>
</atcworklist:infos></atcworklist:worklistRun>`),
    );
    expect(result.findingStats).toBe('4,5,6');
  });

  // The echo is what the server said. Which worklist the caller reads next is
  // the caller's: it is the id they started the run against.
  it('reports an echoed worklist id as the server sent it', () => {
    const result = atcWaitingRun(
      answer(WAITING_RUN.replace(WORKLIST_ID, 'SOMEONE_ELSES_WORKLIST')),
    );
    expect(result.worklistId).toBe('SOMEONE_ELSES_WORKLIST');
  });

  // An all-digit id is a string, not a number: an id with a leading zero, or
  // one long enough to lose precision, would not round-trip.
  it('keeps an all-digit worklist id a string', () => {
    const digits = '00000000000000000000000000000000';
    const result = atcWaitingRun(
      answer(`<atcworklist:worklistRun><atcworklist:worklistId>${digits}</atcworklist:worklistId>
<atcworklist:infos><atcinfo:info><atcinfo:type>FINDING_STATS</atcinfo:type><atcinfo:description>0,0,0</atcinfo:description></atcinfo:info></atcworklist:infos>
</atcworklist:worklistRun>`),
    );
    expect(result).toEqual({
      waited: true,
      worklistId: digits,
      findingStats: '0,0,0',
    });
  });
});

describe('atcRunStatus', () => {
  it('isFinished is exact: "finished" yes, "unfinished" and "not_finished" no', () => {
    for (const [status, expected] of [
      ['finished', true],
      ['FINISHED', true],
      ['unfinished', false],
      ['not_finished', false],
      ['running', false],
    ] as const) {
      expect(
        atcRunStatus(answer(`<runs:run runs:status="${status}"/>`)).isFinished,
      ).toBe(expected);
    }
  });

  // Both links, each from its own rel — a reader free to take the first href
  // it sees, or to swap the two, would pass a test of the absent case.
  it('takes each id from its own atom link', () => {
    const result = atcRunStatus(answer(STATUS_FINISHED));
    expect(result.worklistId).toBe(WORKLIST_ID);
    expect(result.resultId).toBe('RESULT99');
  });

  it('takes each atom link id with rel before href', () => {
    const result = atcRunStatus(
      answer(`<runs:run runs:status="finished"><runs:result>
<atom:link rel="http://www.sap.com/abap/checks/atc/relations/results/worklistid" href="/sap/bc/adt/atc/worklists/${WORKLIST_ID}" type="application/xml"/>
<atom:link rel="http://www.sap.com/abap/checks/atc/relations/results/displayid" href="/sap/bc/adt/atc/results/RESULT99" type="application/xml"/>
</runs:result></runs:run>`),
    );
    expect(result.worklistId).toBe(WORKLIST_ID);
    expect(result.resultId).toBe('RESULT99');
  });

  it('reads a run still going, without links, leaving the ids undefined', () => {
    expect(atcRunStatus(answer('<runs:run runs:status="running"/>'))).toEqual({
      status: 'running',
      isFinished: false,
      worklistId: undefined,
      resultId: undefined,
    });
  });

  it('reads runs:status under any namespace prefix', () => {
    expect(
      atcRunStatus(
        answer(
          '<r:run r:status="finished" xmlns:r="http://www.sap.com/adt/backgroundruns"/>',
        ),
      ),
    ).toMatchObject({ status: 'finished', isFinished: true });
  });

  // It used to reject with ATC_RUN_STATUS_MISSING. An empty status is not
  // finished, and says so without claiming anything else.
  it('reads a run resource with no runs:status as an empty, unfinished status', () => {
    expect(atcRunStatus(answer('<runs:run/>'))).toEqual({
      status: '',
      isFinished: false,
      worklistId: undefined,
      resultId: undefined,
    });
  });
});
