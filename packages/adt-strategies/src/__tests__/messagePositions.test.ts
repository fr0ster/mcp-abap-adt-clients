import type { AdtMessage } from '../refusals/read';
import { readActivationRefusal, readCheckRunRefusal } from '../refusals/read';
import { stepsOf } from './corpus';

/**
 * Where a message stands (fr0ster/mcp-abap-adt#351, its comment of
 * 2026-11-18, measured on SAP_BASIS 751).
 *
 * A checklist `msg`'s `line` attribute is the message's ordinal — 1, 2, 3 —
 * not a source line; the position is only in `href`'s fragment,
 * `#start=<line>,<col>[;end=<line>,<col>]`. A check run's `checkMessage`
 * carries the same reference in its `uri`.
 */

const CHECKLIST_NS = 'http://www.sap.com/abapxml/checklist';

/** The user's verbatim answer from the issue: the regression fixture. */
const ISSUE_351 = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><msg objDescr="Class ZCL_AI_ACT_PROBE, Method GET_VALUE" type="E" line="1" href="/sap/bc/adt/oo/classes/zcl_ai_act_probe/source/main#start=16,15" forceSupported="true"><shortText><txt>Field "LV_UNDEFINED" is unknown.</txt></shortText><atom:link href="art.syntax:GTU" rel="http://www.sap.com/adt/categories/quickfixes" xmlns:atom="http://www.w3.org/2005/Atom"/></msg></chkl:messages>`;

/** One `E` message with the given `href` attribute (absent when undefined). */
const withHref = (href: string | undefined): string =>
  `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><msg objDescr="Program ZP" type="E" line="3"${
    href === undefined ? '' : ` href="${href}"`
  }><shortText><txt>a syntax error</txt></shortText></msg></chkl:messages>`;

const firstActivationMessage = (document: string): AdtMessage | undefined =>
  readActivationRefusal(document)?.messages[0];

describe('an activation message states where it stands', () => {
  it('reads the issue answer: object, uri and position from href, no ordinal line', () => {
    const message = firstActivationMessage(ISSUE_351);
    expect(message).toStrictEqual({
      type: 'E',
      text: 'Field "LV_UNDEFINED" is unknown.',
      object: 'Class ZCL_AI_ACT_PROBE, Method GET_VALUE',
      uri: '/sap/bc/adt/oo/classes/zcl_ai_act_probe/source/main',
      position: { line: 16, column: 15 },
    });
    expect(message && 'line' in message).toBe(false);
  });

  it('reads a start and an end, and the code, from the recorded refusal', () => {
    const [step] = stepsOf('refusal-activation-fails');
    const message = firstActivationMessage(String(step?.data));
    expect(message).toStrictEqual({
      type: 'E',
      text: 'Type "STRONG_BUT_NOT_A_REAL_TYPE" is unknown.',
      object: 'Class ZMCP_BLD_ANSCH01, Method SAY_HELLO',
      uri: '/sap/bc/adt/oo/classes/zmcp_bld_ansch01/source/main',
      position: { line: 15, column: 24, end: { line: 15, column: 50 } },
      code: 'MESSAGE(GTH)',
    });
  });

  it.each([
    ['no fragment', '/sap/bc/adt/programs/programs/zp/source/main'],
    ['an empty fragment', '/sap/bc/adt/programs/programs/zp/source/main#'],
    [
      'a fragment naming a target, not a position',
      '/sap/bc/adt/programs/programs/zp/source/main#type=PROG;name=ZP',
    ],
    [
      'a start that is not two numbers',
      '/sap/bc/adt/programs/programs/zp/source/main#start=16',
    ],
    [
      'a start with a sign',
      '/sap/bc/adt/programs/programs/zp/source/main#start=-1,2',
    ],
    [
      'an end that does not read',
      '/sap/bc/adt/programs/programs/zp/source/main#start=1,2;end=x,4',
    ],
  ])('gives the uri only for an href with %s', (_label, href) => {
    expect(firstActivationMessage(withHref(href))).toStrictEqual({
      type: 'E',
      text: 'a syntax error',
      object: 'Program ZP',
      uri: '/sap/bc/adt/programs/programs/zp/source/main',
    });
  });

  it.each([
    ['an empty href', ''],
    ['no href', undefined],
  ])('gives neither uri nor position for %s', (_label, href) => {
    expect(firstActivationMessage(withHref(href))).toStrictEqual({
      type: 'E',
      text: 'a syntax error',
      object: 'Program ZP',
    });
  });

  it('gives no object for an empty objDescr', () => {
    const document = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="false"/><msg objDescr="" type="W" line="0" href=""><shortText><txt>Activation was cancelled.</txt></shortText></msg><msg objDescr="Program ZP" type="E" line="1" href="/p#start=13,10"><shortText><txt>an error</txt></shortText></msg></chkl:messages>`;
    expect(readActivationRefusal(document)?.messages).toStrictEqual([
      { type: 'W', text: 'Activation was cancelled.' },
      {
        type: 'E',
        text: 'an error',
        object: 'Program ZP',
        uri: '/p',
        position: { line: 13, column: 10 },
      },
    ]);
  });
});

describe('a check-run message states where it stands', () => {
  it('reads uri and position from the recorded check run', () => {
    const [step] = stepsOf('refusal-syntax-check');
    const message = readCheckRunRefusal(step?.data)?.messages[0];
    expect(message).toStrictEqual({
      type: 'E',
      text: 'Type "STRONG_BUT_NOT_A_REAL_TYPE" is unknown.',
      uri: '/sap/bc/adt/oo/classes/zmcp_bld_ansch01/source/main',
      position: { line: 15, column: 24, end: { line: 15, column: 50 } },
      code: 'MESSAGE(GTH)',
    });
  });
});
