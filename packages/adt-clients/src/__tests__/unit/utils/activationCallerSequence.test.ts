/**
 * The inactive list after a checklist that does not state its outcome
 * (fr0ster/mcp-abap-adt#351, #360), read by the caller (C7, 49.0.0): the
 * member sends the activation alone, and the caller — when
 * `readUnstatedActivation` answers `silent` or `unstated` — reads
 * `getUtils().getInactiveObjects()` and hands it, with the uris the request
 * named, to `analyseActivation` (`helpers/activationJudged.ts`, the recipe).
 * These are 48.0.0's cases of the member's own read, rewritten over the
 * caller's two calls; `activationEquivalence.test.ts` compares the recipe with
 * 48.0.0's verdicts on every recorded answer.
 *
 * The answers are the recorded ones (`corpus/adt/answers/`), replayed by a
 * stub connection that answers by request.
 */
import { join } from 'node:path';
import {
  analyseActivation,
  type IAdtActivationFailure,
  readUnstatedActivation,
} from '@mcp-abap-adt/adt-strategies';
import { AuthRefusedError } from '@mcp-abap-adt/connection';
import {
  ADT_NO_FAILURE,
  type AdtNoFailure,
  type IAdtAnalyseContext,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_SESSION_ERROR,
  type IAbapConnection,
  type IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { buildObjectUri } from '../../../utils/activationUtils';
import { wireItself } from '../../../utils/resultStrategy';
import { activationJudged } from '../../helpers/activationJudged';
import { headersOf } from '../../helpers/adtHeaders';
import { readExchange } from '../../helpers/recordedConformance';
import { CriticalSectionConnection } from '../../helpers/recordingConnection';
import { createLibraryLogger } from '../../helpers/testLogger';
import { ACTIVATING_APIS, activatingHandler } from '../core/activatingApis';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');

/** One recorded step, as the wire answer it was. */
function recorded(caseName: string, step: string): IAdtWireResponse<string> {
  const { status, body } = readExchange(ANSWERS, `${caseName}--${step}.json`);
  // Every recording replayed here is a 200, which the connection answers.
  if (status !== 200) throw new Error(`${caseName} ${step}: not a 200`);
  return { status, statusText: 'OK', headers: {}, data: body };
}

const SILENT = recorded('activation-group-alone-s4-2025', '04-activation');
const LISTED = recorded('activation-group-alone-s4-2025', '05-inactiveobjects');
const EMPTY = recorded(
  'activation-reactivate-active-s4-2025',
  '04-inactiveobjects',
);

const CHECKLIST_NS = 'http://www.sap.com/abapxml/checklist';

/** A `200` answer carrying `data`. */
function answered(data: string): IAdtWireResponse<string> {
  return { status: 200, statusText: 'OK', headers: {}, data };
}

/**
 * Built from the report of fr0ster/mcp-abap-adt#360 (SAP_BASIS 7.52),
 * **not recorded**: no `activationExecuted`, one `W` message whose text is
 * its `objDescr`. SAP activated the program.
 */
const UNSTATED_WARNING = answered(
  `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><msg objDescr="Program ZUNITTEST_MOCKUP_LOADER_EXMPL" type="W" line="1"/></chkl:messages>`,
);

/** A checklist with no `activationExecuted` and one message of `type`. */
function unstatedWith(type: string): IAdtWireResponse<string> {
  return answered(
    `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true"/><msg objDescr="Program ZP" type="${type}" line="1"><shortText><txt>message of type ${type}</txt></shortText></msg></chkl:messages>`,
  );
}

/**
 * Recorded on onprem (SAP_BASIS 816), 2026-11-16, bodies verbatim: a
 * warning-only activation (`activationExecuted="true"`, one `W`) and a
 * cancelled one (`activationExecuted="false"`, a `W` "Activation was
 * cancelled." first).
 */
const RECORDED_816_WARNING = answered(
  `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="true" generationExecuted="true"/><msg objDescr="Program ZMCP_I360_8614B7_P" type="W" line="1" href="/sap/bc/adt/programs/programs/zmcp_i360_8614b7_p/source/main#start=9,4;end=9,50" code="MESSAGE(G-Q)" forceSupported="true"><shortText><txt>The exception CX_UUID_ERROR is not caught or declared in the RAISING clause of "M".</txt></shortText><atom:link href="art.syntax:G-Q" rel="http://www.sap.com/adt/categories/quickfixes" xmlns:atom="http://www.w3.org/2005/Atom"/></msg></chkl:messages>`,
);
const RECORDED_816_CANCELLED = answered(
  `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg objDescr="" type="W" line="0" href=""><shortText><txt>Activation was cancelled.</txt></shortText></msg><msg objDescr="Program ZMCP_I360_4666B4_P" type="E" line="1" href="/sap/bc/adt/programs/programs/zmcp_i360_4666b4_p/source/main#start=13,10" code="WRITE(100)" forceSupported="true"><shortText><txt>The specified formats "/" and "1" must be specified as one word: "/1".</txt></shortText></msg></chkl:messages>`,
);
const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';
const INACTIVE = '/sap/bc/adt/activation/inactiveobjects';

/** A refusal of the read, the way a transport throws a non-2xx. */
function refused(status: number): Error & { response: IAdtWireResponse } {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {
      status,
      statusText: 'Internal Server Error',
      headers: {},
      data: '',
    },
  });
}

