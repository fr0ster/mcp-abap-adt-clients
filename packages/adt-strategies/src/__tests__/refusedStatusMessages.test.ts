import {
  ADT_NO_FAILURE,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  analyseActivation,
  analyseAny,
  analyseCheck,
  analyseException,
  type IAdtMessageFailure,
} from '../refusals/analyse';
import { answerFor, stepsOf } from './corpus';

/**
 * A check or an activation refused with a non-2xx status gives exactly the
 * messages the 200 reading gives for the same body — position, uri, object,
 * code and the deprecated line included. Until 0.23.3 every analyser read
 * such an answer with the exception reading alone, and a check-run report or
 * an activation checklist came back as one `E` carrying the library's
 * sentence.
 *
 * Every case is a parity: the same body through the form's own analyser on a
 * 200, and through each analyser on a 400.
 */

const CHECKRUN_NS = 'http://www.sap.com/adt/checkrun';
const CHECKLIST_NS = 'http://www.sap.com/abapxml/checklist';
const XML = '<?xml version="1.0" encoding="utf-8"?>';

/** A body served with a status; the library's verdict for a non-2xx one. */
const served = (
  data: string,
  status: number,
): { answer: IAdtWireResponse; verdict: IAdtError } => {
  const answer: IAdtWireResponse = {
    data,
    status,
    statusText: '',
    headers: {},
  };
  return {
    answer,
    verdict: {
      origin: 'refusal',
      message: `Request failed with status code ${status}`,
      response: answer,
    },
  };
};

const failure = (
  judged: IAdtMessageFailure | typeof ADT_NO_FAILURE,
): IAdtMessageFailure => {
  if (judged === ADT_NO_FAILURE) throw new Error('expected a failure');
  return judged;
};

/** What the form's own analyser answers for the body on a 200. */
const on200 = (
  form: IAnalyse<IAdtMessageFailure>,
  data: string,
): IAdtMessageFailure =>
  failure(form(ADT_NO_FAILURE, served(data, 200).answer));

/** What an analyser answers for the body on a 400. */
const on400 = (
  analyse: IAnalyse<IAdtMessageFailure>,
  data: string,
): IAdtMessageFailure => {
  const { answer, verdict } = served(data, 400);
  return failure(analyse(verdict, answer));
};

/** The sentence a non-2xx answer gets when its body says nothing readable. */
const FALLBACK = [{ type: 'E', text: 'Request failed with status code 400' }];

const SYNTAX_FINDING = {
  type: 'E',
  text: 'Type "STRONG_BUT_NOT_A_REAL_TYPE" is unknown.',
  uri: '/sap/bc/adt/oo/classes/zmcp_bld_ansch01/source/main',
  position: { line: 15, column: 24, end: { line: 15, column: 50 } },
  line: '15',
  code: 'MESSAGE(GTH)',
};

const recorded = (caseName: string): string => String(answerFor(caseName).data);

/** A warning-only processed report, then a report with an error. */
const MULTI_REPORT = `${XML}<chkrun:checkRunReports xmlns:chkrun="${CHECKRUN_NS}"><chkrun:checkReport chkrun:status="processed" chkrun:statusText="A checked"><chkrun:checkMessageList><chkrun:checkMessage chkrun:uri="/a/source/main#start=3,4" chkrun:type="W" chkrun:shortText="a warning"/></chkrun:checkMessageList></chkrun:checkReport><chkrun:checkReport chkrun:status="processed" chkrun:statusText="B checked"><chkrun:checkMessageList><chkrun:checkMessage chkrun:uri="/b/source/main#start=7,1" chkrun:type="E" chkrun:shortText="an error" chkrun:code="MESSAGE(X)"/></chkrun:checkMessageList></chkrun:checkReport></chkrun:checkRunReports>`;

/** The recorded syntax check, under another prefix and the default namespace. */
const RENAMED_CHECKRUN = recorded('refusal-syntax-check')
  .replaceAll('chkrun:', 'cr:')
  .replace('xmlns:chkrun=', 'xmlns:cr=');
const DEFAULT_NS_CHECKRUN = recorded('refusal-syntax-check')
  .replaceAll('chkrun:', '')
  .replace(`xmlns:chkrun="${CHECKRUN_NS}"`, `xmlns="${CHECKRUN_NS}"`);
