/**
 * ATC check runs.
 *
 * Written against the captures in `docs/evidence/2026-08-16-atc-trial-probe.md`
 * and `docs/evidence/2026-08-17-atc-objecttype-confirmed.md`.
 *
 * What is asserted here is the request — headers and payload, because in ATC
 * the media type is the resource and the payload is the whole instruction —
 * which strategy reads which answer, and the URI table, because those seven
 * templates are the only part of the contract that rests on evidence rather
 * than on reasoning. What the answers *mean* is the readings' business: they
 * moved to `@mcp-abap-adt/adt-strategies` with their cases
 * (`atcReadings.test.ts`), and they are imported here from its source until
 * the package index exports them.
 */

import {
  atcRunStatus,
  atcStartedRun,
  atcSystemCheckVariant,
  atcWaitingRun,
  atcWorklistId,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAtcRunOptions,
  IAtcRunTarget,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtAtc, atcDocuments } from '../../../runtime/atc/AdtAtc';
import { expectResult } from '../../helpers/contract';

/** An ATC client that reads its answers — the set a caller passes. */
const reading = {
  ...atcDocuments,
  checkVariant: atcSystemCheckVariant,
  worklist: atcWorklistId,
  startedRun: atcStartedRun,
  waitingRun: atcWaitingRun,
  runStatus: atcRunStatus,
};

/**
 * The sequence `AdtAtc.run` performed until 19.0.0, written out: the check
 * variant, a worklist for it, then the run. Three requests, so it could not
 * stay one member — the order and the worklist's reuse are the caller's.
 */
const runAtc = async (
  atc: AdtAtc<typeof reading>,
  target: IAtcRunTarget,
  options?: IAtcRunOptions,
) => {
  const checkVariant =
    options?.checkVariant ??
    expectResult(await atc.resolveCheckVariant(), 'check variant');
  const worklistId = expectResult(
    await atc.createWorklist(checkVariant),
    'worklist',
  );
  return atc.startRun(worklistId, target, options);
};

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
  // The interface makes `options` optional. A handler reading `options.wait`
  // throws on this call, and a test passing `{}` would sail past it.
  it('run(target) with no options at all uses every default', async () => {
    const { connection, calls } = connectionFor();

    const result = expectResult(
      await runAtc(new AdtAtc(connection, logger() as never, reading), TARGET),
      'result',
    );

    expect(result).toEqual({ waited: false, runId: RUN_ID });
    expect(urlsOf(calls)[0]).toContain('/atc/customizing');
    const run = calls.find((c) => c.url.includes('/atc/runs?'));
    expect(run?.url).toContain('clientWait=false');
    expect(run?.url).toContain(`worklistId=${WORKLIST_ID}`);
    expect(run?.data).toContain('maximumVerdicts="100"');
  });

  it('reads customizing with GET and uses systemCheckVariant', async () => {
    const { connection, calls } = connectionFor();

    await runAtc(
      new AdtAtc(connection, logger() as never, reading),
      TARGET,
      {},
    );

    const customizing = calls.find((c) => c.url.includes('/atc/customizing'));
    expect(customizing?.method).toBe('GET');
    expect(calls.find((c) => c.url.includes('/atc/worklists?'))?.url).toContain(
      'checkVariant=ABAP_CLOUD_DEVELOPMENT_DEFAULT',
    );
  });

  // Asserting the request was never made, not merely that the right variant
  // was used — a handler could read customizing and then ignore it.
  it('an explicit checkVariant skips /atc/customizing entirely', async () => {
    const { connection, calls } = connectionFor();

    await runAtc(new AdtAtc(connection, logger() as never, reading), TARGET, {
      checkVariant: 'ZMY_VARIANT',
    });

    expect(urlsOf(calls).some((u) => u.includes('/atc/customizing'))).toBe(
      false,
    );
    expect(calls.find((c) => c.url.includes('/atc/worklists?'))?.url).toContain(
      'checkVariant=ZMY_VARIANT',
    );
  });

  // It used to throw ATC_NO_CHECK_VARIANT from inside the member. A
  // customizing without a variant is SAP's answer lacking something: it comes
  // back as the answer, and a caller who counts that a failure says so.
  it('customizing without systemCheckVariant is the answer, judged by analyse', async () => {
    const { connection, calls } = connectionFor({
      customizing: { status: 200, data: '<atc:customizing/>', headers: {} },
    });
    const atc = new AdtAtc(connection, logger() as never, reading);

    expect(expectResult(await atc.resolveCheckVariant(), 'variant')).toBe('');

    const judged = await atc.resolveCheckVariant({
      analyse: (verdict, answer) =>
        atcSystemCheckVariant(answer as never) === ''
          ? { origin: 'refusal', message: 'no systemCheckVariant' }
          : verdict,
    });
    expect(judged.ok).toBe(false);
    if (!judged.ok)
      expect(judged.getError().message).toBe('no systemCheckVariant');
    expect(
      calls.filter((c) => c.url.includes('/atc/customizing')),
    ).toHaveLength(2);
  });
});

