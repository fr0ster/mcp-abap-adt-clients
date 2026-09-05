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

type UnitTestHandler = ReturnType<AdtClient['getUnitTest']>;
type CdsUnitTestHandler = ReturnType<AdtClient['getCdsUnitTest']>;

/** Compile error unless `T` is assignable to `Expected`. */
type Satisfies<T extends Expected, Expected> = T;

// --- Managing the tests: the container class and its testclasses include ----
type _UnitIsCreatable = Satisfies<
  UnitTestHandler,
  IAdtCreatable<IUnitTestConfig, IUnitTestState>
>;
type _UnitIsReadable = Satisfies<
  UnitTestHandler,
  IAdtReadable<IUnitTestConfig, IUnitTestState>
>;
type _UnitIsUpdatable = Satisfies<
  UnitTestHandler,
  IAdtUpdatable<IUnitTestConfig, IUnitTestState>
>;
type _UnitIsDeletable = Satisfies<
  UnitTestHandler,
  IAdtDeletable<IUnitTestConfig, IUnitTestState>
>;
type _UnitIsValidatable = Satisfies<
  UnitTestHandler,
  IAdtValidatable<IUnitTestConfig, IUnitTestState>
>;
/** The lock is the container class's — see AdtUnitTest. */
type _UnitIsLockable = Satisfies<
  UnitTestHandler,
  IAdtLockable<IUnitTestConfig, IUnitTestState>
>;

// --- Running, and asking about a run: two separate capabilities -------------
type _UnitIsRunnable = Satisfies<
  UnitTestHandler,
  IAdtRunnable<IClassUnitTestDefinition[], string, IClassUnitTestRunOptions>
>;
type _UnitAnswersAboutRuns = Satisfies<UnitTestHandler, ITestRunInformation>;

// --- And getCdsUnitTest() ---------------------------------------------------
type _CdsIsCreatable = Satisfies<
  CdsUnitTestHandler,
  IAdtCreatable<ICdsUnitTestConfig, ICdsUnitTestState>
>;
type _CdsChecksTestDoubles = Satisfies<
  CdsUnitTestHandler,
  ICdsTestDoubleCheckable
>;
type _CdsAnswersAboutRuns = Satisfies<CdsUnitTestHandler, ITestRunInformation>;

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
