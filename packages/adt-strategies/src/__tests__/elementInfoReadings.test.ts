import {
  readServiceDefinitionElementInfo,
  readStructureElementInfo,
  serviceDefinitionElementInfo,
  structureElementInfo,
} from '../results/elementInfo';
import { answerFor } from './corpus';

/**
 * The element-info readings, against answers recorded on premise and on ABAP
 * cloud (2026-11-05). `read-elementinfo-structure`,
 * `read-elementinfo-structure-named-include`, `read-elementinfo-srvd` and the
 * two unknown-name answers came byte for byte the same from both systems.
 */
describe('structureElementInfo', () => {
  it('reads the structure, its components in order and its package', () => {
    const info = structureElementInfo(answerFor('read-elementinfo-structure'));
    expect(info.name).toBe('/dmo/s_booking_supplement_key');
    expect(info.type).toBe('TABL/DS');
    expect(info.uri).toBe(
      '/sap/bc/adt/ddic/structures/%2fdmo%2fs_booking_supplement_key',
    );
    expect(info.description).toBe('Key structure of Booking Supplements');
    expect(info.components.map((c) => c.name)).toEqual([
      '.include',
      '.include',
      'travel_id',
      'booking_id',
      'booking_supplement_id',
    ]);
    expect(info.package).toEqual({
      name: '/DMO/FLIGHT_LEGACY',
      uri: '/sap/bc/adt/packages/%2fdmo%2fflight_legacy',
    });
  });

  it('reads each include: the structure it names, its URI, where it sits', () => {
    const info = structureElementInfo(answerFor('read-elementinfo-structure'));
    expect(info.includes).toEqual([
      expect.objectContaining({
        name: '.include',
        type: 'TABL/DS',
        includeName: '/dmo/s_booking_key',
        uri: '/sap/bc/adt/ddic/structures/%2fdmo%2fs_booking_key/source/main',
        partOfInclude: undefined,
        includeLevel: undefined,
      }),
      expect.objectContaining({
        name: '.include',
        includeName: '/dmo/s_travel_key',
        uri: '/sap/bc/adt/ddic/structures/%2fdmo%2fs_travel_key/source/main',
        partOfInclude: '/dmo/s_booking_key',
        includeLevel: 1,
      }),
    ]);
  });

  it('reads each field: its type facts and the include it is part of', () => {
    const info = structureElementInfo(answerFor('read-elementinfo-structure'));
    const travel = info.components.find((c) => c.name === 'travel_id');
    expect(travel).toEqual(
      expect.objectContaining({
        unknownType: 'TABL/DTF',
        uri: undefined,
        includeName: undefined,
        dataElement: '/dmo/travel_id',
        dataType: 'numc',
        length: 8,
        decimals: undefined,
        isKey: false,
        partOfInclude: '/dmo/s_travel_key',
        includeLevel: 2,
      }),
    );
    expect(travel?.properties.ddicLength).toBe('000008');
    const own = info.components.find((c) => c.name === 'booking_supplement_id');
    expect(own?.partOfInclude).toBeUndefined();
    expect(own?.includeLevel).toBeUndefined();
  });

  it('reads a named include as an .include: its group name is not stated', () => {
    const info = structureElementInfo(
      answerFor('read-elementinfo-structure-named-include'),
    );
    expect(info.includes.map((c) => [c.name, c.includeName])).toEqual([
      ['.include', '/dmo/s_travel_key'],
      ['.include', '/dmo/s_travel_intx'],
    ]);
  });

  it('reads an append (extend type) as an .append naming the append', () => {
    const info = structureElementInfo(
      answerFor('read-elementinfo-structure-append'),
    );
    expect(info.includes).toEqual([
      expect.objectContaining({
        name: '.append',
        includeName: '/dmo/zz_s_ext_agency_slogan',
        uri: '/sap/bc/adt/ddic/structures/%2fdmo%2fzz_s_ext_agency_slogan/source/main',
      }),
    ]);
    const dummy = info.components.find((c) => c.name === 'dummy_field');
    expect(dummy?.dataElement).toBeUndefined();
    expect(dummy?.dataType).toBe('char');
    const slogan = info.components.find((c) => c.name === '/dmo/zzsloganzag');
    expect(slogan?.partOfInclude).toBe('/dmo/zz_s_ext_agency_slogan');
    expect(slogan?.includeLevel).toBe(1);
  });

  it('reads the answer to an unknown name as naming nothing', () => {
    const info = structureElementInfo(
      answerFor('read-elementinfo-structure-unknown'),
    );
    expect(info.name).toBeUndefined();
    expect(info.type).toBeUndefined();
    expect(info.components).toEqual([]);
    expect(info.includes).toEqual([]);
    expect(info.package).toBeUndefined();
  });

  it('reads an empty document as naming nothing', () => {
    expect(readStructureElementInfo('').name).toBeUndefined();
    expect(readStructureElementInfo('').components).toEqual([]);
  });
});

describe('serviceDefinitionElementInfo', () => {
  it('reads the definition, its exposed entities and the extension link', () => {
    const info = serviceDefinitionElementInfo(
      answerFor('read-elementinfo-srvd'),
    );
    expect(info.name).toBe('/DMO/UI_AGENCY');
    expect(info.type).toBe('SRVD/SRV');
    expect(info.uri).toBe('/sap/bc/adt/ddic/srvd/sources/%2fdmo%2fui_agency');
    expect(info.description).toBe('Agency');
    expect(info.entities).toEqual([
      {
        unknownType: 'DDLS/STOB',
        name: '/DMO/C_AgencyTP',
        uri: '/sap/bc/adt/ddic/ddl/sources/%2fdmo%2fc_agencytp',
        alias: 'Agency',
        description: 'Agency',
      },
      {
        unknownType: 'DDLS/STOB',
        name: '/DMO/ZZ_C_Agency_ReviewTP',
        uri: '/sap/bc/adt/ddic/ddl/sources/%2fdmo%2fzz_c_agency_reviewtp',
        alias: '/DMO/ZZ_Review',
        description: 'Agency Review',
      },
    ]);
    expect(info.links).toEqual([
      {
        rel: 'http://www.sap.com/adt/relations/ddic/srvd/extention',
        href: '/sap/bc/adt/ddic/srvd/sources/%2fdmo%2fzz_x_review_ui_agency',
        title: '/DMO/ZZ_X_REVIEW_UI_AGENCY',
      },
    ]);
    expect(info.package).toEqual({
      name: '/DMO/FLIGHT_REUSE_AGENCY',
      uri: '/sap/bc/adt/packages/%2fdmo%2fflight_reuse_agency',
    });
  });

  it('reads an expose without `as` as an entity with no alias', () => {
    const info = serviceDefinitionElementInfo(
      answerFor('read-elementinfo-srvd-no-alias'),
    );
    expect(info.entities).toEqual([
      expect.objectContaining({ name: '/DMO/R_AgencyTP', alias: undefined }),
    ]);
    expect(info.links).toEqual([]);
  });

  it('reads the answer to an unknown name as naming nothing', () => {
    const info = serviceDefinitionElementInfo(
      answerFor('read-elementinfo-srvd-unknown'),
    );
    expect(info.name).toBeUndefined();
    expect(info.uri).toBe('/sap/bc/adt/ddic/srvd/sources/zzz_no_such_srvd_x');
    expect(info.entities).toEqual([]);
    expect(info.package).toBeUndefined();
  });

  it('reads an empty document as naming nothing', () => {
    expect(readServiceDefinitionElementInfo('').name).toBeUndefined();
    expect(readServiceDefinitionElementInfo('').entities).toEqual([]);
  });
});
