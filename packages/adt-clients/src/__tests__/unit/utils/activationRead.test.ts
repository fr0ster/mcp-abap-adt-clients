/**
 * The one read after a checklist that does not state its outcome
 * (fr0ster/mcp-abap-adt#351, #360): when an activation answers
 * `chkl:messages` with `activationExecuted="false"` and no message, or with
 * no `activationExecuted` and only `W`/`I`/`S` messages, the member reads
 * `GET /sap/bc/adt/activation/inactiveobjects` once and hands `analyse` the
 * list and the uris its request named; after every other answer it sends
 * nothing more.
 *
 * The answers are the recorded ones (`corpus/adt/answers/`), replayed by a
 * stub connection that answers by request.
 */
import { join } from 'node:path';
import {
  analyseActivation,
  readActivationRefusal,
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
import { answeringActivation } from '../../../utils/activationUtils';
import { rawDocument } from '../../../utils/resultStrategy';
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

describe('the read after a silent checklist', () => {
  it('reads the inactive list once, and hands it with the named uris', async () => {
    const { analyse, seen } = spying();
    const { sent } = await activateGroup(
      { activation: SILENT, inactive: LISTED },
      analyse,
    );

    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ['POST', '/sap/bc/adt/activation?method=activate&preauditRequested=true'],
      ['GET', INACTIVE],
    ]);
    expect(sent[1]?.headers).toEqual({
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.verdict).toBe(ADT_NO_FAILURE);
    // The client puts the request back on every answer (`withRequestTrace`),
    // so the answers handed on are the recorded ones with their request.
    expect(seen[0]?.answer).toMatchObject(SILENT);
    expect(seen[0]?.context?.activation?.named).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
    expect(seen[0]?.context?.activation?.inactiveObjects).toMatchObject({
      ...LISTED,
      request: { method: 'GET', url: INACTIVE },
    });
  });

  it('analyseActivation then answers not activated, the group still listed', async () => {
    const { answer } = await activateGroup(
      { activation: SILENT, inactive: LISTED },
      analyseActivation,
    );
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError().stillInactive.map((o) => o.uri)).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
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
  ])('after %s nothing more is sent', async (_what, activation) => {
    const { analyse, seen } = spying();
    const { sent } = await activateGroup({ activation }, analyse);
    expect(sent.map((r) => r.method)).toEqual(['POST']);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('a read that fails is the call failure, carrying its response', async () => {
    const { analyse, seen } = spying();
    const { answer } = await activateGroup(
      { activation: SILENT, inactive: refused(500) },
      analyse,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    const failure = answer.getError();
    expect(failure.message).toContain(
      "activation's outcome could not be decided",
    );
    expect(failure.response?.status).toBe(500);
    expect(seen[0]?.verdict).not.toBe(ADT_NO_FAILURE);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('a read that fails stays a failure without an analyse', async () => {
    const { client } = replaying({
      activation: SILENT,
      inactive: refused(500),
    });
    const group = client.getFunctionGroup();
    const answer = await group.activate(
      { functionGroupName: 'ZACT751P9325' },
      { headers: headersOf(group, 'activate') },
    );
    expect(answer.ok).toBe(false);
  });
});

describe('the read after a checklist with no verdict and warnings alone', () => {
  it.each([
    ['the 7.52 shape', UNSTATED_WARNING],
    ['an I', unstatedWith('I')],
    ['an S', unstatedWith('S')],
  ])('after %s it reads the inactive list once', async (_what, activation) => {
    const { analyse, seen } = spying();
    const { sent } = await activateGroup(
      { activation, inactive: EMPTY },
      analyse,
    );
    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ['POST', '/sap/bc/adt/activation?method=activate&preauditRequested=true'],
      ['GET', INACTIVE],
    ]);
    expect(seen[0]?.context?.activation?.named).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
  });

  it('analyseActivation: none listed is activated, the warning kept in the document', async () => {
    const { answer } = await activateGroup(
      { activation: UNSTATED_WARNING, inactive: EMPTY },
      analyseActivation,
    );
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.getResult().value).toContain(
      'Program ZUNITTEST_MOCKUP_LOADER_EXMPL',
    );
  });

  it('analyseActivation: the group still listed is not activated', async () => {
    const { answer } = await activateGroup(
      { activation: UNSTATED_WARNING, inactive: LISTED },
      analyseActivation,
    );
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError().stillInactive.map((o) => o.uri)).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
  });

  it('a refused read leaves the verdict as it was, its response the list', async () => {
    const { analyse, seen } = spying();
    const { answer } = await activateGroup(
      { activation: UNSTATED_WARNING, inactive: refused(500) },
      analyse,
    );
    expect(answer.ok).toBe(true);
    expect(seen[0]?.verdict).toBe(ADT_NO_FAILURE);
    expect(seen[0]?.context?.activation?.inactiveObjects.status).toBe(500);
  });

  it('a read with no response hands no list', async () => {
    const { analyse, seen } = spying();
    const { answer } = await activateGroup(
      { activation: UNSTATED_WARNING, inactive: new Error('socket hang up') },
      analyse,
    );
    expect(answer.ok).toBe(true);
    expect(seen[0]?.verdict).toBe(ADT_NO_FAILURE);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('without an analyse the answer is what it was before the read existed', async () => {
    const { client, sent } = replaying({
      activation: UNSTATED_WARNING,
      inactive: refused(500),
    });
    const group = client.getFunctionGroup();
    const answer = await group.activate(
      { functionGroupName: 'ZACT751P9325' },
      { headers: headersOf(group, 'activate') },
    );
    expect(sent.map((r) => r.method)).toEqual(['POST', 'GET']);
    expect(answer.ok).toBe(true);
  });

  it.each([
    ['refused', refused(500)],
    ['with no response', new Error('socket hang up')],
  ])('analyseActivation: a read %s is undecided', async (_what, inactive) => {
    const { answer } = await activateGroup(
      { activation: UNSTATED_WARNING, inactive },
      analyseActivation,
    );
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError().message).toContain(
      'SAP answered no activationExecuted verdict and only warnings',
    );
    expect(answer.getError().message).toContain(
      "the activation's outcome could not be decided",
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

describe.each([
  ['a silent checklist', SILENT],
  ['a checklist with no verdict and warnings alone', UNSTATED_WARNING],
])('every activation member reads after %s', (_what, activation) => {
  it.each(ACTIVATING_APIS)(
    '%s reads once and names what its request named',
    async (api) => {
      const { analyse, seen } = spying();
      const { handler, config, calls } = activatingHandler(
        api,
        activation.data,
      );
      await handler.activate(config, {
        headers: headersOf(handler, 'activate', config),
        analyse,
      });

      const posts = calls.filter((c) => c.method === 'POST');
      expect(calls.map((c) => c.method)).toEqual(['POST', 'GET']);
      expect(calls[1]?.url).toBe(INACTIVE);
      expect(seen[0]?.context?.activation?.named).toEqual(
        urisIn(posts[0]?.data),
      );
      expect(seen[0]?.context?.activation?.named.length).toBeGreaterThan(0);
    },
  );
});

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

describe('the session mark: each answer names the request it is built from', () => {
  /**
   * Regression checks (interfaces-adt 27.3.0): the activation's answer and
   * the read after it are two requests. A failure carries the facts of the
   * request it was built from; a success the mark of the answer it was read
   * from. After a marked answer connection 23.0.0 rejects every later request
   * of the instance `ADT_NOT_CONNECTED`.
   */
  const REPLACED = ADT_SESSION_ERROR.SESSION_REPLACED;

  function connectionAnswering(
    activation: IAdtWireResponse,
    inactive: IAdtWireResponse | Error,
  ): IAbapConnection {
    return {
      connect: async () => undefined,
      getBaseUrl: async () => undefined,
      getSessionId: () => null,
      setSessionType: () => undefined,
      makeAdtRequest: async <T, D>(options: { url: string }) => {
        const answer = options.url === INACTIVE ? inactive : activation;
        if (answer instanceof Error) throw answer;
        return answer as IAdtWireResponse<T, D>;
      },
    };
  }

  const activate = (connection: IAbapConnection) =>
    connection.makeAdtRequest({
      method: 'POST',
      url: '/sap/bc/adt/activation',
      timeout: 0,
      data: `<adtcore:objectReference adtcore:uri="${GROUP}"/>`,
    });

  const spent = () =>
    Object.assign(new Error('the session is gone'), {
      code: ADT_SESSION_ERROR.NOT_CONNECTED,
    });

  it("a marked activation whose read is refused: the read's code, no mark", async () => {
    const answer = await answeringActivation(
      connectionAnswering({ ...SILENT, sessionLost: REPLACED }, spent()),
      activate,
      rawDocument,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError().sessionError).toBe(
      ADT_SESSION_ERROR.NOT_CONNECTED,
    );
    expect('sessionLost' in answer.getError()).toBe(false);
  });

  it("cleared, the success carries the activation answer's mark", async () => {
    const clears: IAnalyse = () => ADT_NO_FAILURE;
    const answer = await answeringActivation(
      connectionAnswering({ ...SILENT, sessionLost: REPLACED }, spent()),
      activate,
      rawDocument,
      clears,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.getResult().sessionLost).toBe(REPLACED);
  });

  it('a marked read after an unmarked activation: no mark on the answer', async () => {
    const answer = await answeringActivation(
      connectionAnswering(SILENT, { ...LISTED, sessionLost: REPLACED }),
      activate,
      rawDocument,
      () => ADT_NO_FAILURE,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect('sessionLost' in answer.getResult()).toBe(false);
  });
});

/**
 * A message's type as SAP may spell it: the client reads the list after
 * exactly the types adt-strategies reads as `W`, `I` or `S` (its
 * `severity()`), so the reading never meets a checklist it would decide by a
 * list the client did not read. Pinned by behaviour: for each spelling, the
 * client reads the list exactly when `readActivationRefusal`, given no list,
 * answers that the outcome could not be decided without it.
 */
describe('the client reads the list after the types the strategy reads as warnings', () => {
  const SPELLINGS = [
    'W',
    'w',
    ' W ',
    'warning',
    'Warning',
    'WARN',
    'I',
    'info',
    'Information',
    'S',
    'success',
    'OK',
    'tolerable',
    'E',
    'error',
    'critical',
    'fatal',
    'A',
    'X',
    '',
    'unknown',
  ];

  it.each(SPELLINGS)('type="%s"', async (type) => {
    const document = unstatedWith(type);
    const { analyse } = spying();
    const { sent } = await activateGroup(
      { activation: document, inactive: EMPTY },
      analyse,
    );
    const read = sent.some((r) => r.url === INACTIVE);
    const decidedByList =
      readActivationRefusal(document.data)?.message.includes(
        'without the list of inactive objects',
      ) === true;
    expect(read).toBe(decidedByList);
  });

  it.each(['warning', 'Information', 'success', 'OK', 'tolerable'])(
    'type="%s" is read after',
    async (type) => {
      const { analyse } = spying();
      const { sent } = await activateGroup(
        { activation: unstatedWith(type), inactive: EMPTY },
        analyse,
      );
      expect(sent.map((r) => r.method)).toEqual(['POST', 'GET']);
    },
  );
});

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
    const { analyse } = spying();
    const answered = activateGroup({ activation, inactive: refusal }, analyse);
    await expect(answered).rejects.toBe(refusal);
  });
});
