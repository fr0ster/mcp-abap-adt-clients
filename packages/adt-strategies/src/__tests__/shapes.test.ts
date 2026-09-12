import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { adtRefusal, firstOf } from '../refusals/compose';
import {
  activationRefusal,
  checkRunRefusal,
  deletionCheckRefusal,
  deletionRefusal,
  exceptionRefusal,
  validationRefusal,
} from '../refusals/shapes';
import { answerFor } from './corpus';

/**
 * Every assertion is a pair: the recorded refusal, and the recorded success it
 * has to be told apart from. A shape that fires on both recognises nothing —
 * and on this endpoint family that is easy to write by accident, because the
 * status is identical in most of these pairs.
 *
 * The list below had a table under `validationRefusal` when it was written, and
 * the corpus rejected it on the first run: a table answers `400` with an
 * exception document, not `SEVERITY`. Only DDL sources and function groups use
 * that shape. Which is the argument for this whole package in one line — the
 * evidence corrected the author, and it would have corrected him the same way
 * whether or not he had a live system to hand.
 */
describe('each shape separates a refusal from its success', () => {
  it.each([
    [
      'activation',
      activationRefusal,
      'refusal-activation-fails',
      'activation-success-verdict',
    ],
    [
      'check run',
      checkRunRefusal,
      'refusal-syntax-check',
      'check-success-verdict',
    ],
    [
      'check run, object absent',
      checkRunRefusal,
      'refusal-check-nonexistent-object',
      'check-success-verdict',
    ],
    ['deletion', deletionRefusal, 'refusal-delete-refused', 'delete-success'],
    [
      'deletion check',
      deletionCheckRefusal,
      'refusal-deletion-check-refuses',
      'deletion-check-allows',
    ],
    [
      'validation, DDL',
      validationRefusal,
      'refusal-validation-name-taken-ddl',
      'validation-name-free-ddl',
    ],
    [
      'validation, function group',
      validationRefusal,
      'refusal-validation-name-taken-functiongroup',
      'validation-name-free-ddl',
    ],
  ])('%s', (_label, shape, refused, allowed) => {
    expect(shape(answerFor(refused))).toBeDefined();
    expect(shape(answerFor(allowed))).toBeUndefined();
  });

  it('the table validation refuses with an exception, not a SEVERITY', () => {
    // The split this package exists to cope with: the same question, two
    // shapes, and a status that disagrees with itself across object types.
    const taken = answerFor('refusal-validation-name-taken-table');
    expect(taken.status).toBe(400);
    expect(validationRefusal(taken)).toBeUndefined();
    expect(exceptionRefusal(taken)).toBeDefined();

    const ddl = answerFor('refusal-validation-name-taken-ddl');
    expect(ddl.status).toBe(200);
    expect(validationRefusal(ddl)).toBeDefined();
  });
});

describe('the composed default', () => {
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
  ])('calls %s a refusal', (name) => {
    const verdict = adtRefusal(ADT_NO_FAILURE, answerFor(name));
    expect(verdict).not.toBe(ADT_NO_FAILURE);
    expect((verdict as { origin: string }).origin).toBe('refusal');
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
    expect(adtRefusal(ADT_NO_FAILURE, answerFor(name))).toBe(ADT_NO_FAILURE);
  });

  it('keeps the library verdict when it recognises nothing', () => {
    const verdict = { origin: 'connection' as const, message: 'no answer' };
    expect(adtRefusal(verdict, undefined)).toBe(verdict);
  });
});

describe('firstOf', () => {
  it('stops at the first shape that recognises the answer', () => {
    const seen: string[] = [];
    const never = (tag: string) => () => {
      seen.push(tag);
      return undefined;
    };
    const always = (tag: string) => () => {
      seen.push(tag);
      return { origin: 'refusal' as const, message: tag };
    };

    const verdict = firstOf(
      never('a'),
      always('b'),
      never('c'),
    )(ADT_NO_FAILURE, answerFor('check-success-verdict'));

    expect(verdict).toEqual({ origin: 'refusal', message: 'b' });
    expect(seen).toEqual(['a', 'b']);
  });
});
