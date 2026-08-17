/**
 * ATC check runs.
 *
 * Written against the captures in `docs/evidence/2026-08-16-atc-trial-probe.md`
 * and `docs/evidence/2026-08-17-atc-objecttype-confirmed.md`, and the numbering
 * follows the plan's test list.
 *
 * Three groups earn their place for different reasons: the ones that read the
 * **request** (headers and payload), because in ATC the media type is the
 * resource and the payload is the whole instruction; the ones that assert a
 * **rejection**, because every silent default this package has removed had the
 * shape of a missing field quietly becoming a plausible value; and the URI
 * table, because those seven templates are the only part of the contract that
 * rests on evidence rather than on reasoning.
 */

import type { IAbapConnection, IAtcRunTarget } from '@mcp-abap-adt/interfaces';
import { AdtAtc } from '../../../runtime/atc/AdtAtc';

const CUSTOMIZING = `<?xml version="1.0" encoding="utf-8"?>
<atc:customizing xmlns:atc="http://www.sap.com/adt/atc"><properties>
<property name="systemCheckVariant" value="ABAP_CLOUD_DEVELOPMENT_DEFAULT"/>
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

const TARGET: IAtcRunTarget = {
  objects: [{ objectType: 'class', objectName: 'ZCL_X' }],
};

function logger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * A connection that answers by URL, so a test says what the server does rather
 * than counting calls in order.
 */
function connectionFor(
  overrides: Partial<{
    customizing: unknown;
    worklist: unknown;
    run: unknown;
    status: unknown;
    worklistRead: unknown;
  }> = {},
) {
  const calls: {
    url: string;
    method: string;
    headers?: unknown;
    data?: unknown;
  }[] = [];
  const answer = (url: string) => {
    if (url.includes('/atc/customizing'))
      return (
        overrides.customizing ?? { status: 200, data: CUSTOMIZING, headers: {} }
      );
    if (url.includes('/atc/worklists?'))
      return (
        overrides.worklist ?? { status: 200, data: WORKLIST_ID, headers: {} }
      );
    if (url.includes('/atc/runs?'))
      return (
        overrides.run ?? {
          status: 201,
          data: '',
          headers: { location: `/sap/bc/adt/atc/runs/${RUN_ID}` },
        }
      );
    if (url.includes('/atc/runs/'))
      return (
        overrides.status ?? { status: 200, data: STATUS_FINISHED, headers: {} }
      );
    return (
      overrides.worklistRead ?? {
        status: 200,
        data: '<worklist/>',
        headers: {},
      }
    );
  };
  const connection = {
    makeAdtRequest: jest.fn(async (req: any) => {
      calls.push(req);
      return answer(req.url);
    }),
  } as unknown as IAbapConnection;
  return { connection, calls };
}

const urlsOf = (calls: { url: string }[]) => calls.map((c) => c.url);

describe('AdtAtc — resolving the check variant', () => {
  // 1. The interface makes `options` optional. A handler reading `options.wait`
  // throws on this call, and a test passing `{}` would sail past it.
  it('run(target) with no options at all uses every default', async () => {
    const { connection, calls } = connectionFor();

    const result = await new AdtAtc(connection, logger() as never).run(TARGET);

    expect(result).toEqual({
      waited: false,
      worklistId: WORKLIST_ID,
      runId: RUN_ID,
    });
    expect(urlsOf(calls)[0]).toContain('/atc/customizing');
    const run = calls.find((c) => c.url.includes('/atc/runs?'));
    expect(run?.url).toContain('clientWait=false');
    expect(run?.data).toContain('maximumVerdicts="100"');
  });

  // 2.
  it('reads customizing with GET and uses systemCheckVariant', async () => {
    const { connection, calls } = connectionFor();

    await new AdtAtc(connection, logger() as never).run(TARGET, {});

    const customizing = calls.find((c) => c.url.includes('/atc/customizing'));
    expect(customizing?.method).toBe('GET');
    expect(calls.find((c) => c.url.includes('/atc/worklists?'))?.url).toContain(
      'checkVariant=ABAP_CLOUD_DEVELOPMENT_DEFAULT',
    );
  });

  // 3. Asserting the request was never made, not merely that the right variant
  // was used — a handler could read customizing and then ignore it.
  it('an explicit checkVariant skips /atc/customizing entirely', async () => {
    const { connection, calls } = connectionFor();

    await new AdtAtc(connection, logger() as never).run(TARGET, {
      checkVariant: 'ZMY_VARIANT',
    });

    expect(urlsOf(calls).some((u) => u.includes('/atc/customizing'))).toBe(
      false,
    );
    expect(calls.find((c) => c.url.includes('/atc/worklists?'))?.url).toContain(
      'checkVariant=ZMY_VARIANT',
    );
  });

  // 4.
  it('customizing without systemCheckVariant rejects locally', async () => {
    const { connection, calls } = connectionFor({
      customizing: { status: 200, data: '<atc:customizing/>', headers: {} },
    });

    await expect(
      new AdtAtc(connection, logger() as never).run(TARGET),
    ).rejects.toMatchObject({ code: 'ATC_NO_CHECK_VARIANT' });

    // No worklist created with `undefined` in the URL.
    expect(urlsOf(calls).some((u) => u.includes('/atc/worklists?'))).toBe(
      false,
    );
  });
});

describe('AdtAtc — the request itself', () => {
  // 5. The one test that reads the payload. A handler sending only the first
  // object, the wrong kind, or a lost maximumVerdicts satisfies every
  // result-level assertion in this file.
  it('the run payload carries every object, the inclusive kind and the cap', async () => {
    const { connection, calls } = connectionFor();

    await new AdtAtc(connection, logger() as never).run(
      {
        objects: [
          { objectType: 'class', objectName: 'ZCL_X' },
          { objectType: 'table', objectName: 'ZT_Y' },
        ],
      },
      { maximumVerdicts: 500 },
    );

    const body = String(calls.find((c) => c.url.includes('/atc/runs?'))?.data);
    expect(body).toContain('maximumVerdicts="500"');
    expect(body).toContain('<objectSet kind="inclusive">');
    expect(body).toContain('adtcore:uri="/sap/bc/adt/oo/classes/ZCL_X"');
    expect(body).toContain('adtcore:uri="/sap/bc/adt/ddic/tables/ZT_Y"');
  });

  it('clientWait follows the wait option', async () => {
    const { connection, calls } = connectionFor({
      run: { status: 200, data: WAITING_RUN, headers: {} },
    });

    await new AdtAtc(connection, logger() as never).run(TARGET, { wait: true });

    expect(calls.find((c) => c.url.includes('/atc/runs?'))?.url).toContain(
      'clientWait=true',
    );
  });

  // In ATC the header IS the resource: the same path answers differently by
  // Accept, worklist creation is text/plain where everything around it is XML,
  // and a checkstyle Accept is refused with 406.
  it('every request carries the media types the server answers to', async () => {
    const { connection, calls } = connectionFor();
    const atc = new AdtAtc(connection, logger() as never);

    await atc.run(TARGET);
    await atc.getRunStatus(RUN_ID);
    await atc.getFindings(WORKLIST_ID);

    const headersOf = (fragment: string) =>
      calls.find((c) => c.url.includes(fragment))?.headers as Record<
        string,
        string
      >;

    expect(headersOf('/atc/customizing').Accept).toBe(
      'application/xml, application/vnd.sap.atc.customizing-v1+xml, application/vnd.sap.atc.customizing-v2+xml',
    );
    expect(headersOf('/atc/worklists?')).toEqual({
      'Content-Type': 'text/plain',
      Accept: 'text/plain',
    });
    expect(headersOf('/atc/runs?')).toEqual({
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    });
    expect(headersOf('/atc/runs/').Accept).toBe(
      'application/vnd.sap.adt.backgroundrun.v1+xml',
    );
    expect(headersOf('/atc/worklists/').Accept).toBe(
      'application/atc.worklist.v1+xml, application/vnd.sap.atc.worklist.v1+xml',
    );
  });
});

describe('AdtAtc — what a started run answers with', () => {
  // 6. worklistId and runId are different values from different responses, and
  // the worklist id is what getFindings is called with next.
  it('wait: false returns the run id from Location and the created worklist id', async () => {
    const { connection } = connectionFor();

    const result = await new AdtAtc(connection, logger() as never).run(TARGET);

    expect(result).toEqual({
      waited: false,
      worklistId: WORKLIST_ID,
      runId: RUN_ID,
    });
  });

  // 7. The silent-success shape this package removed from fifteen handlers.
  it('wait: false with no Location rejects instead of using the worklist id', async () => {
    const { connection } = connectionFor({
      run: { status: 201, data: '', headers: {} },
    });

    await expect(
      new AdtAtc(connection, logger() as never).run(TARGET),
    ).rejects.toMatchObject({ code: 'ATC_NO_RUN_LOCATION' });
  });

  // 8. The happy path, saying nothing about where the id came from — that is
  // test 15's job.
  it('wait: true returns the stats verbatim and the worklist id', async () => {
    const { connection } = connectionFor({
      run: { status: 200, data: WAITING_RUN, headers: {} },
    });

    const result = await new AdtAtc(connection, logger() as never).run(TARGET, {
      wait: true,
    });

    expect(result).toEqual({
      waited: true,
      worklistId: WORKLIST_ID,
      findingStats: '0,0,1',
    });
  });

  // 9. A confident zero is indistinguishable from a clean check.
  it('wait: true with no FINDING_STATS rejects instead of reporting "0,0,0"', async () => {
    const { connection } = connectionFor({
      run: {
        status: 200,
        data: '<atcworklist:worklistRun/>',
        headers: {},
      },
    });

    await expect(
      new AdtAtc(connection, logger() as never).run(TARGET, { wait: true }),
    ).rejects.toMatchObject({ code: 'ATC_NO_FINDING_STATS' });
  });

  // 15. Which id is authoritative. A positive test where the two agree cannot
  // tell "returns the created id" from "trusts the response id". This asserts a
  // SUCCESS: the spec defines no failure here, and an implementation plan does
  // not get to add one.
  it('a differing echoed worklist id is warned about, not obeyed, and not fatal', async () => {
    const log = logger();
    const { connection } = connectionFor({
      run: {
        status: 200,
        data: WAITING_RUN.replace(WORKLIST_ID, 'SOMEONE_ELSES_WORKLIST'),
        headers: {},
      },
    });

    const result = await new AdtAtc(connection, log as never).run(TARGET, {
      wait: true,
    });

    expect(result).toMatchObject({ waited: true, worklistId: WORKLIST_ID });
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('SOMEONE_ELSES_WORKLIST'),
    );
  });

  it('a waiting run with no echoed worklist id still succeeds', async () => {
    const { connection } = connectionFor({
      run: {
        status: 200,
        data: `<atcworklist:worklistRun><atcworklist:infos><atcinfo:info><atcinfo:type>FINDING_STATS</atcinfo:type><atcinfo:description>1,2,3</atcinfo:description></atcinfo:info></atcworklist:infos></atcworklist:worklistRun>`,
        headers: {},
      },
    });

    await expect(
      new AdtAtc(connection, logger() as never).run(TARGET, { wait: true }),
    ).resolves.toMatchObject({
      worklistId: WORKLIST_ID,
      findingStats: '1,2,3',
    });
  });
});

describe('AdtAtc — asking whether a run is done', () => {
  // 10.
  it('isFinished is exact: "finished" yes, "unfinished" and "not_finished" no', async () => {
    for (const [status, expected] of [
      ['finished', true],
      ['FINISHED', true],
      ['unfinished', false],
      ['not_finished', false],
      ['running', false],
    ] as const) {
      const { connection } = connectionFor({
        status: {
          status: 200,
          data: `<runs:run runs:status="${status}"/>`,
          headers: {},
        },
      });

      const result = await new AdtAtc(
        connection,
        logger() as never,
      ).getRunStatus(RUN_ID);

      expect(result.status).toBe(status);
      expect(result.isFinished).toBe(expected);
    }
  });

  // 11. Both links, each from its own rel. Asserting only the absent case
  // leaves a parser free to take the first href it sees, or to swap the two.
  it('takes each id from its own atom link', async () => {
    const { connection } = connectionFor();

    const result = await new AdtAtc(connection, logger() as never).getRunStatus(
      RUN_ID,
    );

    expect(result.worklistId).toBe(WORKLIST_ID);
    expect(result.resultId).toBe('RESULT99');
  });

  // 12. The state polling exists for, and the one nobody has captured.
  it('resolves without the links, leaving the ids undefined', async () => {
    const { connection } = connectionFor({
      status: {
        status: 200,
        data: '<runs:run runs:status="running"/>',
        headers: {},
      },
    });

    const result = await new AdtAtc(connection, logger() as never).getRunStatus(
      RUN_ID,
    );

    expect(result).toEqual({
      status: 'running',
      isFinished: false,
      worklistId: undefined,
      resultId: undefined,
    });
  });

  // 14. `status` is not optional in the contract; resolving with undefined
  // through it is a lie the type cannot catch.
  it('a run resource with no runs:status rejects', async () => {
    const { connection } = connectionFor({
      status: { status: 200, data: '<runs:run/>', headers: {} },
    });

    await expect(
      new AdtAtc(connection, logger() as never).getRunStatus(RUN_ID),
    ).rejects.toMatchObject({ code: 'ATC_RUN_STATUS_MISSING' });
  });
});

describe('AdtAtc — refusing before the request', () => {
  // 13. Non-empty and nothing more: no length, no character class, since no
  // contract states a format.
  it('an empty worklist id rejects rather than being run against', async () => {
    const { connection, calls } = connectionFor({
      worklist: { status: 200, data: '   ', headers: {} },
    });

    await expect(
      new AdtAtc(connection, logger() as never).run(TARGET),
    ).rejects.toMatchObject({ code: 'ATC_NO_WORKLIST_ID' });

    expect(urlsOf(calls).some((u) => u.includes('/atc/runs?'))).toBe(false);
  });

  // 16. The tuple type stops a TypeScript caller; a JavaScript one arrives.
  it('an empty object set rejects before any request', async () => {
    const { connection } = connectionFor();

    await expect(
      new AdtAtc(connection, logger() as never).run({ objects: [] } as never),
    ).rejects.toMatchObject({ code: 'ADT_VALIDATION_FAILED' });

    expect(connection.makeAdtRequest).not.toHaveBeenCalled();
  });

  // 17. The server answers 0 with a 400; a client that can name the problem
  // should not spend a round trip being told.
  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
  ])('maximumVerdicts of %p rejects before any request', async (value) => {
    const { connection } = connectionFor();

    await expect(
      new AdtAtc(connection, logger() as never).run(TARGET, {
        maximumVerdicts: value,
      }),
    ).rejects.toMatchObject({ code: 'ADT_VALIDATION_FAILED' });

    expect(connection.makeAdtRequest).not.toHaveBeenCalled();
  });
});

// 18. The one part of the contract resting on evidence rather than reasoning:
// each template was confirmed by a run submitted at it whose finished worklist
// then listed that object under that type. A changed template must fail loudly.
describe('AdtAtc — the confirmed URI templates', () => {
  it.each([
    ['class', '/sap/bc/adt/oo/classes/ZX'],
    ['interface', '/sap/bc/adt/oo/interfaces/ZX'],
    ['function_group', '/sap/bc/adt/functions/groups/ZX'],
    ['package', '/sap/bc/adt/packages/ZX'],
    ['ddl_source', '/sap/bc/adt/ddic/ddl/sources/ZX'],
    ['table', '/sap/bc/adt/ddic/tables/ZX'],
    ['behavior_definition', '/sap/bc/adt/bo/behaviordefinitions/ZX'],
  ] as const)('%s is checked at %s', async (objectType, uri) => {
    const { connection, calls } = connectionFor();

    await new AdtAtc(connection, logger() as never).run({
      objects: [{ objectType, objectName: 'ZX' }],
    });

    expect(
      String(calls.find((c) => c.url.includes('/atc/runs?'))?.data),
    ).toContain(`adtcore:uri="${uri}"`);
  });
});
