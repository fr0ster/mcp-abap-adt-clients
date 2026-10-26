/**
 * The legacy executor hands out the legacy class runner, as the root
 * package's `unitTestContractConformance.test.ts` asserts the modern one:
 * from the consumer's side, so a getter narrowed back fails to compile.
 *
 * A compile-time assertion. If it type-checks, it passes; the runtime body
 * only exists so jest reports the file.
 */
import type { AdtExecutorLegacy } from '../../clients/AdtExecutorLegacy';
import type { ClassTestRunnerLegacy } from '../../executors/class/ClassTestRunnerLegacy';

const handsOutLegacyRunner: (
  executor: AdtExecutorLegacy,
) => ClassTestRunnerLegacy = (executor) => executor.getClassTestRunner();

describe('ABAP Unit contract conformance', () => {
  it('the legacy executor hands out the legacy class runner', () => {
    // The assertion above is the test; reaching here means it compiled.
    expect(typeof handsOutLegacyRunner).toBe('function');
  });
});
