/**
 * ATC checks programs and every kind of include (interfaces-adt 12.0.0), each
 * at its own address — measured on an on-premise and a cloud system: a
 * function include is found under its group and not under /programs/includes/,
 * and ATC checks an include as the object that owns it.
 */
import { buildAtcObjectUri } from '../../../runtime/atc/run';

describe('buildAtcObjectUri — every kind', () => {
  it.each([
    [
      { objectType: 'class', objectName: 'ZCL_X' },
      '/sap/bc/adt/oo/classes/zcl_x',
    ],
    [
      { objectType: 'program', objectName: 'ZREP' },
      '/sap/bc/adt/programs/programs/zrep',
    ],
    [
      { objectType: 'program_include', objectName: 'ZREP_TOP' },
      '/sap/bc/adt/programs/includes/zrep_top',
    ],
    [
      {
        objectType: 'function_include',
        objectName: 'LZFGTOP',
        functionGroup: 'ZFG',
      },
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgtop',
    ],
    [
      {
        objectType: 'class_include',
        objectName: 'ZCL_X',
        includeKind: 'testclasses',
      },
      '/sap/bc/adt/oo/classes/zcl_x/includes/testclasses',
    ],
  ] as const)('%o → %s', (ref, uri) => {
    expect(buildAtcObjectUri(ref)).toBe(uri);
  });

  it('a namespaced function include is encoded once, under its group', () => {
    expect(
      buildAtcObjectUri({
        objectType: 'function_include',
        objectName: '/NSP/LZFGTOP',
        functionGroup: '/NSP/ZFG',
      }),
    ).toBe(
      '/sap/bc/adt/functions/groups/%2Fnsp%2Fzfg/includes/%2Fnsp%2Flzfgtop',
    );
  });
});
