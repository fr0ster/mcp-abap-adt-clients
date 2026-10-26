/**
 * Conformance of what runs ABAP Unit, and of where its CDS check lives, to the
 * declared contracts.
 *
 * Written from the CONSUMER's side on purpose. A class's `implements` clause is
 * already checked by tsc, so re-asserting it here would prove nothing. What
 * nothing pins is the other half: that the factory actually hands the
 * capability outwards. Narrow a getter back and every `implements` clause still
 * compiles while the consumer silently loses the capability — which is exactly
 * how the run surface came to be unreachable before interfaces 13.1.0, when the
 * handler had `run()` but the declared return type did not.
 *
 * A unit test is not an object type, so since 24.0.0 there is no unit-test
 * handler to conform: the tests are a class's `testclasses` include
 * (`getLocalTestClass()`), running them is an executor
 * (`AdtExecutor.getClassTestRunner()`), and whether a CDS view can be tested
 * with doubles is a question about the view (`getDdl()`).
 *
 * These are compile-time assertions. If they type-check, they pass; the runtime
 * body only exists so jest reports the file.
 */
import type {
  IAdtRunnable,
  ICdsTestDoubleCheckable,
  IClassUnitTestRunOptions,
  ITestRunInformation,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../clients/AdtClient';
import type { AdtExecutor } from '../../clients/AdtExecutor';
import type { AdtExecutorLegacy } from '../../clients/AdtExecutorLegacy';
import type {
  ClassTestRunner,
  IClassTestRunTarget,
} from '../../executors/class/ClassTestRunner';
import type { ClassTestRunnerLegacy } from '../../executors/class/ClassTestRunnerLegacy';

/** Compile error unless `T` is assignable to `Expected`. */
type Satisfies<T extends Expected, Expected> = T;

/**
 * What the factories hand a caller who names no result strategy. Functions
 * rather than `ReturnType<…>`: a generic factory's `ReturnType` resolves to its
 * constraints and would assert against `unknown`.
 */
const _handsOutRunner: (executor: AdtExecutor) => ClassTestRunner = (
  executor,
) => executor.getClassTestRunner();
const _handsOutLegacyRunner: (
  executor: AdtExecutorLegacy,
) => ClassTestRunnerLegacy = (executor) => executor.getClassTestRunner();
const _handsOutDdl = (client: AdtClient) => client.getDdl();
void _handsOutRunner;
void _handsOutLegacyRunner;

// --- Running, and asking about a run: two separate capabilities -------------
type _RunnerIsRunnable = Satisfies<
  ClassTestRunner,
  IAdtRunnable<IClassTestRunTarget, string, IClassUnitTestRunOptions>
>;
type _RunnerAnswersAboutRuns = Satisfies<
  ClassTestRunner,
  ITestRunInformation<string, string>
>;

// --- The CDS check is the view's --------------------------------------------
type _DdlChecksTestDoubles = Satisfies<
  ReturnType<typeof _handsOutDdl>,
  ICdsTestDoubleCheckable<string>
>;

/**
 * The runner runs; it does not manage. Writing tests is the local test class's
 * and creating a container is the class's — a runner carrying either would be
 * the second name for one request that this release removed.
 */
type _NoCreate = ClassTestRunner extends { create: unknown } ? never : true;
type _NoUpdate = ClassTestRunner extends { update: unknown } ? never : true;
type _NoDelete = ClassTestRunner extends { delete: unknown } ? never : true;
type _NoLock = ClassTestRunner extends { lock: unknown } ? never : true;

const managingStaysOut: [_NoCreate, _NoUpdate, _NoDelete, _NoLock] = [
  true,
  true,
  true,
  true,
];

describe('ABAP Unit contract conformance', () => {
  it('the runner runs and answers about runs — and manages nothing', () => {
    // The assertions above are the test; reaching here means they compiled.
    expect(managingStaysOut).toEqual([true, true, true, true]);
  });
});
