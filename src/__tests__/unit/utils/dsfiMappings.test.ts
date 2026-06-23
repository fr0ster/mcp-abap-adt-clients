import { buildObjectUri } from '../../../utils/activationUtils';
import { getObjectUri } from '../../../utils/checkRun';

describe('DSFI/DSFD object-uri mappings', () => {
  it('checkRun.getObjectUri maps dsfi aliases', () => {
    expect(getObjectUri('scalar_function_implementation', 'ZOK_IMPL')).toBe(
      '/sap/bc/adt/ddic/dsfi/zok_impl',
    );
    expect(getObjectUri('dsfi/sfi', 'ZOK_IMPL')).toBe(
      '/sap/bc/adt/ddic/dsfi/zok_impl',
    );
  });

  it('buildObjectUri (group activation) maps DSFI/SFI and DSFD/SCF', () => {
    expect(buildObjectUri('ZOK_IMPL', 'DSFI/SFI')).toBe(
      '/sap/bc/adt/ddic/dsfi/zok_impl',
    );
    expect(buildObjectUri('ZOK_FUNC', 'DSFD/SCF')).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_func',
    );
  });
});
