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
    expect(readRunResult(doc, 'abapunit')).toMatchObject({
      methods: ['TEST_A', 'TEST_B'],
      alerts: ['failedAssertion'],
    });
  });

  it('reads a junit document: its testcases and failures', () => {
    const doc =
      '<testsuites><testsuite><testcase name="TEST_A"/><testcase name="TEST_B"><failure message="x"/></testcase></testsuite></testsuites>';
    expect(readRunResult(doc, 'junit')).toMatchObject({
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
    expect(readRunResult(doc, 'abapunit')).toMatchObject({
      methods: ['FAILS'],
      alerts: ['failedAssertion'],
    });
  });

  it('reads other prefixes and line breaks inside a tag', () => {
    const doc =
      '<a:runResult xmlns:a="u" xmlns:c="v"><a:testMethod\n  c:name="TEST_A"\n><a:alert\n   kind="exception"/></a:testMethod></a:runResult>';
    expect(readRunResult(doc)).toMatchObject({
      methods: ['TEST_A'],
      alerts: ['exception'],
    });
  });

  it('finds a junit failure nested with attributes in any order', () => {
    const doc =
      '<testsuites><testsuite name="s"><testcase classname="c" name="T1"><error type="x" message="y"/></testcase></testsuite></testsuites>';
    expect(readRunResult(doc, 'junit')).toMatchObject({
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
    expect(readMethodVerdicts(doc)).toMatchObject({
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

describe('readRunResult judges every scope and the document itself', () => {
  const RUN = (inner: string) =>
    `<aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core">${inner}</aunit:runResult>`;

  it('keeps a run-level alert beside an empty method list', () => {
    const run = readRunResult(
      RUN(
        '<alerts><alert kind="exception" severity="critical"><title>no run</title></alert></alerts>',
      ),
    );
    expect(run.methods).toEqual([]);
    expect(run.failures).toEqual([
      { kind: 'exception', severity: 'critical', scope: 'run' },
    ]);
  });

  it('keeps a class-level alert', () => {
    const run = readRunResult(
      RUN(
        '<program><testClasses><testClass adtcore:name="LTC"><alerts><alert severity="fatal" kind="exception"/></alerts><testMethods/></testClass></testClasses></program>',
      ),
    );
    expect(run.failures).toEqual([
      { kind: 'exception', severity: 'fatal', scope: 'class' },
    ]);
  });

  it('does not count a tolerable warning as a failure', () => {
    const run = readRunResult(
      RUN('<alerts><alert kind="warning" severity="tolerable"/></alerts>'),
    );
    expect(run.alerts).toEqual(['warning']);
    expect(run.failures).toEqual([]);
  });

  it('refuses an exception document inside a 200, naming its message', () => {
    expect(() =>
      readRunResult(
        '<exc:exception xmlns:exc="x"><type id="ExceptionResourceNoAccess"/><message lang="EN">No authorization</message></exc:exception>',
      ),
    ).toThrow(/exception document: No authorization/);
  });

  it('refuses a document of another root', () => {
    expect(() => readRunResult('<chkl:messages xmlns:chkl="c"/>')).toThrow(
      /root "messages", not "runResult"/,
    );
    expect(() => readRunResult('<runResult/>', 'junit')).toThrow(
      /not "testsuites" or "testsuite"/,
    );
  });

  it('readMethodVerdicts answers the run-level alerts too', () => {
    const { methods, alerts } = readMethodVerdicts(
      RUN('<alerts><alert kind="exception" severity="critical"/></alerts>'),
    );
    expect(methods).toEqual([]);
    expect(alerts).toEqual([
      { kind: 'exception', severity: 'critical', scope: 'run' },
    ]);
  });
});