interface IReplay {
  activation: IAdtWireResponse<string>;
  inactive?: IAdtWireResponse<string> | Error;
}

/**
 * A client over a connection that answers by request, recording each one:
 * the shared `CriticalSectionConnection`, whose `bodyFor` answers `200` with
 * the recorded body or throws what it throws. Every recording replayed here
 * is a `200`.
 */
function replaying(replay: IReplay) {
  const connection = new CriticalSectionConnection((options) => {
    const answer =
      options.url === INACTIVE ? replay.inactive : replay.activation;
    if (answer === undefined) throw new Error(`unexpected ${options.url}`);
    if (answer instanceof Error) throw answer;
    return answer.data;
  });
  return {
    client: new AdtClient(connection, createLibraryLogger()),
    sent: connection.sent,
  };
}

/** An `analyse` that records what it was handed and clears nothing. */
function spying() {
  const seen: {
    verdict: IAdtError | AdtNoFailure;
    answer: IAdtWireResponse | undefined;
    context: IAdtAnalyseContext | undefined;
  }[] = [];
  const analyse = (
    verdict: IAdtError | AdtNoFailure,
    answer?: IAdtWireResponse,
    context?: IAdtAnalyseContext,
  ): IAdtError | AdtNoFailure => {
    seen.push({ verdict, answer, context });
    return verdict;
  };
  return { analyse, seen };
}

async function activateGroup<E extends IAdtError>(
  replay: IReplay,
  analyse: IAnalyse<E>,
) {
  const { client, sent } = replaying(replay);
  const group = client.getFunctionGroup();
  const answer = await group.activate(
    { functionGroupName: 'ZACT751P9325' },
    { headers: headersOf(group, 'activate'), analyse },
  );
  return { answer, sent };
}

/** The uris the group's activation names (`activationNamesItsUris.test.ts`). */
const NAMED = [
  buildObjectUri('ZACT751P9325', 'FUGR/F'),
  `${buildObjectUri('ZACT751P9325', 'FUGR/F')}/source/main`,
];

/** The group's activation, judged by the caller's recipe. */
async function judgedGroup(replay: IReplay) {
  const { client, sent } = replaying(replay);
  const group = client.getFunctionGroup();
  const utils = client.getUtils({ ...utilDocuments, inactive: wireItself });
  const judged = await activationJudged(
    (analyse) =>
      group.activate(
        { functionGroupName: 'ZACT751P9325' },
        { headers: headersOf(group, 'activate'), analyse },
      ),
    () => utils.getInactiveObjects(),
    NAMED,
  );
  return { judged, sent };
}

/** The verdict as the activation's failure; a throw when it is none. */
function failureOf(verdict: IAdtActivationFailure | AdtNoFailure) {
  if (verdict === ADT_NO_FAILURE) throw new Error('expected a failure');
  return verdict;
}