const RENAMED_CHECKLIST = recorded('refusal-activation-fails')
  .replaceAll('chkl:', 'cl:')
  .replace('xmlns:chkl=', 'xmlns:cl=');

const BARE_EMPTY_REPORT = `${XML}<chkrun:checkReport xmlns:chkrun="${CHECKRUN_NS}"/>`;
const EMPTY_REPORTS = `${XML}<chkrun:checkRunReports xmlns:chkrun="${CHECKRUN_NS}"/>`;

/** A checklist with one warning, no activationExecuted. */
const WARNING_ONLY = `${XML}<chkl:messages xmlns:chkl="${CHECKLIST_NS}"><msg objDescr="Program ZP" type="W" line="1" href="/p/source/main#start=2,0"><shortText><txt>a warning</txt></shortText></msg></chkl:messages>`;

const CHECK_ANALYSERS = [
  ['analyseCheck', analyseCheck],
  ['analyseException', analyseException],
  ['analyseAny', analyseAny],
] as const;

const ACTIVATION_ANALYSERS = [
  ['analyseActivation', analyseActivation],
  ['analyseException', analyseException],
  ['analyseAny', analyseAny],
] as const;

describe('a check run refused with a non-2xx status gives what a 200 gives', () => {
  it.each(CHECK_ANALYSERS)('the recorded syntax check: %s', (_n, analyse) => {
    const body = recorded('refusal-syntax-check');
    const judged = on400(analyse, body);
    expect(judged.messages).toStrictEqual(on200(analyseCheck, body).messages);
    expect(judged.messages).toStrictEqual([SYNTAX_FINDING]);
    // The library's verdict is enriched, not replaced.
    expect(judged.message).toBe('Request failed with status code 400');
    expect(judged.origin).toBe('refusal');
  });

  it.each(CHECK_ANALYSERS)('a report that did not run: %s', (_n, analyse) => {
    const body = recorded('refusal-check-nonexistent-object');
    expect(on400(analyse, body).messages).toStrictEqual(
      on200(analyseCheck, body).messages,
    );
  });

  it.each(CHECK_ANALYSERS)(
    'a warning-only report, then an error report: %s',
    (_n, analyse) => {
      const expected = on200(analyseCheck, MULTI_REPORT).messages;
      expect(expected.map((m) => m.type)).toStrictEqual(['E']);
      expect(on400(analyse, MULTI_REPORT).messages).toStrictEqual(expected);
    },
  );

  it.each([
    ['another prefix', RENAMED_CHECKRUN],
    ['the default namespace', DEFAULT_NS_CHECKRUN],
  ])('the namespace decides, not the prefix: %s', (_label, body) => {
    expect(on200(analyseCheck, body).messages).toStrictEqual([SYNTAX_FINDING]);
    for (const [, analyse] of CHECK_ANALYSERS) {
      expect(on400(analyse, body).messages).toStrictEqual([SYNTAX_FINDING]);
    }
  });

  it('a bare checkReport with nothing in it: what the 200 reading gives', () => {
    const expected = on200(analyseCheck, BARE_EMPTY_REPORT).messages;
    expect(expected).toStrictEqual([
      { type: 'E', text: 'Check did not run (status: unstated)', code: '' },
    ]);
    for (const [, analyse] of CHECK_ANALYSERS) {
      expect(on400(analyse, BARE_EMPTY_REPORT).messages).toStrictEqual(
        expected,
      );
    }
  });

  it.each([
    ['a space', '</r:checkRunReports >'],
    ['a line break', '</r:checkRunReports\n>'],
  ])('a root closing tag with %s: read as on a 200', (_label, closing) => {
    const body = recorded('refusal-syntax-check')
      .replaceAll('chkrun:', 'r:')
      .replace('xmlns:chkrun=', 'xmlns:r=')
      .replace('</r:checkRunReports>', closing);
    expect(body).toContain(closing);
    expect(on200(analyseCheck, body).messages).toStrictEqual([SYNTAX_FINDING]);
    for (const [, analyse] of CHECK_ANALYSERS) {
      expect(on400(analyse, body).messages).toStrictEqual([SYNTAX_FINDING]);
    }
  });

  it('a bare report whose closing tag has a space: read as on a 200', () => {
    const body = `${XML}<r:checkReport xmlns:r="${CHECKRUN_NS}" r:status="notProcessed" r:statusText="gone"></r:checkReport >`;
    const expected = on200(analyseCheck, body).messages;
    expect(expected).toStrictEqual([
      { type: 'E', text: 'gone', code: 'notProcessed' },
    ]);
    for (const [, analyse] of CHECK_ANALYSERS) {
      expect(on400(analyse, body).messages).toStrictEqual(expected);
    }
  });

  it('an empty checkRunReports: no refusal on a 200, the verdict on a 400', () => {
    expect(
      analyseCheck(ADT_NO_FAILURE, served(EMPTY_REPORTS, 200).answer),
    ).toBe(ADT_NO_FAILURE);
    for (const [, analyse] of CHECK_ANALYSERS) {
      expect(on400(analyse, EMPTY_REPORTS).messages).toStrictEqual(FALLBACK);
    }
  });
});

