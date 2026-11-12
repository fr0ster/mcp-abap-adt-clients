import {
  ADT_NO_FAILURE,
  type IAdtAnalyseContext,
  type IAdtError,
} from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_SESSION_ERROR,
  type IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  analyseActivation,
  analyseAny,
  analyseCheck,
  analyseDebuggeeEnd,
  analyseDebuggerFreed,
  analyseDeletion,
  analyseException,
  analysePublicationLock,
  analyseUnitTest,
  analyseUnitTestStart,
  analyseUnsupportedStatus,
  analyseValidation,
  type IAdtActivationFailure,
  type IAdtMessageFailure,
} from '../refusals/analyse';
import { stillInactiveAmong } from '../refusals/read';
import { asItCame } from '../result';
import { answerFor, stepsOf, stepTagged } from './corpus';

/**
 * Every assertion is a pair: the recorded refusal, and the recorded success it
 * has to be told apart from. That pairing is the method, and it is not
 * ceremony — on most of these endpoints the refusal and the success share a
 * status, so a reading that fires on both looks correct and recognises nothing.
 *
 * One row was wrong when this file was first written: a table was listed under
 * validation, and a table answers `400` with an exception document rather than
 * `<SEVERITY>ERROR</SEVERITY>`. Only DDL sources and function groups use that
 * shape. The corpus said so on the first run.
 */

const failed = (
  verdict: IAdtError | typeof ADT_NO_FAILURE,
): IAdtMessageFailure => {
  expect(verdict).not.toBe(ADT_NO_FAILURE);
  return verdict as IAdtMessageFailure;
};

describe('each strategy separates its refusal from its success', () => {
  it.each([
    [
      'activation',
      analyseActivation,
      'refusal-activation-fails',
      'activation-success-verdict',
    ],
    [
      'check run, findings',
      analyseCheck,
      'refusal-syntax-check',
      'check-success-verdict',
    ],
    [
      'check run, never ran',
      analyseCheck,
      'refusal-check-nonexistent-object',
      'check-success-verdict',
    ],
    ['deletion', analyseDeletion, 'refusal-delete-refused', 'delete-success'],
    [
      'deletion check',
      analyseDeletion,
      'refusal-deletion-check-refuses',
      'deletion-check-allows',
    ],
    [
      'validation, DDL',
      analyseValidation,
      'refusal-validation-name-taken-ddl',
      'validation-name-free-ddl',
    ],
    [
      'validation, function group',
      analyseValidation,
      'refusal-validation-name-taken-functiongroup',
      'validation-name-free-ddl',
    ],
  ])('%s', (_label, analyse, refused, allowed) => {
    expect(analyse(ADT_NO_FAILURE, answerFor(refused))).not.toBe(
      ADT_NO_FAILURE,
    );
    expect(analyse(ADT_NO_FAILURE, answerFor(allowed))).toBe(ADT_NO_FAILURE);
  });

  it('reads the messages out, which is what a throw used to cost', () => {
    const verdict = failed(
      analyseActivation(ADT_NO_FAILURE, answerFor('refusal-activation-fails')),
    );
    expect(verdict.origin).toBe('refusal');
    expect(verdict.messages.length).toBeGreaterThan(0);
    expect(verdict.messages.some((m) => m.type === 'E')).toBe(true);
    expect(verdict.messages[0].text.length).toBeGreaterThan(0);
  });

  it('keeps the T100 key where the carrier supplies one', () => {
    const verdict = failed(
      analyseException(
        ADT_NO_FAILURE,
        answerFor('refusal-validation-name-taken-class'),
      ),
    );
    expect(verdict.adtType).toBe('InvalidClifName');
    expect(verdict.messages.some((m) => m.t100?.id)).toBe(true);
  });

  it('calls a check that never ran a refusal, though it carries no messages', () => {
    // The trap: `notProcessed` and a clean check are both 200 with zero
    // `checkMessage` elements. Only the status attribute separates them.
    const verdict = failed(
      analyseCheck(
        ADT_NO_FAILURE,
        answerFor('refusal-check-nonexistent-object'),
      ),
    );
    expect(verdict.messages.length).toBeGreaterThan(0);
  });

  it('reads a failing unit test run', () => {
    // Three steps: the POST, the status, then the result. The alerts are in
    // the last one.
    const steps = stepsOf('refusal-unittest-run-failing');
    const results = steps[steps.length - 1];
    expect(failed(analyseUnitTest(ADT_NO_FAILURE, results)).origin).toBe(
      'refusal',
    );

    const passing = stepsOf('unittest-run-passing');
    expect(analyseUnitTest(ADT_NO_FAILURE, passing[passing.length - 1])).toBe(
      ADT_NO_FAILURE,
    );
  });
});