describe('AdtAtc — one request per member, each answer through its slot', () => {
  it('answers every document as it arrived when no reading is given', async () => {
    const { connection } = connectionFor();
    const atc = new AdtAtc(connection, logger() as never);

    expect(expectResult(await atc.resolveCheckVariant(), 'variant')).toBe(
      CUSTOMIZING,
    );
    expect(expectResult(await atc.createWorklist('V'), 'worklist')).toBe(
      WORKLIST_ID,
    );
    expect(expectResult(await atc.getRunStatus(RUN_ID), 'status')).toBe(
      STATUS_FINISHED,
    );
    expect(expectResult(await atc.getFindings(WORKLIST_ID), 'findings')).toBe(
      '<worklist/>',
    );
    // A run started without waiting answers 201 with an empty body; the run
    // id is in Location, which only `atcStartedRun` reads.
    expect(
      expectResult(await atc.startRun(WORKLIST_ID, TARGET), 'started'),
    ).toBe('');
    expect(connection.makeAdtRequest).toHaveBeenCalledTimes(5);
  });

  // `wait` decides the shape of the answer, so it decides which strategy
  // reads it.
  it('a started run is read by startedRun, a waiting run by waitingRun', async () => {
    const started = connectionFor();
    expect(
      expectResult(
        await new AdtAtc(
          started.connection,
          logger() as never,
          reading,
        ).startRun(WORKLIST_ID, TARGET),
        'started',
      ),
    ).toEqual({ waited: false, runId: RUN_ID });

    const waiting = connectionFor({
      run: { status: 200, data: WAITING_RUN, headers: {} },
    });
    expect(
      expectResult(
        await new AdtAtc(
          waiting.connection,
          logger() as never,
          reading,
        ).startRun(WORKLIST_ID, TARGET, { wait: true }),
        'waiting',
      ),
    ).toEqual({ waited: true, worklistId: WORKLIST_ID, findingStats: '0,0,1' });
  });

  it("passes the caller's analyse through on every member", async () => {
    const { connection } = connectionFor();
    const atc = new AdtAtc(connection, logger() as never);
    const refuse = {
      analyse: () => ({ origin: 'refusal' as const, message: 'no' }),
    };

    const answers = [
      await atc.resolveCheckVariant(refuse),
      await atc.createWorklist('V', refuse),
      await atc.startRun(WORKLIST_ID, TARGET, refuse),
      await atc.getRunStatus(RUN_ID, refuse),
      await atc.getFindings(WORKLIST_ID, refuse),
    ];
    expect(answers.map((a) => a.ok)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('AdtAtc — the request itself', () => {
  // 5. The one test that reads the payload. A handler sending only the first
  // object, the wrong kind, or a lost maximumVerdicts satisfies every
  // result-level assertion in this file.
  it('the run payload carries every object, the inclusive kind and the cap', async () => {
    const { connection, calls } = connectionFor();

    await runAtc(
      new AdtAtc(connection, logger() as never, reading),
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

    await runAtc(new AdtAtc(connection, logger() as never, reading), TARGET, {
      wait: true,
    });

    expect(calls.find((c) => c.url.includes('/atc/runs?'))?.url).toContain(
      'clientWait=true',
    );
  });

  // In ATC the header IS the resource: the same path answers differently by
  // Accept, worklist creation is text/plain where everything around it is XML,
  // and a checkstyle Accept is refused with 406.
  it('every request carries the media types the server answers to', async () => {
    const { connection, calls } = connectionFor();
    const atc = new AdtAtc(connection, logger() as never, reading);

    await runAtc(atc, TARGET);
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

describe('AdtAtc — refusing before the request', () => {
  // 16. The tuple type stops a TypeScript caller; a JavaScript one arrives.
  //
  // Asserted against `startRun` rather than the composed sequence: since
  // 19.0.0 the variant and the worklist are the caller's own calls, so "before
  // any request" is a claim about this member, not about the three together.
  it('an empty object set rejects before any request', async () => {
    const { connection } = connectionFor();

    await expect(
      new AdtAtc(connection, logger() as never).startRun('WL1', {
        objects: [],
      } as never),
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
      new AdtAtc(connection, logger() as never).startRun('WL1', TARGET, {
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

    await new AdtAtc(connection, logger() as never).startRun('WL1', {
      objects: [{ objectType, objectName: 'ZX' }],
    });

    expect(
      String(calls.find((c) => c.url.includes('/atc/runs?'))?.data),
    ).toContain(`adtcore:uri="${uri}"`);
  });

  /**
   * The map is `Partial`, so `AtcObjectType` can grow without breaking this
   * package — see interfaces#48. The cost is that a type with no template is a
   * runtime question, and this pins the answer: it must be an error naming the
   * type, never a URI built from the word `undefined`.
   */
  it('refuses a declared type it has no measured URI for', async () => {
    const { connection } = connectionFor();

    await expect(
      new AdtAtc(connection, logger() as never).startRun('WL1', {
        // A member the union does not have yet — the shape a future addition
        // arrives in, before anyone adds its template.
        objects: [{ objectType: 'program' as never, objectName: 'ZX' }],
      }),
    ).rejects.toThrow(/No ADT URI is known for ATC object type 'program'/);
  });
});