describe('an activation checklist refused with a non-2xx status gives what a 200 gives', () => {
  it.each(ACTIVATION_ANALYSERS)('the recorded refusal: %s', (_n, analyse) => {
    const body = recorded('refusal-activation-fails');
    const expected = on200(analyseActivation, body).messages;
    expect(expected[0]).toStrictEqual({
      ...SYNTAX_FINDING,
      object: 'Class ZMCP_BLD_ANSCH01, Method SAY_HELLO',
    });
    expect(on400(analyse, body).messages).toStrictEqual(expected);
  });

  it.each(ACTIVATION_ANALYSERS)(
    'a root closing tag with a line break: %s',
    (_n, analyse) => {
      const body = recorded('refusal-activation-fails')
        .replaceAll('chkl:', 'c:')
        .replace('xmlns:chkl=', 'xmlns:c=')
        .replace('</c:messages>', '</c:messages\n>');
      expect(body).toContain('</c:messages\n>');
      expect(on400(analyse, body).messages).toStrictEqual(
        on200(analyseActivation, recorded('refusal-activation-fails')).messages,
      );
    },
  );

  it.each(ACTIVATION_ANALYSERS)('another prefix: %s', (_n, analyse) => {
    const expected = on200(
      analyseActivation,
      recorded('refusal-activation-fails'),
    ).messages;
    expect(on400(analyse, RENAMED_CHECKLIST).messages).toStrictEqual(expected);
  });

  it.each(ACTIVATION_ANALYSERS)(
    'one warning, no activationExecuted, no inactive list: %s',
    (_n, analyse) => {
      const expected = on200(analyseActivation, WARNING_ONLY).messages;
      expect(expected.map((m) => m.type)).toStrictEqual(['E', 'W']);
      expect(on400(analyse, WARNING_ONLY).messages).toStrictEqual(expected);
    },
  );

  it('with the inactive list: the same messages and stillInactive', () => {
    // The recorded list naming the function group; the activation named it.
    const context = {
      activation: {
        named: ['/sap/bc/adt/functions/groups/zact751p9325'],
        inactiveObjects: stepsOf('activation-group-alone-s4-2025')[4],
      },
    };
    const ok = analyseActivation(
      ADT_NO_FAILURE,
      served(WARNING_ONLY, 200).answer,
      context,
    );
    const { answer, verdict } = served(WARNING_ONLY, 400);
    const refused = analyseActivation(verdict, answer, context);
    if (ok === ADT_NO_FAILURE || refused === ADT_NO_FAILURE) {
      throw new Error('expected a failure');
    }
    expect(ok.stillInactive.length).toBeGreaterThan(0);
    expect(refused.messages).toStrictEqual(ok.messages);
    expect(refused.stillInactive).toStrictEqual(ok.stillInactive);
  });

  it('carries no inactive objects for a checklist that names none', () => {
    const { answer, verdict } = served(
      recorded('refusal-activation-fails'),
      400,
    );
    const judged = analyseActivation(verdict, answer);
    if (judged === ADT_NO_FAILURE) throw new Error('expected a failure');
    expect(judged.stillInactive).toStrictEqual([]);
  });
});

