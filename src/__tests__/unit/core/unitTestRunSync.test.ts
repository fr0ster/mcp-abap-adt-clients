/**
 * Unit tests for the synchronous ABAP Unit runner helpers:
 * - buildUnitTestObjectUri (object URI mapping)
 * - parseUnitTestRunResult (aunit:runResult → pass/fail summary)
 *
 * Pure functions — no SAP connection required.
 */

import {
  buildUnitTestObjectUri,
  parseUnitTestRunResult,
} from '../../../core/unitTest/run';

describe('buildUnitTestObjectUri', () => {
  it('maps a class to the oo/classes URI and upper-cases the name', () => {
    expect(buildUnitTestObjectUri('class', 'zcl_ksef_data_extractor')).toBe(
      '/sap/bc/adt/oo/classes/ZCL_KSEF_DATA_EXTRACTOR',
    );
  });

  it('maps program and include to the programs URI', () => {
    expect(buildUnitTestObjectUri('program', 'ztest')).toBe(
      '/sap/bc/adt/programs/programs/ZTEST',
    );
    expect(buildUnitTestObjectUri('include', 'zinc')).toBe(
      '/sap/bc/adt/programs/programs/ZINC',
    );
  });

  it('maps function_group and package', () => {
    expect(buildUnitTestObjectUri('function_group', 'zfg')).toBe(
      '/sap/bc/adt/functions/groups/ZFG',
    );
    expect(buildUnitTestObjectUri('package', 'zksef_r_reuse')).toBe(
      '/sap/bc/adt/packages/ZKSEF_R_REUSE',
    );
  });
});

describe('parseUnitTestRunResult', () => {
  it('counts all-green methods across multiple test classes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core">
  <program adtcore:name="ZCL_KSEF_DATA_EXTRACTOR" adtcore:type="CLAS/OC">
    <alerts/>
    <testClasses>
      <testClass adtcore:name="LTC_RESOLVE">
        <testMethods>
          <testMethod adtcore:name="test_a"><alerts/></testMethod>
          <testMethod adtcore:name="test_b"/>
        </testMethods>
      </testClass>
      <testClass adtcore:name="LTC_MAP">
        <testMethods>
          <testMethod adtcore:name="test_c"><alerts/></testMethod>
        </testMethods>
      </testClass>
    </testClasses>
  </program>
</aunit:runResult>`;
    const summary = parseUnitTestRunResult(xml);
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.methods.map((m) => m.testClass)).toEqual([
      'LTC_RESOLVE',
      'LTC_RESOLVE',
      'LTC_MAP',
    ]);
  });

  it('classifies critical alerts as failed and fatal alerts as error', () => {
    const xml = `<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core">
  <testClasses>
    <testClass adtcore:name="LTC_X">
      <testMethods>
        <testMethod adtcore:name="passes"><alerts/></testMethod>
        <testMethod adtcore:name="asserts">
          <alerts>
            <alert kind="failedAssertion" severity="critical">
              <title>Expected [1] but was [2]</title>
            </alert>
          </alerts>
        </testMethod>
        <testMethod adtcore:name="dumps">
          <alerts>
            <alert kind="exception" severity="fatal">
              <title>Uncaught exception CX_SY_ZERODIVIDE</title>
            </alert>
          </alerts>
        </testMethod>
      </testMethods>
    </testClass>
  </testClasses>
</aunit:runResult>`;
    const summary = parseUnitTestRunResult(xml);
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toBe(1);

    const asserts = summary.methods.find((m) => m.name === 'asserts');
    expect(asserts?.status).toBe('failed');
    expect(asserts?.alerts[0]?.title).toBe('Expected [1] but was [2]');

    const dumps = summary.methods.find((m) => m.name === 'dumps');
    expect(dumps?.status).toBe('error');
  });

  it('treats tolerable alerts (warnings) as passing', () => {
    const xml = `<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core">
  <testClasses>
    <testClass adtcore:name="LTC_W">
      <testMethods>
        <testMethod adtcore:name="warns">
          <alerts>
            <alert kind="warning" severity="tolerable"><title>slow</title></alert>
          </alerts>
        </testMethod>
      </testMethods>
    </testClass>
  </testClasses>
</aunit:runResult>`;
    const summary = parseUnitTestRunResult(xml);
    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.errors).toBe(0);
  });

  it('returns an empty summary when no test methods are present', () => {
    expect(parseUnitTestRunResult('<aunit:runResult/>')).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      methods: [],
    });
  });
});