describe("after a silent checklist, the caller's read", () => {
  it('the member sends one POST; the caller reads the list once, with its Accept', async () => {
    const { sent, judged } = await judgedGroup({
      activation: SILENT,
      inactive: LISTED,
    });
    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ['POST', '/sap/bc/adt/activation?method=activate&preauditRequested=true'],
      ['GET', INACTIVE],
    ]);
    expect(sent[1]?.headers).toEqual({
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    });
    expect(judged.listRead).toBe(true);
    expect(judged.answer).toMatchObject(SILENT);
  });

  it('the uris the caller names are the ones the POST sent', async () => {
    const { sent } = await judgedGroup({
      activation: SILENT,
      inactive: LISTED,
    });
    expect(urisIn(sent[0]?.data)).toEqual(NAMED);
  });

  it('analyseActivation then answers not activated, the group still listed', async () => {
    const { judged } = await judgedGroup({
      activation: SILENT,
      inactive: LISTED,
    });
    expect(failureOf(judged.verdict).stillInactive.map((o) => o.uri)).toEqual(
      NAMED,
    );
  });

  it.each([
    [
      'activationExecuted="true"',
      recorded('activation-success-verdict', '01-activation'),
    ],
    [
      'ioc:inactiveObjects',
      recorded('activation-preaudit-still-inactive-751', '01-activation'),
    ],
    [
      'an empty body',
      recorded('activation-sync-activated-751', '01-activation'),
    ],
    [
      'a refusal with an E',
      recorded('refusal-activation-fails', '01-activation'),
    ],
    ['activationExecuted="true" and a W (recorded, 816)', RECORDED_816_WARNING],
    [
      'activationExecuted="false" and a W first (recorded cancelled, 816)',
      RECORDED_816_CANCELLED,
    ],
    [
      'activationExecuted="false" and the cancel note alone (derived from the recorded cancelled answer)',
      answered(
        `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg objDescr="" type="W" line="0" href=""><shortText><txt>Activation was cancelled.</txt></shortText></msg></chkl:messages>`,
      ),
    ],
    ['no activationExecuted and an E', unstatedWith('E')],
    ['no activationExecuted and an A', unstatedWith('A')],
    ['no activationExecuted and an X', unstatedWith('X')],
    [
      'no activationExecuted and no message',
      answered(
        `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true"/></chkl:messages>`,
      ),
    ],
  ])('after %s the caller reads nothing', async (_what, activation) => {
    const { sent, judged } = await judgedGroup({ activation });
    expect(readUnstatedActivation(activation)).toBeUndefined();
    expect(sent.map((r) => r.method)).toEqual(['POST']);
    expect(judged.listRead).toBe(false);
  });

  it("a read that fails replaces the starting verdict with the read's failure, carrying its response", async () => {
    const { judged } = await judgedGroup({
      activation: SILENT,
      inactive: refused(500),
    });
    const failure = failureOf(judged.verdict);
    expect(failure.message).toContain(
      "activation's outcome could not be decided",
    );
    expect(failure.response?.status).toBe(500);
    // The activation's answer stays the answer.
    expect(judged.answer).toMatchObject(SILENT);
  });
});