describe('a body that only looks like one keeps the 0.23.2 answer', () => {
  it.each([
    [
      'a foreign namespace with the checklist local name',
      `${XML}<api:messages xmlns:api="urn:gateway"><msg type="E" href="/p#start=1,0"><shortText><txt>foreign</txt></shortText></msg></api:messages>`,
    ],
    [
      'a foreign namespace with the check-run local name',
      `${XML}<x:checkRunReports xmlns:x="urn:gateway"><x:checkReport x:status="notProcessed" x:statusText="foreign"/></x:checkRunReports>`,
    ],
    [
      'no namespace at all',
      `${XML}<messages><msg type="E"><shortText><txt>foreign</txt></shortText></msg></messages>`,
    ],
    [
      'a page followed by a report',
      `<html><body>gateway</body></html><chkrun:checkReport xmlns:chkrun="${CHECKRUN_NS}" chkrun:status="notProcessed" chkrun:statusText="trailing"/>`,
    ],
    [
      'text followed by a report',
      `leading<chkrun:checkReport xmlns:chkrun="${CHECKRUN_NS}" chkrun:status="notProcessed" chkrun:statusText="leading"/>`,
    ],
  ])('%s', (_label, body) => {
    for (const [, analyse] of [...CHECK_ANALYSERS, ...ACTIVATION_ANALYSERS]) {
      expect(on400(analyse, body).messages).toStrictEqual(FALLBACK);
    }
  });
});

describe('an exception document refused with a non-2xx status', () => {
  /** The 0.23.2 answer, written out: the exception reading's, T100 key included. */
  const expectedFor = (answer: IAdtWireResponse) => ({
    origin: 'refusal',
    message: 'Request failed with status code 404',
    response: answer,
    adtType: 'ExceptionResourceNotFound',
    namespace: 'com.sap.adt',
    messages: [
      {
        type: 'E',
        text: 'Resource CLASS ZMCP_BLD_NOPE_CLS99 does not exist.',
        code: 'ExceptionResourceNotFound',
        t100: {
          id: 'SADT_RESOURCE',
          no: '002',
          values: ['CLASS', 'ZMCP_BLD_NOPE_CLS99'],
        },
      },
    ],
  });

  it.each([
    ['analyseCheck', analyseCheck],
    ['analyseException', analyseException],
    ['analyseAny', analyseAny],
  ] as const)('answers as 0.23.2 did: %s', (_n, analyse) => {
    const { answer, verdict } = served(
      recorded('refusal-object-not-found'),
      404,
    );
    expect(analyse(verdict, answer)).toStrictEqual(expectedFor(answer));
  });

  it('answers as 0.23.2 did: analyseActivation', () => {
    const { answer, verdict } = served(
      recorded('refusal-object-not-found'),
      404,
    );
    expect(analyseActivation(verdict, answer)).toStrictEqual({
      ...expectedFor(answer),
      stillInactive: [],
    });
  });
});

/**
 * The activation answered 200 with a silent checklist, and the inactive-list
 * read after it failed 500: the caller hands the activation's answer with
 * the read's failure as the verdict (adt-clients 48.0.0's `activationExchange`
 * did; since 49.0.0 the caller's recipe does). The
 * failure is not the checklist's, so the checklist is not read as a refused
 * body: the answer stays 0.23.2's, the read's failure in the message.
 */
describe('a failure from the read after a 200 checklist', () => {
  it('keeps the 0.23.2 answer', () => {
    const activation = answerFor('activation-nothing-to-activate');
    expect(activation.status).toBe(200);
    const read: IAdtWireResponse = {
      data: '',
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
    };
    const message =
      "The activation's outcome could not be decided: SAP answered that no activation ran and gave no message, and reading the inactive objects failed: Request failed with status code 500";
    const verdict: IAdtError = { origin: 'refusal', message, response: read };
    for (const [, analyse] of ACTIVATION_ANALYSERS) {
      expect(analyse(verdict, activation)).toMatchObject({
        origin: 'refusal',
        message,
        response: read,
        messages: [{ type: 'E', text: message }],
      });
    }
    expect(analyseActivation(verdict, activation)).toStrictEqual({
      origin: 'refusal',
      message,
      response: read,
      messages: [{ type: 'E', text: message }],
      stillInactive: [],
    });
  });
});
