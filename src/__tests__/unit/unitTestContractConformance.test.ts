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
  IAdtCdsTestRunnable,
  IAdtCreatable,
  IAdtReadable,
  IAdtTestRunnable,
  IAdtValidatable,
  ICdsUnitTestConfig,
  ICdsUnitTestState,
  IUnitTestConfig,
  IUnitTestState,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../clients/AdtClient';

type UnitTestHandler = ReturnType<AdtClient['getUnitTest']>;
type CdsUnitTestHandler = ReturnType<AdtClient['getCdsUnitTest']>;

/** Compile error unless `T` is assignable to `Expected`. */
type Satisfies<T extends Expected, Expected> = T;

// --- What getUnitTest() must keep handing out -------------------------------
type _RunnableIsExposed = Satisfies<UnitTestHandler, IAdtTestRunnable>;
type _UnitIsCreatable = Satisfies<
  UnitTestHandler,
  IAdtCreatable<IUnitTestConfig, IUnitTestState>
>;
type _UnitIsReadable = Satisfies<
  UnitTestHandler,
  IAdtReadable<IUnitTestConfig, IUnitTestState>
>;
type _UnitIsValidatable = Satisfies<
  UnitTestHandler,
  IAdtValidatable<IUnitTestConfig, IUnitTestState>
>;

// --- And getCdsUnitTest() ---------------------------------------------------
type _CdsRunnableIsExposed = Satisfies<CdsUnitTestHandler, IAdtCdsTestRunnable>;
type _CdsIsCreatable = Satisfies<
  CdsUnitTestHandler,
  IAdtCreatable<ICdsUnitTestConfig, ICdsUnitTestState>
>;

/**
 * The narrowing has to bite, or it is decoration. A test run has no update,
 * delete, activate, check, lock or version resource, so the handed-out type
 * must NOT carry them — otherwise we are back to promising methods that throw.
 */
type _NoUpdate = UnitTestHandler extends { update: unknown } ? never : true;
type _NoDelete = UnitTestHandler extends { delete: unknown } ? never : true;
type _NoActivate = UnitTestHandler extends { activate: unknown } ? never : true;
type _NoLock = UnitTestHandler extends { lock: unknown } ? never : true;
type _NoVersions = UnitTestHandler extends { getVersions: unknown }
  ? never
  : true;

const refusedCapabilitiesStayOut: [
  _NoUpdate,
  _NoDelete,
  _NoActivate,
  _NoLock,
  _NoVersions,
] = [true, true, true, true, true];

describe('unit-test handler contract conformance', () => {
  it('exposes the run surface and the honest CRUD subset through AdtClient', () => {
    // The assertions above are the test; reaching here means they compiled.
    expect(refusedCapabilitiesStayOut).toEqual([true, true, true, true, true]);
  });
});
