/**
 * Each builder against the exact address it must produce. The expectations are
 * written out, not computed from the registry — a test that took them from the
 * registry would compare it with itself.
 */
import {
  CLASS,
  CLASS_INCLUDE,
  ENHANCEMENT,
  FEATURE_TOGGLE,
  FUNCTION_GROUP,
  FUNCTION_INCLUDE,
  FUNCTION_MODULE,
  PACKAGE,
  PROGRAM,
  PROGRAM_INCLUDE,
  RECORDS,
  SERVICE_BINDING,
  seg,
  sourceUri,
  TRANSPORT_REQUEST,
  TRANSPORT_REQUEST_LEGACY,
  transportUri,
  versionsUri,
} from '../../../endpoints/objects';

describe('seg', () => {
  it('lowercases and percent-encodes', () => {
    expect(seg('ZCL_X')).toBe('zcl_x');
  });
  it('encodes a namespace, never a raw slash', () => {
    // encodeURIComponent's own uppercase hex; RFC 3986 makes %2F and %2f
    // equivalent, and Task 3 reads a namespaced object to confirm ADT agrees.
    expect(seg('/ABC/ZCL_X')).toBe('%2Fabc%2Fzcl_x');
  });
  it('encodes $ in local packages', () => {
    expect(seg('$TMP')).toBe('%24tmp');
  });
});

describe('records', () => {
  it('program', () => {
    expect(PROGRAM.collection).toBe('/sap/bc/adt/programs/programs');
    expect(PROGRAM.validation).toBe('/sap/bc/adt/programs/validation');
    expect(PROGRAM.uri('ZREP')).toBe('/sap/bc/adt/programs/programs/zrep');
  });
  it('program include', () => {
    expect(PROGRAM_INCLUDE.collection).toBe('/sap/bc/adt/programs/includes');
    expect(PROGRAM_INCLUDE.validation).toBe('/sap/bc/adt/includes/validation');
    expect(PROGRAM_INCLUDE.uri('ZREP_TOP')).toBe(
      '/sap/bc/adt/programs/includes/zrep_top',
    );
  });
  it('function include needs its group', () => {
    expect(FUNCTION_INCLUDE.uri('ZFG', 'LZFGTOP')).toBe(
      '/sap/bc/adt/functions/groups/zfg/includes/lzfgtop',
    );
  });
  it('function module needs its group', () => {
    expect(FUNCTION_MODULE.collection('ZFG')).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules',
    );
    expect(FUNCTION_MODULE.uri('ZFG', 'Z_FM')).toBe(
      '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    );
    expect(FUNCTION_MODULE.validation).toBe('/sap/bc/adt/functions/validation');
    expect(FUNCTION_GROUP.validation).toBe('/sap/bc/adt/functions/validation');
  });
  it('class include needs its class and kind', () => {
    expect(CLASS_INCLUDE.uri('ZCL_X', 'testclasses')).toBe(
      '/sap/bc/adt/oo/classes/zcl_x/includes/testclasses',
    );
    expect(CLASS.validation).toBe('/sap/bc/adt/oo/validation/objectname');
  });
  it('package', () => {
    expect(PACKAGE.uri('$TMP')).toBe('/sap/bc/adt/packages/%24tmp');
  });
  it('enhancement takes its subtype as a segment', () => {
    expect(ENHANCEMENT.uri('enhoxh', 'ZENH')).toBe(
      '/sap/bc/adt/enhancements/enhoxh/zenh',
    );
  });
  it('service binding and its jobs', () => {
    expect(SERVICE_BINDING.root).toBe('/sap/bc/adt/businessservices');
    expect(SERVICE_BINDING.release).toBe(
      '/sap/bc/adt/businessservices/release',
    );
    expect(SERVICE_BINDING.uri('ZUI_B')).toBe(
      '/sap/bc/adt/businessservices/bindings/zui_b',
    );
    expect(SERVICE_BINDING.publishJobs('odatav2')).toBe(
      '/sap/bc/adt/businessservices/odatav2/publishjobs',
    );
    expect(SERVICE_BINDING.unpublishJobs('odatav4')).toBe(
      '/sap/bc/adt/businessservices/odatav4/unpublishjobs',
    );
    // As given: one caller uppercases a binding name, the other passes an
    // object name through, and neither case was measured, so the builder
    // changes neither.
    expect(SERVICE_BINDING.odataService('odatav2', 'zui_svc')).toBe(
      '/sap/bc/adt/businessservices/odatav2/zui_svc',
    );
    expect(SERVICE_BINDING.odataService('odatav4', 'ZUI_SVC')).toBe(
      '/sap/bc/adt/businessservices/odatav4/ZUI_SVC',
    );
  });
  it('feature toggle tails', () => {
    expect(FEATURE_TOGGLE.check('ZFT')).toBe(
      '/sap/bc/adt/sfw/featuretoggles/zft/check',
    );
    expect(FEATURE_TOGGLE.states('ZFT')).toBe(
      '/sap/bc/adt/sfw/featuretoggles/zft/states',
    );
    expect(FEATURE_TOGGLE.toggle('ZFT')).toBe(
      '/sap/bc/adt/sfw/featuretoggles/zft/toggle',
    );
  });
  it('a transport request number keeps its case', () => {
    // The request number as given answers 200, lowercased 404, on an
    // on-premise and a cloud system alike (2026-10-01).
    expect(TRANSPORT_REQUEST.uri('E19K900001')).toBe(
      '/sap/bc/adt/cts/transportrequests/E19K900001',
    );
  });
  it('transport request has a legacy address of its own', () => {
    expect(TRANSPORT_REQUEST.collection).toBe(
      '/sap/bc/adt/cts/transportrequests',
    );
    expect(TRANSPORT_REQUEST_LEGACY.collection).toBe(
      '/sap/bc/cts/transportrequests',
    );
  });
  it('tails are functions of an address', () => {
    const p = PROGRAM.uri('ZREP');
    expect(sourceUri(p)).toBe('/sap/bc/adt/programs/programs/zrep/source/main');
    expect(versionsUri(sourceUri(p))).toBe(
      '/sap/bc/adt/programs/programs/zrep/source/main/versions',
    );
    expect(transportUri(p)).toBe(
      '/sap/bc/adt/programs/programs/zrep/transport',
    );
  });
  it('every record is listed in RECORDS', () => {
    expect(Object.keys(RECORDS).sort()).toEqual(
      [
        'ACCESS_CONTROL',
        'AUTHORIZATION_FIELD',
        'BEHAVIOR_DEFINITION',
        'CLASS',
        'CLASS_INCLUDE',
        'DATA_ELEMENT',
        'DDIC_VIEW',
        'DDL_SOURCE',
        'DOMAIN',
        'ENHANCEMENT',
        'FEATURE_TOGGLE',
        'FUNCTION_GROUP',
        'FUNCTION_INCLUDE',
        'FUNCTION_MODULE',
        'INTERFACE',
        'MESSAGE_CLASS',
        'METADATA_EXTENSION',
        'PACKAGE',
        'PROGRAM',
        'PROGRAM_INCLUDE',
        'SCALAR_FUNCTION',
        'SCALAR_FUNCTION_IMPLEMENTATION',
        'SERVICE_BINDING',
        'SERVICE_DEFINITION',
        'STRUCTURE',
        'TABLE',
        'TABLE_TYPE',
        'TRANSFORMATION',
        'TRANSPORT_REQUEST',
        'TRANSPORT_REQUEST_LEGACY',
      ].sort(),
    );
  });
});
