/**
 * `readRunResult` reads the tests that ran and the failures they raised from
 * a result document in the format it was asked for; a format it cannot read
 * is thrown, never read as "no failures".
 */
import { readMethodVerdicts, readRunResult } from '../../helpers/abapUnitRun';

describe('readRunResult', () => {
  it('reads an abapunit document: its methods and alert kinds', () => {
    const doc =
      '<aunit:runResult><testMethod adtcore:name="TEST_A"/><testMethod adtcore:name="TEST_B"><alerts><alert kind="failedAssertion"/></alerts></testMethod></aunit:runResult>';
    expect(readRunResult(doc, 'abapunit')).toEqual({
      methods: ['TEST_A', 'TEST_B'],
      alerts: ['failedAssertion'],
    });
  });

  it('reads a junit document: its testcases and failures', () => {
    const doc =
      '<testsuites><testsuite><testcase name="TEST_A"/><testcase name="TEST_B"><failure message="x"/></testcase></testsuite></testsuites>';
    expect(readRunResult(doc, 'junit')).toEqual({
      methods: ['TEST_A', 'TEST_B'],
      alerts: ['failure'],
    });
  });

  it('throws for a format it cannot read', () => {
    expect(() => readRunResult('<x/>', 'tap')).toThrow(/cannot be read/);
  });
});

describe('readRunResult reads the document, not its spelling', () => {
  it('finds an alert whose kind is not its first attribute', () => {
    const doc =
      '<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core"><program><testClasses><testClass><testMethods><testMethod adtcore:uri="/x" adtcore:name="FAILS"><alerts><alert severity="critical" kind="failedAssertion"><title>x</title></alert></alerts></testMethod></testMethods></testClass></testClasses></program></aunit:runResult>';
    expect(readRunResult(doc, 'abapunit')).toEqual({
      methods: ['FAILS'],
      alerts: ['failedAssertion'],
    });
  });

  it('reads other prefixes and line breaks inside a tag', () => {
    const doc =
      '<a:runResult xmlns:a="u" xmlns:c="v"><a:testMethod\n  c:name="TEST_A"\n><a:alert\n   kind="exception"/></a:testMethod></a:runResult>';
    expect(readRunResult(doc)).toEqual({
      methods: ['TEST_A'],
      alerts: ['exception'],
    });
  });

  it('finds a junit failure nested with attributes in any order', () => {
    const doc =
      '<testsuites><testsuite name="s"><testcase classname="c" name="T1"><error type="x" message="y"/></testcase></testsuite></testsuites>';
    expect(readRunResult(doc, 'junit')).toEqual({
      methods: ['T1'],
      alerts: ['error'],
    });
  });
});

describe('readRunResult refuses what it cannot read', () => {
  it('throws for a result that is not XML', () => {
    expect(() =>
      readRunResult('<runResult><testMethod name="A"></runResult>'),
    ).toThrow(/not XML/);
  });
});

describe('readMethodVerdicts', () => {
  it('names each method with its class and the alerts under it, attributes in any order', () => {
    const doc =
      '<aunit:runResult xmlns:aunit="a" xmlns:adtcore="c"><program adtcore:name="ZP" adtcore:type="PROG/P"><testClasses><testClass adtcore:uri="/u" adtcore:name="LTC"><testMethods><testMethod adtcore:name="OK"/><testMethod adtcore:uri="/m" adtcore:name="FAILS"><alerts><alert severity="critical" kind="failedAssertion"/></alerts></testMethod></testMethods></testClass></testClasses></program></aunit:runResult>';
    expect(readMethodVerdicts(doc)).toEqual({
      programTypes: ['PROG/P'],
      methods: [
        { testClass: 'LTC', name: 'OK', alerts: [] },
        { testClass: 'LTC', name: 'FAILS', alerts: ['failedAssertion'] },
      ],
    });
  });

  it('throws for a result that is not XML', () => {
    expect(() => readMethodVerdicts('<x><y></x>')).toThrow(/not XML/);
  });
});
