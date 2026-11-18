import { ADT_NO_FAILURE, type IAdtError } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  analyseActivation,
  analyseAny,
  analyseCheck,
  analyseException,
  type IAdtMessageFailure,
} from '../refusals/analyse';
import {
  readActivationRefusal,
  readCheckRunRefusal,
  readExceptionRefusal,
} from '../refusals/read';
import { answerFor } from './corpus';

/**
 * A check or an activation refused with a non-2xx status keeps its messages
 * as the 200 reading gives them — position, uri, object, code and the
 * deprecated line. Until 0.23.3 every analyser read such an answer with the
 * exception reading alone, and a check-run report or an activation checklist
 * came back as one `E` carrying the library's sentence.
 */

/** A recorded answer, served with another status. */
const servedAs = (
  caseName: string,
  status: number,
): { answer: IAdtWireResponse; verdict: IAdtError } => {
  const answer = { ...answerFor(caseName), status };
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

const SYNTAX_FINDING = {
  type: 'E',
  text: 'Type "STRONG_BUT_NOT_A_REAL_TYPE" is unknown.',
  uri: '/sap/bc/adt/oo/classes/zmcp_bld_ansch01/source/main',
  position: { line: 15, column: 24, end: { line: 15, column: 50 } },
  line: '15',
  code: 'MESSAGE(GTH)',
};

describe('a check run refused with a non-2xx status', () => {
  const analysers = [
    ['analyseCheck', analyseCheck],
    ['analyseException', analyseException],
    ['analyseAny', analyseAny],
  ] as const;

  it.each(analysers)('keeps the findings as on a 200: %s', (_name, analyse) => {
    const { answer, verdict } = servedAs('refusal-syntax-check', 400);
    const judged = failure(analyse(verdict, answer));
    expect(judged.messages).toStrictEqual(
      readCheckRunRefusal(answer.data)?.messages,
    );
    expect(judged.messages[0]).toStrictEqual(SYNTAX_FINDING);
    // The library's verdict is enriched, not replaced.
    expect(judged.message).toBe(verdict.message);
    expect(judged.origin).toBe('refusal');
  });

  it.each(analysers)(
    'keeps a report that did not run as on a 200: %s',
    (_name, analyse) => {
      const { answer, verdict } = servedAs(
        'refusal-check-nonexistent-object',
        400,
      );
      expect(failure(analyse(verdict, answer)).messages).toStrictEqual([
        {
          type: 'E',
          text: 'Resource CLASS ZMCP_BLD_NOPE_CLS99 does not exist.',
          code: 'notProcessed',
        },
      ]);
    },
  );
});

describe('an activation checklist refused with a non-2xx status', () => {
  it.each([
    ['analyseActivation', analyseActivation],
    ['analyseException', analyseException],
    ['analyseAny', analyseAny],
  ] as const)('keeps the messages as on a 200: %s', (_name, analyse) => {
    const { answer, verdict } = servedAs('refusal-activation-fails', 400);
    const judged = failure(analyse(verdict, answer));
    expect(judged.messages).toStrictEqual(
      readActivationRefusal(answer.data)?.messages,
    );
    expect(judged.messages[0]).toStrictEqual({
      ...SYNTAX_FINDING,
      object: 'Class ZMCP_BLD_ANSCH01, Method SAY_HELLO',
    });
  });

  it('carries no inactive objects', () => {
    const { answer, verdict } = servedAs('refusal-activation-fails', 400);
    const judged = analyseActivation(verdict, answer);
    if (judged === ADT_NO_FAILURE) throw new Error('expected a failure');
    expect(judged.stillInactive).toStrictEqual([]);
  });
});

describe('an exception document refused with a non-2xx status', () => {
  it.each([
    ['analyseCheck', analyseCheck],
    ['analyseActivation', analyseActivation],
    ['analyseException', analyseException],
    ['analyseAny', analyseAny],
  ] as const)(
    'is read by the exception reading alone: %s',
    (_name, analyse) => {
      const { answer, verdict } = servedAs('refusal-object-not-found', 404);
      const refusal = readExceptionRefusal(answer.data);
      const judged = failure(analyse(verdict, answer));
      expect(judged.messages).toStrictEqual(refusal?.messages);
      expect(judged.adtType).toBe(refusal?.adtType);
      expect(judged.namespace).toBe(refusal?.namespace);
    },
  );
});
