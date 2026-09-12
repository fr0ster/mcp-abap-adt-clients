import {
  isIndeterminateWalkAnswer,
  readActivationRefusal,
  readAdtRefusal,
  readCheckRunRefusal,
  readDeletionRefusal,
  readExceptionRefusal,
  readUnitTestRefusal,
  readValidationRefusal,
} from '../refusals/read';
import { rawOf } from '../result';
import { answerFor, stepsOf } from './corpus';

/**
 * The readings, directly.
 *
 * They are exported because a caller assembling their own strategy needs them,
 * and an exported name that only runs through something else is an untested
 * surface: its signature can change and nothing goes red. The strategies above
 * exercise these — this file is what holds them to a shape.
 *
 * `null` means "not a refusal", never "unrecognised document". Both readings
 * and callers depend on that.
 */

const documentOf = (caseName: string): string => rawOf(answerFor(caseName));

describe('each reading, against its own pair', () => {
  it.each([
    [
      'activation',
      readActivationRefusal,
      'refusal-activation-fails',
      'activation-success-verdict',
      'activation',
    ],
    [
      'check run',
      readCheckRunRefusal,
      'refusal-syntax-check',
      'check-success-verdict',
      'checkrun',
    ],
    [
      'deletion',
      readDeletionRefusal,
      'refusal-delete-refused',
      'delete-success',
      'deletion',
    ],
    [
      'deletion check',
      readDeletionRefusal,
      'refusal-deletion-check-refuses',
      'deletion-check-allows',
      'deletion',
    ],
    [
      'validation',
      readValidationRefusal,
      'refusal-validation-name-taken-ddl',
      'validation-name-free-ddl',
      'validation',
    ],
    [
      'exception',
      readExceptionRefusal,
      'refusal-validation-name-taken-class',
      'validation-name-free-class',
      'exception',
    ],
  ])('%s', (_label, read, refused, allowed, form) => {
    const found = read(documentOf(refused));
    expect(found).not.toBeNull();
    expect(found?.form).toBe(form);
    expect(found?.message.length).toBeGreaterThan(0);
    expect(found?.messages.length).toBeGreaterThan(0);

    expect(read(documentOf(allowed))).toBeNull();
  });

  it('the unit-test reading, whose refusal is three steps away', () => {
    const failing = stepsOf('refusal-unittest-run-failing');
    const passing = stepsOf('unittest-run-passing');

    const found = readUnitTestRefusal(rawOf(failing[failing.length - 1]));
    expect(found).not.toBeNull();
    expect(found?.messages.length).toBeGreaterThan(0);

    expect(readUnitTestRefusal(rawOf(passing[passing.length - 1]))).toBeNull();
  });
});

describe('every reading answers null rather than guessing', () => {
  const readings = [
    readActivationRefusal,
    readCheckRunRefusal,
    readDeletionRefusal,
    readValidationRefusal,
    readExceptionRefusal,
    readUnitTestRefusal,
    readAdtRefusal,
  ];

  it.each([
    ['an empty document', ''],
    ['whitespace', '   \n  '],
    ['plain text that is not XML', 'CLASS zcl_x DEFINITION.'],
    [
      'XML of an unrelated shape',
      '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"/>',
    ],
  ])('on %s', (_label, document) => {
    for (const read of readings) {
      expect(read(document)).toBeNull();
    }
  });

  it('on a value that is not a string at all', () => {
    for (const read of readings) {
      expect(read(undefined)).toBeNull();
      expect(read(null)).toBeNull();
      expect(read(42)).toBeNull();
    }
  });
});

describe('the dispatcher picks the form', () => {
  it.each([
    ['refusal-activation-fails', 'activation'],
    ['refusal-syntax-check', 'checkrun'],
    ['refusal-delete-refused', 'deletion'],
    ['refusal-validation-name-taken-ddl', 'validation'],
    ['refusal-validation-name-taken-class', 'exception'],
  ])('%s is read as %s', (name, form) => {
    expect(readAdtRefusal(documentOf(name))?.form).toBe(form);
  });
});

describe('isIndeterminateWalkAnswer', () => {
  /**
   * The one measured in this repository twice over: `/repository/nodestructure`
   * answers `200` with an empty body both for a package that is empty and for
   * one that does not exist. The status cannot separate them and there is no
   * document to read, so this says so rather than choosing.
   */
  it('is true for the empty node structure both cases produce', () => {
    expect(isIndeterminateWalkAnswer('')).toBe(true);
    expect(isIndeterminateWalkAnswer('   ')).toBe(true);
    expect(
      isIndeterminateWalkAnswer(
        documentOf('refusal-package-not-found-objectslist-empty'),
      ),
    ).toBe(true);
  });

  it('is false once the server sent a tree', () => {
    expect(
      isIndeterminateWalkAnswer(documentOf('read-object-tree-structure')),
    ).toBe(false);
  });
});

/**
 * The branches the corpus does not reach.
 *
 * Nothing here is invented behaviour: each is a line that exists because a
 * server can send that value, and the recordings simply do not happen to
 * contain one. Testing them with a crafted document is honest as long as the
 * document is the shape the reading is written for — which is why each of
 * these is a real envelope with one attribute changed.
 */
describe('severities the recordings do not contain', () => {
  const runResult = (severity: string): string =>
    `<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/api/aunit"><program adtcore:name="ZX" xmlns:adtcore="http://www.sap.com/adt/core"><testClasses><testClass adtcore:name="LTC"><testMethods><testMethod adtcore:name="TEST" adtcore:uri="/x"><alerts><alert kind="failedAssertion" severity="${severity}"><title>an alert</title></alert></alerts></testMethod></testMethods></testClass></testClasses></program></aunit:runResult>`;

  it('grades TOLERABLE as a warning, so it is not a failure on its own', () => {
    // ABAP Unit's own scale. A run whose only alert is tolerable has no `E`,
    // and the reading answers null — the caller decides what a warning means.
    expect(readUnitTestRefusal(runResult('tolerable'))).toBeNull();
  });

  it('grades FATAL as an error', () => {
    const found = readUnitTestRefusal(runResult('fatal'));
    expect(found?.messages[0].type).toBe('E');
  });

  it('passes an unrecognised spelling through rather than guessing', () => {
    // `return s` — a severity this package has never seen keeps its own name,
    // so a caller matching on it sees what the server said instead of a
    // silent reclassification.
    const found = readUnitTestRefusal(runResult('critical'));
    expect(found?.messages[0].type).toBe('E');

    const odd = readUnitTestRefusal(runResult('blocker'));
    // No `E` among the messages, so not a refusal — but the spelling survived.
    expect(odd).toBeNull();
  });
});

describe('a document the parser cannot read', () => {
  it('is not a refusal, and does not throw', () => {
    const malformed = '<?xml version="1.0"?><chkl:messages><msg type="E"';
    expect(() => readActivationRefusal(malformed)).not.toThrow();
    expect(readActivationRefusal(malformed)).toBeNull();
    expect(readAdtRefusal(malformed)).toBeNull();
  });
});