describe('the dispatcher', () => {
  it.each([
    'refusal-activation-fails',
    'refusal-syntax-check',
    'refusal-check-nonexistent-object',
    'refusal-delete-refused',
    'refusal-deletion-check-refuses',
    'refusal-validation-name-taken-ddl',
    'refusal-validation-name-taken-functiongroup',
    'refusal-validation-name-taken-class',
    'refusal-validation-name-taken-domain',
    'refusal-validation-name-taken-table',
    'refusal-object-not-found',
    'refusal-lock-held-by-other',
    'refusal-write-not-locked',
    'refusal-package-not-found-tree',
  ])('recognises %s', (name) => {
    expect(analyseAny(ADT_NO_FAILURE, answerFor(name))).not.toBe(
      ADT_NO_FAILURE,
    );
  });

  it.each([
    'activation-success-verdict',
    'check-success-verdict',
    'delete-success',
    'deletion-check-allows',
    'validation-name-free-class',
    'validation-name-free-ddl',
    'validation-name-free-table',
    'lock-success',
    'read-class-source-text',
    'read-metadata-class',
  ])('leaves %s alone', (name) => {
    expect(analyseAny(ADT_NO_FAILURE, answerFor(name))).toBe(ADT_NO_FAILURE);
  });
});

describe('a verdict the library already reached', () => {
  it('is enriched from the document, never replaced', () => {
    const answer = answerFor('refusal-lock-held-by-other');
    const libraryVerdict: IAdtError = {
      origin: 'connection',
      message: 'Request failed with status code 403',
    };

    const verdict = failed(analyseException(libraryVerdict, answer));
    expect(verdict.origin).toBe('connection');
    expect(verdict.message).toBe(libraryVerdict.message);
    expect(verdict.messages.length).toBeGreaterThan(0);
  });

  it('still carries messages when the document says nothing', () => {
    const verdict = failed(
      analyseException(
        { origin: 'connection', message: 'no answer at all' },
        undefined,
      ),
    );
    expect(verdict.messages).toEqual([{ type: 'E', text: 'no answer at all' }]);
  });
});

describe('asItCame', () => {
  it('hands back XML unchanged', () => {
    const answer = answerFor('read-metadata-class');
    expect(asItCame(answer)).toBe(answer.data);
  });

  it('hands back source text unchanged', () => {
    const answer = answerFor('read-class-source-text');
    const text = asItCame(answer);
    expect(text).toBe(answer.data);
    expect(text).toContain('CLASS');
  });

  it('answers an empty string where the server sent nothing', () => {
    expect(asItCame({ data: undefined } as never)).toBe('');
  });
});

describe('the request the failure carries', () => {
  /**
   * **`request`, which is where `adt-clients` puts it.** This read `config`
   * alone — axios's field, and the one the repository this came from used. The
   * contract declares `IAdtWireResponse.request`, `withRequestTrace` writes
   * there, and so every failure this package built carried no request at all:
   * a refusal in a chain of six calls could not be located, which is the one
   * thing the field exists for.
   *
   * The first version of this test asserted the `config` shape and passed,
   * which is how a test locks a bug in place.
   */
  it('comes from the contract field the library writes', () => {
    const verdict = failed(
      analyseException(ADT_NO_FAILURE, {
        data: answerFor('refusal-lock-held-by-other').data,
        status: 403,
        request: { method: 'POST', url: '/sap/bc/adt/oo/classes/zcl_x' },
      } as never),
    );
    expect(verdict.request).toEqual({
      method: 'POST',
      url: '/sap/bc/adt/oo/classes/zcl_x',
    });
  });

  it('falls back to config for a transport nothing wrapped', () => {
    const verdict = failed(
      analyseException(ADT_NO_FAILURE, {
        data: answerFor('refusal-lock-held-by-other').data,
        status: 403,
        config: { method: 'GET', url: '/sap/bc/adt/oo/classes/zcl_y' },
      } as never),
    );
    expect(verdict.request).toEqual({
      method: 'GET',
      url: '/sap/bc/adt/oo/classes/zcl_y',
    });
  });

  it('prefers the contract field when an answer carries both', () => {
    const verdict = failed(
      analyseException(ADT_NO_FAILURE, {
        data: answerFor('refusal-lock-held-by-other').data,
        status: 403,
        request: { method: 'POST', url: '/the/traced/one' },
        config: { method: 'GET', url: '/the/transport/one' },
      } as never),
    );
    expect(verdict.request?.url).toBe('/the/traced/one');
  });

  it('is absent when the answer carries no config', () => {
    const verdict = failed(
      analyseException(ADT_NO_FAILURE, answerFor('refusal-lock-held-by-other')),
    );
    expect(verdict.request).toBeUndefined();
  });
});

