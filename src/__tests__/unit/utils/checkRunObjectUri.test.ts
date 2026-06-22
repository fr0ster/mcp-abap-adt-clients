import { getObjectUri } from '../../../utils/checkRun';

describe('getObjectUri — new DDIC source types', () => {
  it('maps scalar_function and dsfd/scf to the dsfd sources path', () => {
    expect(getObjectUri('scalar_function', 'ZOK_TEST_FUNC')).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func',
    );
    expect(getObjectUri('dsfd/scf', 'ZOK_TEST_FUNC')).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func',
    );
  });

  it('maps append_structure and tabl/ds to the structures path', () => {
    expect(getObjectUri('append_structure', 'ZOK_S_APPEND')).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append',
    );
    expect(getObjectUri('tabl/ds', 'ZOK_S_APPEND')).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append',
    );
  });
});
