/**
 * `readRunResult` reads the tests that ran and the failures they raised from
 * a result document in the format it was asked for; a format it cannot read
 * is thrown, never read as "no failures".
 */
import { readRunResult } from '../../helpers/abapUnitRun';

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