describe("after a checklist with no verdict and warnings alone, the caller's read", () => {
  it.each([
    ['the 7.52 shape', UNSTATED_WARNING],
    ['an I', unstatedWith('I')],
    ['an S', unstatedWith('S')],
  ])('after %s the caller reads the list once', async (_what, activation) => {
    const { sent } = await judgedGroup({ activation, inactive: EMPTY });
    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ['POST', '/sap/bc/adt/activation?method=activate&preauditRequested=true'],
      ['GET', INACTIVE],
    ]);
  });

  it('none listed is activated', async () => {
    const { judged } = await judgedGroup({
      activation: UNSTATED_WARNING,
      inactive: EMPTY,
    });
    expect(judged.verdict).toBe(ADT_NO_FAILURE);
  });

  it('the group still listed is not activated', async () => {
    const { judged } = await judgedGroup({
      activation: UNSTATED_WARNING,
      inactive: LISTED,
    });
    expect(failureOf(judged.verdict).stillInactive.map((o) => o.uri)).toEqual(
      NAMED,
    );
  });

  it("a refused read keeps the starting verdict; the refusal's response is the list, which cannot be read", async () => {
    const { judged } = await judgedGroup({
      activation: UNSTATED_WARNING,
      inactive: refused(500),
    });
    const failure = failureOf(judged.verdict);
    expect(failure.message).toContain('the inactive list could not be read');
    expect(failure.response?.status).toBe(200);
  });

  it('a read with no response hands no list: undecided without it', async () => {
    const { judged } = await judgedGroup({
      activation: UNSTATED_WARNING,
      inactive: new Error('socket hang up'),
    });
    expect(failureOf(judged.verdict).message).toContain(
      "without the list of inactive objects the activation's outcome could not be decided",
    );
  });
});

/** The `adtcore:uri` of every reference a request body names, in order. */
function urisIn(body: unknown): string[] {
  if (typeof body !== 'string') return [];
  return body
    .split('adtcore:uri="')
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf('"')));
}

/**
 * An activation SAP executed and cancelled (V6, recorded 2026-11-19 on
 * premise and on the cloud): `activationExecuted="true"` with messages of
 * type E, the object left inactive. Every activation member hands the answer
 * as it came and reads nothing more; the shipped verdict refuses it by its
 * messages, never passing it on the attribute alone.
 */
describe.each([
  [
    's4-2025',
    'Activation was cancelled.; Value in field Data Class (value ZZNOP not permitted); TABL ZMCP_TV443E was not activated',
  ],
  ['abap-cloud', 'Value in field Data Class; value ZZNOP not permitted'],
])(
  'every activation member refuses an executed activation with errors (%s)',
  (release, words) => {
    const cancelled = recorded(
      `activation-table-data-class-refused-${release}`,
      '01-activate',
    );
    it.each(ACTIVATING_APIS)(
      "%s: one request, refused in SAP's words",
      async (api) => {
        const { handler, config, calls } = activatingHandler(
          api,
          cancelled.data,
        );
        const answer = await handler.activate(config, {
          headers: headersOf(handler, 'activate', config),
          analyse: analyseActivation,
        });
        expect(calls.map((c) => c.method)).toEqual(['POST']);
        expect(answer).toMatchObject({ ok: false });
        const verdict = analyseActivation(ADT_NO_FAILURE, cancelled);
        expect(verdict !== ADT_NO_FAILURE && verdict.message).toBe(
          `Activation failed: ${words}`,
        );
      },
    );

    it('activateObjects: one request, refused', async () => {
      const requests: string[] = [];
      const connection: IAbapConnection = {
        connect: async () => undefined,
        getBaseUrl: async () => '',
        getSessionId: () => null,
        setSessionType: () => undefined,
        makeAdtRequest: async (options) => {
          requests.push(options.method);
          return cancelled;
        },
      };
      const answer = await new AdtClient(connection)
        .getUtils()
        .activateObjects([{ name: 'ZMCP_TV443E', type: 'TABL/DT' }], true, {
          headers: headersOf(
            new AdtClient(connection).getUtils(),
            'activateObjects',
          ),
          analyse: analyseActivation,
        });
      expect(requests).toEqual(['POST']);
      expect(answer.ok).toBe(false);
    });
  },
);

describe('a credential refusal SAP never saw, on the read, is thrown as it came', () => {
  /** A refusal the provider raised before SAP was asked (as the sweep builds one). */
  function providerRefused(): AuthRefusedError {
    return new AuthRefusedError(
      {} as never,
      'request',
      new Error('the provider gave up'),
    );
  }

  it.each([
    ['a silent checklist', SILENT],
    ['a checklist with no verdict and warnings alone', UNSTATED_WARNING],
  ])('after %s', async (_what, activation) => {
    const refusal = providerRefused();
    await expect(judgedGroup({ activation, inactive: refusal })).rejects.toBe(
      refusal,
    );
  });
});
