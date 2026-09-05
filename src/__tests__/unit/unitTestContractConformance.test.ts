/**
 * Conformance of the unit-test handlers to their declared contracts.
 *
 * Written from the CONSUMER's side on purpose. A class's `implements` clause is
 * already checked by tsc, so re-asserting it here would prove nothing. What
 * nothing pins is the other half: that `AdtClient.getXxx()` actually hands the
 * capability outwards. Narrow a getter back and every `implements` clause still
 * compiles while the consumer silently loses the capability — which is exactly
 * how the run surface came to be unreachable before interfaces 13.1.0, when the
 * handler had `run()` but the declared return type did not.
 *
 * These are compile-time assertions. If they type-check, they pass; the runtime
 * body only exists so jest reports the file.
 */
import type {
  IAdtCreatable,
  IAdtDeletable,
  IAdtLockable,
  IAdtReadable,
  IAdtRunnable,
  IAdtUpdatable,
  IAdtValidatable,
  ICdsTestDoubleCheckable,
  ICdsUnitTestConfig,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  ITestRunInformation,
  IUnitTestConfig,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../clients/AdtClient';
import type { AdtCdsUnitTest, AdtUnitTest } from '../../core/unitTest';

/**
 * What `getUnitTest()` hands a caller who names no result strategy.
 *
 * Not `ReturnType<AdtClient['getUnitTest']>`: the factory is overloaded, and
 * `ReturnType` resolves an overloaded signature to the **last** one — the
 * generic form, whose type arguments are its own constraints. That would assert
 * against `unknown` and pass whatever the handler answered. The two functions
 * below are the assertion that the factory hands out these handlers at all;
 * everything after them checks what those handlers promise.
 */
const _handsOutUnitTest: (client: AdtClient) => AdtUnitTest = (client) =>
  client.getUnitTest();
const _handsOutCdsUnitTest: (client: AdtClient) => AdtCdsUnitTest = (client) =>
  client.getCdsUnitTest();
void _handsOutUnitTest;
void _handsOutCdsUnitTest;

type UnitTestHandler = AdtUnitTest;
type CdsUnitTestHandler = AdtCdsUnitTest;

/** Compile error unless `T` is assignable to `Expected`. */
type Satisfies<T extends Expected, Expected> = T;

// --- Managing the tests: the container class and its testclasses include ----
type _UnitIsCreatable = Satisfies<
  UnitTestHandler,
  IAdtCreatable<IUnitTestConfig, string>
>;
type _UnitIsReadable = Satisfies<
  UnitTestHandler,
  IAdtReadable<IUnitTestConfig, string, string>
>;
type _UnitIsUpdatable = Satisfies<
  UnitTestHandler,
  IAdtUpdatable<IUnitTestConfig, string>
>;
type _UnitIsDeletable = Satisfies<
  UnitTestHandler,
  IAdtDeletable<IUnitTestConfig, string>
>;
type _UnitIsValidatable = Satisfies<
  UnitTestHandler,
  IAdtValidatable<IUnitTestConfig, string>
>;
/** The lock is the container class's — see AdtUnitTest. */
type _UnitIsLockable = Satisfies<
  UnitTestHandler,
  IAdtLockable<IUnitTestConfig>
>;

// --- Running, and asking about a run: two separate capabilities -------------
type _UnitIsRunnable = Satisfies<
  UnitTestHandler,
  IAdtRunnable<IClassUnitTestDefinition[], string, IClassUnitTestRunOptions>
>;
type _UnitAnswersAboutRuns = Satisfies<
  UnitTestHandler,
  ITestRunInformation<string, string>
>;

// --- And getCdsUnitTest() ---------------------------------------------------
type _CdsIsCreatable = Satisfies<
  CdsUnitTestHandler,
  IAdtCreatable<ICdsUnitTestConfig, string>
>;
type _CdsChecksTestDoubles = Satisfies<
  CdsUnitTestHandler,
  ICdsTestDoubleCheckable<string>
>;
type _CdsAnswersAboutRuns = Satisfies<
  CdsUnitTestHandler,
  ITestRunInformation<string, string>
>;

/**
 * The narrowing has to bite, or it is decoration. A unit test is not activated,
 * has no syntax check of its own beyond `validate`, no version history and no
 * transport — those belong to the container class, reached through
 * `getClass()`. The handed-out type must not carry them.
 */
type _NoActivate = UnitTestHandler extends { activate: unknown } ? never : true;
type _NoCheck = UnitTestHandler extends { check: unknown } ? never : true;
type _NoVersions = UnitTestHandler extends { getVersions: unknown }
  ? never
  : true;
type _NoTransport = UnitTestHandler extends { readTransport: unknown }
  ? never
  : true;

const refusedCapabilitiesStayOut: [
  _NoActivate,
  _NoCheck,
  _NoVersions,
  _NoTransport,
] = [true, true, true, true];

describe('unit-test handler contract conformance', () => {
  it('hands out managing, running and asking — and nothing else', () => {
    // The assertions above are the test; reaching here means they compiled.
    expect(refusedCapabilitiesStayOut).toEqual([true, true, true, true]);
  });
});
