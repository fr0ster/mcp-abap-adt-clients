import type { AdtMessage, AdtRefusal, IAdtMessageFailure } from '../index';
import * as api from '../index';
import { rawOf } from '../result';

/**
 * The entry point, as a consumer sees it.
 *
 * The other files import from the modules directly, which is convenient and
 * proves nothing about the barrel: a name left out of `index.ts` compiles
 * everywhere inside the package and is simply missing from the published one.
 * The failure mode is invisible until somebody installs it.
 */
describe('the published surface', () => {
  it('exports every strategy and every reading, callable', () => {
    const expected = [
      'analyseActivation',
      'analyseAny',
      'analyseCheck',
      'analyseDeletion',
      'analyseException',
      'analyseUnitTest',
      'analyseValidation',
      'asItCame',
      'isIndeterminateWalkAnswer',
      'rawOf',
      'readActivationRefusal',
      'readAdtRefusal',
      'readCheckRunRefusal',
      'readDeletionRefusal',
      'readExceptionRefusal',
      'readUnitTestRefusal',
      'readValidationRefusal',
    ];
    expect(Object.keys(api).sort()).toEqual(expected);
    for (const name of expected) {
      expect(typeof (api as Record<string, unknown>)[name]).toBe('function');
    }
  });

  /**
   * The types, held to their shape by the compiler rather than by an
   * assertion — this block fails the build if a field is renamed or dropped,
   * which is the only way a type export can be "tested".
   */
  it('keeps the shapes the readings promise', () => {
    const message: AdtMessage = {
      type: 'E',
      text: 'a sentence',
      code: 'MESSAGE(GTH)',
      t100: { id: 'SADT_RESOURCE', no: '026', values: ['x'] },
      line: '15',
      uri: '/sap/bc/adt/oo/classes/zcl_x',
    };
    const refusal: AdtRefusal = {
      message: 'a sentence',
      adtType: 'InvalidClifName',
      namespace: 'com.sap.adt',
      messages: [message],
      form: 'exception',
    };
    const failure: IAdtMessageFailure = {
      origin: 'refusal',
      message: refusal.message,
      messages: refusal.messages,
    };

    expect(failure.messages[0].t100?.no).toBe('026');
    expect(refusal.form).toBe('exception');
  });
});

describe('rawOf', () => {
  it.each([
    ['a string, unchanged', 'CLASS zcl_x.', 'CLASS zcl_x.'],
    ['undefined, as nothing', undefined, ''],
    ['null, as nothing', null, ''],
  ])('%s', (_label, data, expected) => {
    expect(rawOf({ data } as never)).toBe(expected);
  });

  it('an object, as its JSON — a transport may have parsed the document', () => {
    expect(rawOf({ data: { a: 1 } } as never)).toBe('{"a":1}');
  });

  it('a number, as its text', () => {
    expect(rawOf({ data: 42 } as never)).toBe('42');
  });

  it('an object that cannot be stringified, as whatever it prints as', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(rawOf({ data: cyclic } as never)).toBe('[object Object]');
  });
});