describe('analysePublicationLock', () => {
  const libraryVerdict = (status: number): IAdtError => ({
    origin: 'connection',
    message: `Request failed with status code ${status}`,
  });

  it('lets the 403 of a binding someone is editing through', () => {
    expect(
      analysePublicationLock(
        libraryVerdict(403),
        answerFor('refusal-lock-held-by-other'),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('passes a granted lock as it came', () => {
    expect(
      analysePublicationLock(ADT_NO_FAILURE, answerFor('lock-success')),
    ).toBe(ADT_NO_FAILURE);
  });

  it('reads every other refusal as analyseException does', () => {
    const answer = answerFor('refusal-write-not-locked');
    const verdict = failed(analysePublicationLock(libraryVerdict(423), answer));
    expect(verdict).toEqual(analyseException(libraryVerdict(423), answer));
  });

  it('does not take a failure without an answer for a 403', () => {
    failed(
      analysePublicationLock(
        { origin: 'connection', message: 'timeout of 45000ms exceeded' },
        undefined,
      ),
    );
  });
});

describe('analyseDebuggeeEnd', () => {
  const libraryVerdict = (status: number): IAdtError => ({
    origin: 'connection',
    message: `Request failed with status code ${status}`,
  });

  it('lets a step that ran the program to its end through', () => {
    expect(
      analyseDebuggeeEnd(
        libraryVerdict(500),
        stepTagged('debugger-run-to-line', 'stepcontinue'),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('lets a termination through', () => {
    expect(
      analyseDebuggeeEnd(
        libraryVerdict(500),
        stepTagged('debugger-terminate', 'terminate-debuggee'),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('passes a step that stopped as it came', () => {
    expect(
      analyseDebuggeeEnd(
        ADT_NO_FAILURE,
        stepTagged('debugger-conversation', 'stepover'),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('keeps a request after the end a refusal', () => {
    expect(
      analyseDebuggeeEnd(
        libraryVerdict(400),
        stepTagged('debugger-conversation', 'stepcontinue'),
      ),
    ).not.toBe(ADT_NO_FAILURE);
  });

  it('keeps run to a line without the line a refusal', () => {
    expect(
      analyseDebuggeeEnd(
        libraryVerdict(400),
        stepTagged('debugger-conversation', 'stepruntoline-no-uri'),
      ),
    ).not.toBe(ADT_NO_FAILURE);
  });
});

describe('analyseDebuggerFreed', () => {
  const answer = (
    status: number,
    data: unknown,
    contentType?: string,
  ): IAdtWireResponse =>
    ({
      status,
      data,
      headers: contentType ? { 'Content-Type': contentType } : {},
    }) as unknown as IAdtWireResponse;
  const verdictFor = (status: number): IAdtError => ({
    origin: 'connection',
    message: `Request failed with status code ${status}`,
    response: { status } as IAdtError['response'],
  });
  const document = (prefix: string | null) => {
    const tag = prefix ? `${prefix}:exception` : 'exception';
    const ns = prefix ? `xmlns:${prefix}` : 'xmlns';
    return `\uFEFF\n<?xml version="1.0"?><${tag} ${ns}="http://www.sap.com/abapxml/types/communicationframework"><type id="AdiFailed"/><message>x</message></${tag}>`;
  };

  it('answers a text/plain 500 as no failure', () => {
    expect(
      analyseDebuggerFreed(
        verdictFor(500),
        answer(500, 'Internal Server Error', 'text/plain; charset=utf-8'),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('answers an empty-body 500 as no failure', () => {
    expect(
      analyseDebuggerFreed(verdictFor(500), answer(500, '', 'text/html')),
    ).toBe(ADT_NO_FAILURE);
  });

  it('keeps a 500 with an exception document a refusal, whatever the prefix', () => {
    for (const prefix of ['exc', 'ns0', null]) {
      expect(
        analyseDebuggerFreed(
          verdictFor(500),
          answer(500, document(prefix), 'text/plain'),
        ),
      ).not.toBe(ADT_NO_FAILURE);
    }
  });

  it('keeps a text/html 500 a failure', () => {
    expect(
      analyseDebuggerFreed(
        verdictFor(500),
        answer(500, '<html>Bad gateway</html>', 'text/html'),
      ),
    ).not.toBe(ADT_NO_FAILURE);
  });

  it('keeps a body that is not a string a failure', () => {
    for (const body of [Buffer.from('boom'), { a: 1 }, undefined]) {
      expect(
        analyseDebuggerFreed(verdictFor(500), answer(500, body, 'text/plain')),
      ).not.toBe(ADT_NO_FAILURE);
    }
  });

  it('keeps a 400 a refusal', () => {
    expect(
      analyseDebuggerFreed(
        verdictFor(400),
        answer(400, 'Session no longer exists', 'text/plain'),
      ),
    ).not.toBe(ADT_NO_FAILURE);
  });

  it('reads the status from the answer when the verdict carries none', () => {
    const bare: IAdtError = { origin: 'connection', message: 'failed' };
    expect(analyseDebuggerFreed(bare, answer(500, 'x', 'TEXT/PLAIN'))).toBe(
      ADT_NO_FAILURE,
    );
  });

  it('keeps a failure without a response a failure', () => {
    expect(
      analyseDebuggerFreed(
        { origin: 'connection', message: 'ECONNRESET' },
        undefined,
      ),
    ).not.toBe(ADT_NO_FAILURE);
  });
});

/**
 * The activation table (fr0ster/mcp-abap-adt#351; the table and its measurements: ERRATA.md), one case per row, on
 * recorded answers where one exists. Each assertion names what only its row
 * produces: the sentence about the document, or the objects SAP listed.
 */
describe('analyseActivation answers every row of the activation table', () => {
  const activationFailure = (
    verdict: IAdtActivationFailure | typeof ADT_NO_FAILURE,
  ): IAdtActivationFailure => {
    if (verdict === ADT_NO_FAILURE) {
      throw new Error('expected a failure, got ADT_NO_FAILURE');
    }
    return verdict;
  };
  /** The facts the member hands beside a silent checklist. */
  const listed = (
    named: readonly string[],
    inactiveObjects: IAdtWireResponse,
  ): IAdtAnalyseContext => ({ activation: { named, inactiveObjects } });
  const wire = (data: string): IAdtWireResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
  });
  const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';
  const PROBE = '/sap/bc/adt/oo/classes/zcl_act751_probe_9335';

  it('751: an ioc answer is not activated, its 8 objects named', () => {
    const verdict = activationFailure(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-preaudit-still-inactive-751'),
      ),
    );
    expect(verdict.message).toContain(
      'SAP answered the objects still inactive',
    );
    expect(verdict.stillInactive).toHaveLength(8);
    expect(verdict.stillInactive[0]).toEqual({
      uri: '/sap/bc/adt/oo/classes/zcl_ai_act_probe',
      type: 'CLAS/OC',
      name: 'ZCL_AI_ACT_PROBE',
    });
    expect(verdict.stillInactive[1]).toEqual({
      uri: '/sap/bc/adt/oo/classes/zcl_ai_act_probe/includes/definitions',
      type: 'CLAS/OCN/definitions',
      name: 'ZCL_AI_ACT_PROBE',
      parentUri: '/sap/bc/adt/oo/classes/zcl_ai_act_probe',
    });
  });

  it('an ioc answer with a transport entry skips the transport', () => {
    const verdict = activationFailure(
      analyseActivation(ADT_NO_FAILURE, answerFor('activation-still-inactive')),
    );
    expect(verdict.stillInactive.map((o) => o.uri)).toEqual([
      '/sap/bc/adt/functions/groups/zmcp_bld_fgr_l1',
      '/sap/bc/adt/functions/groups/zmcp_bld_fgr_l1/source/main',
    ]);
    expect(verdict.stillInactive.some((o) => o.type === '/RQ')).toBe(false);
  });

  it('S/4HANA 2025: the ioc answer to the group alone is not activated', () => {
    const verdict = activationFailure(
      analyseActivation(
        ADT_NO_FAILURE,
        stepsOf('activation-group-alone-s4-2025')[0],
      ),
    );
    expect(verdict.stillInactive.map((o) => o.uri)).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
  });

  it('an empty answer to preauditRequested=true is activated (7.40)', () => {
    const answer = stepsOf('activation-class-basis-740')[0];
    expect(answer.data).toBe('');
    expect(analyseActivation(ADT_NO_FAILURE, answer)).toBe(ADT_NO_FAILURE);
  });

  it('an empty answer to preauditRequested=false is activated (751)', () => {
    const answer = answerFor('activation-sync-activated-751');
    expect(answer.data).toBe('');
    expect(analyseActivation(ADT_NO_FAILURE, answer)).toBe(ADT_NO_FAILURE);
  });

  it.each([
    ['a document of another kind', '<?xml version="1.0"?><a:b xmlns:a="x"/>'],
    ['a document that does not parse', '<?xml version="1.0"?><chkl:messages'],
    ['text that is not XML', 'Activated.'],
  ])('%s is not activated: the answer does not state it', (_what, data) => {
    const verdict = activationFailure(
      analyseActivation(ADT_NO_FAILURE, wire(data)),
    );
    expect(verdict.message).toContain('does not state the activation');
    expect(verdict.stillInactive).toEqual([]);
  });

  it('silent checklist: a silent checklist with the group still listed is not activated', () => {
    const steps = stepsOf('activation-group-alone-s4-2025');
    const verdict = activationFailure(
      analyseActivation(ADT_NO_FAILURE, steps[3], listed([GROUP], steps[4])),
    );
    expect(verdict.message).toContain('the inactive list still names');
    expect(verdict.stillInactive.map((o) => o.uri)).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
  });

  it('silent checklist: a silent checklist after a re-activation is nothing to activate', () => {
    const steps = stepsOf('activation-reactivate-active-s4-2025');
    expect(
      analyseActivation(ADT_NO_FAILURE, steps[2], listed([PROBE], steps[3])),
    ).toBe(ADT_NO_FAILURE);
  });

  it('silent checklist: an entry counts by its parentUri', () => {
    const list = wire(
      '<?xml version="1.0" encoding="utf-8"?><ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects"><ioc:entry><ioc:object ioc:user="" ioc:deleted="false"><ioc:ref adtcore:uri="/sap/bc/adt/oo/classes/zcl_x/includes/definitions" adtcore:type="CLAS/OCN/definitions" adtcore:name="ZCL_X" adtcore:parentUri="/sap/bc/adt/oo/classes/zcl_x" xmlns:adtcore="http://www.sap.com/adt/core"/></ioc:object><ioc:transport/></ioc:entry></ioc:inactiveObjects>',
    );
    const verdict = activationFailure(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-nothing-to-activate'),
        listed(['/sap/bc/adt/oo/classes/zcl_x'], list),
      ),
    );
    expect(verdict.stillInactive.map((o) => o.uri)).toEqual([
      '/sap/bc/adt/oo/classes/zcl_x/includes/definitions',
    ]);
  });

  it('silent checklist: the transport-only entry is never counted', () => {
    // The request's own transport named, to show the transport entry is not
    // read at all rather than merely not matched.
    const steps = stepsOf('activation-group-alone-s4-2025');
    expect(
      analyseActivation(
        ADT_NO_FAILURE,
        steps[3],
        listed(['/sap/bc/adt/cts/transportrequests/SYSK9R0001'], steps[4]),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('silent checklist: the flat 7.40 list is read like the ioc list', () => {
    const list = stepsOf('activation-class-basis-740')[1];
    const verdict = activationFailure(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-nothing-to-activate'),
        listed(['/sap/bc/adt/programs/programs/zok_tester'], list),
      ),
    );
    expect(verdict.stillInactive).toEqual([
      {
        uri: '/sap/bc/adt/programs/programs/zok_tester',
        type: 'PROG/P',
        name: 'ZOK_TESTER',
      },
    ]);
  });

  it('silent checklist: an object listed but not named is not counted', () => {
    const list = stepsOf('activation-class-basis-740')[1];
    expect(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-nothing-to-activate'),
        listed(['/sap/bc/adt/oo/classes/zcl_act751_probe_3748'], list),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('silent checklist without the list: the outcome could not be decided', () => {
    const verdict = activationFailure(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-nothing-to-activate'),
      ),
    );
    expect(verdict.message).toContain(
      "the activation's outcome could not be decided",
    );
    expect(verdict.stillInactive).toEqual([]);
  });

  it('silent checklist on ABAP cloud with an empty list: nothing to activate', () => {
    const empty = stepsOf('activation-reactivate-active-s4-2025')[3];
    expect(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-nothing-to-activate'),
        listed(['/sap/bc/adt/oo/classes/zmcp_bld_ansch01'], empty),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('silent checklist with a list that is no inactive-objects document: not decided', () => {
    const verdict = activationFailure(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-nothing-to-activate'),
        listed([GROUP], wire('<?xml version="1.0"?><a:b xmlns:a="x"/>')),
      ),
    );
    expect(verdict.message).toContain('the inactive list could not be read');
  });

  it('an E refusal stays a refusal, with its messages', () => {
    const verdict = activationFailure(
      analyseActivation(ADT_NO_FAILURE, answerFor('refusal-activation-fails')),
    );
    expect(verdict.messages.some((m) => m.type === 'E')).toBe(true);
    expect(verdict.message).toContain('STRONG_BUT_NOT_A_REAL_TYPE');
    expect(verdict.stillInactive).toEqual([]);
  });

  it('activationExecuted="true" without an E is activated', () => {
    expect(
      analyseActivation(
        ADT_NO_FAILURE,
        answerFor('activation-success-verdict'),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it("the library's failure is enriched and names nothing still inactive", () => {
    const verdict = activationFailure(
      analyseActivation(
        { origin: 'refusal', message: 'Request failed with status code 404' },
        answerFor('activation-runs-absent-751'),
      ),
    );
    expect(verdict.message).toBe('Request failed with status code 404');
    expect(verdict.stillInactive).toEqual([]);
  });
});

describe('stillInactiveAmong, the one judgement of both activation paths', () => {
  const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';

  it('S/4HANA 2025 list 05 names the group and its main program', () => {
    const list = stepsOf('activation-group-alone-s4-2025')[4];
    expect(stillInactiveAmong([GROUP], list)?.map((o) => o.name)).toEqual([
      'ZACT751P9325',
      'SAPLZACT751P9325',
    ]);
  });

  it('S/4HANA 2025 list 04 after a re-activation names none', () => {
    const list = stepsOf('activation-reactivate-active-s4-2025')[3];
    expect(
      stillInactiveAmong(
        ['/sap/bc/adt/oo/classes/zcl_act751_probe_9335'],
        list,
      ),
    ).toEqual([]);
  });

  it('matches by parentUri', () => {
    const list = stepsOf('activation-group-alone-s4-2025')[4];
    // Named only through the parent: the source/main entry carries the group
    // as its parentUri, the group's own entry has none.
    const found = stillInactiveAmong([GROUP], list) ?? [];
    expect(found.find((o) => o.type === 'FUGR/I')?.parentUri).toBe(GROUP);
  });

  it('never counts the transport-only entry', () => {
    const list = stepsOf('activation-group-alone-s4-2025')[4];
    expect(
      stillInactiveAmong(
        [
          '/sap/bc/adt/cts/transportrequests/SYSK9R0001',
          '/sap/bc/adt/cts/transportrequests/SYSK9R0002',
        ],
        list,
      ),
    ).toEqual([]);
  });

  it('reads the flat 7.40 list', () => {
    const list = stepsOf('activation-class-basis-740')[1];
    expect(
      stillInactiveAmong(['/sap/bc/adt/programs/programs/zok_tester'], list),
    ).toEqual([
      {
        uri: '/sap/bc/adt/programs/programs/zok_tester',
        type: 'PROG/P',
        name: 'ZOK_TESTER',
      },
    ]);
  });

  it('does not count an object that is listed but not named', () => {
    const list = stepsOf('activation-class-basis-740')[1];
    expect(
      stillInactiveAmong(
        ['/sap/bc/adt/oo/classes/zcl_act751_probe_3748'],
        list,
      ),
    ).toEqual([]);
  });

  it('answers null for an answer that is no inactive-objects list', () => {
    expect(
      stillInactiveAmong([GROUP], answerFor('activation-success-verdict')),
    ).toBeNull();
  });
});

describe('analyseAny hands an activation its facts', () => {
  const silent = () => stepsOf('activation-reactivate-active-s4-2025')[2];
  const emptyList = () => stepsOf('activation-reactivate-active-s4-2025')[3];
  const PROBE = '/sap/bc/adt/oo/classes/zcl_act751_probe_9335';

  it('a silent checklist with an empty inactive list is no failure, as analyseActivation says', () => {
    const context = {
      activation: { named: [PROBE], inactiveObjects: emptyList() },
    };
    expect(analyseActivation(ADT_NO_FAILURE, silent(), context)).toBe(
      ADT_NO_FAILURE,
    );
    expect(analyseAny(ADT_NO_FAILURE, silent(), context)).toBe(ADT_NO_FAILURE);
  });

  it('a silent checklist with the object still listed is not activated', () => {
    const steps = stepsOf('activation-group-alone-s4-2025');
    const verdict = analyseAny(ADT_NO_FAILURE, steps[3], {
      activation: {
        named: ['/sap/bc/adt/functions/groups/zact751p9325'],
        inactiveObjects: steps[4],
      },
    });
    expect(verdict).not.toBe(ADT_NO_FAILURE);
    expect(verdict !== ADT_NO_FAILURE && verdict.message).toContain(
      'the inactive list still names',
    );
  });
});

describe('the SAP session mark', () => {
  /**
   * A refusal read from a 2xx answer is built here, from the answer: the
   * connection's `sessionLost` on that answer (interfaces-adt-connection 4.2.0)
   * is copied onto it, so a consumer reads it by field. A verdict the library
   * reached is enriched by spreading, so its session fields survive as they
   * came.
   */
  const marked = (answer: IAdtWireResponse): IAdtWireResponse => ({
    ...answer,
    sessionLost: ADT_SESSION_ERROR.SESSION_REPLACED,
  });

  it('a refusal read from a marked answer carries sessionLost', () => {
    const verdict = failed(
      analyseException(
        ADT_NO_FAILURE,
        marked(answerFor('refusal-lock-held-by-other')),
      ),
    );
    expect(verdict.sessionLost).toBe(ADT_SESSION_ERROR.SESSION_REPLACED);
  });

  it('a refusal read from an unmarked answer has no sessionLost key', () => {
    const verdict = failed(
      analyseException(ADT_NO_FAILURE, answerFor('refusal-lock-held-by-other')),
    );
    expect('sessionLost' in verdict).toBe(false);
  });

  it('a unit-test start without a run id, marked, carries sessionLost', () => {
    const answer = {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '',
      sessionLost: ADT_SESSION_ERROR.SESSION_REPLACED,
    } as IAdtWireResponse;
    const verdict = failed(analyseUnitTestStart(ADT_NO_FAILURE, answer));
    expect(verdict.sessionLost).toBe(ADT_SESSION_ERROR.SESSION_REPLACED);
  });

  it('a unit-test start without a run id, unmarked, has no sessionLost key', () => {
    const answer = {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '',
    } as IAdtWireResponse;
    const verdict = failed(analyseUnitTestStart(ADT_NO_FAILURE, answer));
    expect('sessionLost' in verdict).toBe(false);
  });

  const libraryVerdict: IAdtError = {
    origin: 'connection',
    message: 'Request failed with status code 403',
    sessionError: ADT_SESSION_ERROR.SESSION_REPLACED,
    sessionLost: ADT_SESSION_ERROR.SESSION_REPLACED,
  };

  it('enriching the library verdict keeps its session fields', () => {
    const verdict = failed(
      analyseException(libraryVerdict, answerFor('refusal-lock-held-by-other')),
    );
    expect(verdict.sessionError).toBe(ADT_SESSION_ERROR.SESSION_REPLACED);
    expect(verdict.sessionLost).toBe(ADT_SESSION_ERROR.SESSION_REPLACED);
  });

  it('renaming an unsupported status keeps the session fields', () => {
    const verdict = failed(
      analyseUnsupportedStatus([403], 'this resource')(libraryVerdict, {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        data: '',
      } as IAdtWireResponse),
    );
    expect(verdict.sessionError).toBe(ADT_SESSION_ERROR.SESSION_REPLACED);
    expect(verdict.sessionLost).toBe(ADT_SESSION_ERROR.SESSION_REPLACED);
  });
});
