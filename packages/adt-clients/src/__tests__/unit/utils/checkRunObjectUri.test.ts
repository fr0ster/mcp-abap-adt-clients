import { getObjectUri } from '../../../utils/checkRun';

// The addresses the friendly names and lower-case codes built before
// interfaces-adt 21.0.0, unchanged under the codes of the tables.
describe('getObjectUri — DDIC source types', () => {
  it('DSFD/SCF is the dsfd sources path', () => {
    expect(getObjectUri('DSFD/SCF', 'ZOK_TEST_FUNC')).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func',
    );
  });

  it('TABL/DS (an append structure) is the structures path', () => {
    expect(getObjectUri('TABL/DS', 'ZOK_S_APPEND')).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append',
    );
  });

  it('FUGR/FF names its group as the parent', () => {
    expect(getObjectUri('FUGR/FF', 'Z_FM', 'ZFG')).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    );
  });
});
