/**
 * The type-to-address tables answer from the registry, and the four defects the
 * duplication produced are gone (spec, "What the duplication has already
 * produced", 1–3 and 5).
 */
import {
  getObjectMetadataUri,
  getObjectSourceUri,
} from '../../../core/shared/objectWire';
import { buildAtcObjectUri } from '../../../runtime/atc/run';
import { buildObjectUri } from '../../../utils/activationUtils';
import { getObjectUri } from '../../../utils/checkRun';

describe('defect 1: ENHO/ENH is not a transformation', () => {
  it('XSLT/VT is', () => {
    expect(buildObjectUri('ZX', 'XSLT/VT')).toBe(
      '/sap/bc/adt/xslt/transformations/zx',
    );
  });
  it('ENHO/ENH no longer reaches the XSLT collection', () => {
    let built: string | undefined;
    try {
      // @ts-expect-error -- ENHO/ENH is no code of the tables
      built = buildObjectUri('ZENH', 'ENHO/ENH');
    } catch {
      built = undefined;
    }
    expect(built ?? '').not.toContain('/xslt/');
  });
});

describe("defect 2: an interface by ADT's own code", () => {
  it('INTF/OI reads', () => {
    expect(getObjectMetadataUri('INTF/OI', 'ZIF_X')).toBe(
      '/sap/bc/adt/oo/interfaces/zif_x',
    );
    expect(getObjectSourceUri('INTF/OI', 'ZIF_X')).toBe(
      '/sap/bc/adt/oo/interfaces/zif_x/source/main',
    );
  });
});

describe('defect 3: a data element by DTEL/DE', () => {
  it('DTEL/DE reads', () => {
    expect(getObjectMetadataUri('DTEL/DE', 'ZDE')).toBe(
      '/sap/bc/adt/ddic/dataelements/zde',
    );
  });
});

describe('defect 5: a function module needs its group', () => {
  it('with the group', () => {
    expect(buildObjectUri('Z_FM', 'FUGR/FF', 'ZFG')).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    );
  });
  it('without it, does not compile — and throws before any request', () => {
    // @ts-expect-error -- FUGR/FF is addressed under its group
    expect(() => buildObjectUri('Z_FM', 'FUGR/FF')).toThrow(/functionGroup/);
  });
});

describe('the include kinds are told apart', () => {
  it('program include, function include', () => {
    expect(buildObjectUri('ZREP_TOP', 'PROG/I')).toBe(
      '/sap/bc/adt/programs/includes/zrep_top',
    );
    expect(buildObjectUri('LZFGTOP', 'FUGR/I', 'ZFG')).toBe(
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgtop',
    );
  });
});

describe('every table agrees on a class', () => {
  it('one address', () => {
    const expected = '/sap/bc/adt/oo/classes/zcl_x';
    expect(buildObjectUri('ZCL_X', 'CLAS/OC')).toBe(expected);
    expect(getObjectUri('CLAS/OC', 'ZCL_X')).toBe(expected);
    expect(getObjectMetadataUri('CLAS/OC', 'ZCL_X')).toBe(expected);
    expect(
      buildAtcObjectUri({ objectType: 'class', objectName: 'ZCL_X' }),
    ).toBe(expected);
  });
});

describe('an enhancement name is encoded once', () => {
  it('a namespace is not double-encoded', () => {
    expect(buildObjectUri('/NSP/ZENH', 'ENHO/XHB')).toBe(
      '/sap/bc/adt/enhancements/enhoxhb/%2Fnsp%2Fzenh',
    );
  });
});

describe('no invented address', () => {
  it('an unknown type does not compile, and throws', () => {
    // @ts-expect-error -- ABCD/XY is no code of the tables
    expect(() => buildObjectUri('ZX', 'ABCD/XY')).toThrow(/ABCD\/XY/);
  });
  it('ENHO/ENH, which names no subtype, does not compile, and throws', () => {
    // @ts-expect-error -- ENHO/ENH is no code of the tables
    expect(() => buildObjectUri('ZENH', 'ENHO/ENH')).toThrow();
  });
  it('a missing type does not compile, and throws rather than guessing from the name', () => {
    // @ts-expect-error -- the type is required
    expect(() => buildObjectUri('ZCL_X')).toThrow(/type/i);
  });
  it('a message of a message class has no address of its own: it does not compile, and throws', () => {
    // @ts-expect-error -- MSAG/NN has no address of its own
    expect(() => buildObjectUri('001', 'MSAG/NN')).toThrow(/row in its class/);
  });
});
