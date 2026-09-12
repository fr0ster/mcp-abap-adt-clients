import { ADT_NO_FAILURE, type IAdtError } from '@mcp-abap-adt/interfaces';
import {
  analyseActivation,
  analyseAny,
  analyseCheck,
  analyseDeletion,
  analyseException,
  analyseUnitTest,
  analyseValidation,
  type IAdtMessageFailure,
} from '../refusals/analyse';
import { asItCame } from '../result';
import { answerFor, stepsOf } from './corpus';

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
