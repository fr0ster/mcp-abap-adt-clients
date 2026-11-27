import {
  isMetadataReadCode,
  isSourceReadCode,
} from '../../../core/shared/codeSets';
import { supportsSourceCode } from '../../../core/shared/objectWire';
import { isGroupOnlyCode } from '../../../endpoints/codes';
import { buildObjectUri } from '../../../utils/activationUtils';

/**
 * C6 of #304: the three code predicates over typed strings answer booleans,
 * and the group-only address is found by a typed lookup. Their callers get the
 * same results on the same inputs: own codes only, inherited names never.
 */
describe('the code lookups answer as the predicates did', () => {
  const junk = [
    '',
    'toString',
    '__proto__',
    'constructor',
    'hasOwnProperty',
    'view/dv',
  ];
  it.each(junk)('reads %j as no code', (text) => {
    expect(isGroupOnlyCode(text)).toBe(false);
    expect(isMetadataReadCode(text)).toBe(false);
    expect(isSourceReadCode(text)).toBe(false);
    expect(supportsSourceCode(text)).toBe(false);
  });
  it('reads the listed codes as theirs', () => {
    expect(isGroupOnlyCode('VIEW/DV')).toBe(true);
    expect(isSourceReadCode('CLAS/OC')).toBe(true);
    expect(supportsSourceCode('TABL/DS')).toBe(true);
    expect(isMetadataReadCode('DEVC/K')).toBe(true);
  });
  it('addresses a group-only code by its own builder', () => {
    expect(buildObjectUri('ZV', 'VIEW/DV', undefined as never)).toBe(
      '/sap/bc/adt/ddic/views/zv',
    );
  });
  // Before and after alike: the no-own-address table answers an inherited
  // name with its value (a function's text), so the refusal reads as that.
  it('refuses an inherited name before any address, as before', () => {
    expect(() =>
      buildObjectUri('ZV', 'toString' as never, undefined as never),
    ).toThrow('toString ZV: function toString()');
  });
});
