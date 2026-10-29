import type { AdtVariant } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  AbapUnitTestRunner,
  abapUnitTestRunnerDocuments,
  type IAbapUnitTestRunnerResults,
} from '../executors/abapUnitTestRunner';
import {
  ClassExecutor,
  classExecutorDocuments,
  type IClassExecutorResults,
} from '../executors/class/ClassExecutor';
import {
  ClassTestRunner,
  classTestRunnerDocuments,
  type IClassTestRunnerResults,
} from '../executors/class/ClassTestRunner';
import {
  FunctionGroupTestRunner,
  functionGroupTestRunnerDocuments,
  type IFunctionGroupTestRunnerResults,
} from '../executors/functionGroup/FunctionGroupTestRunner';
import {
  FunctionModuleTestRunner,
  functionModuleTestRunnerDocuments,
  type IFunctionModuleTestRunnerResults,
} from '../executors/functionModule/FunctionModuleTestRunner';
import {
  type IProgramExecutorResults,
  ProgramExecutor,
  programExecutorDocuments,
} from '../executors/program/ProgramExecutor';
import {
  type IProgramTestRunnerResults,
  ProgramTestRunner,
  programTestRunnerDocuments,
} from '../executors/program/ProgramTestRunner';
import { withRequestTrace } from '../utils/requestTrace';
import type { AdtModernVariant } from './variant';

/**
 * Every getter has two overloads: with no argument it answers its runner or
 * executor typed by the shipped documents (`typeof <x>Documents`); with a
 * result set it answers one typed by that set. A caller naming its own `R`
 * passes its results — there is no default the compiler would type as `R`.
 */
export class AdtExecutor<V extends AdtVariant = AdtModernVariant> {
  /**
   * The release variant this serves, as a type only — never set. The
   * executors and runners it answers are of this variant, and their members'
   * gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;

  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    // Wrapped once, here, where a connection enters the library. The wrapper
    // puts the request back on the answer and reads nothing: what a body means
    // is the caller's, through the `analyse` they pass.
    this.connection = withRequestTrace(connection);
    this.logger = logger;
  }

  getClassExecutor(): ClassExecutor<typeof classExecutorDocuments, V>;
  getClassExecutor<R extends IClassExecutorResults>(
    results: R,
  ): ClassExecutor<R, V>;
  getClassExecutor(
    results: IClassExecutorResults = classExecutorDocuments,
  ): ClassExecutor<IClassExecutorResults, V> {
    return new ClassExecutor<IClassExecutorResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * Running a class's ABAP Unit tests, and asking about the run.
   *
   * The tests themselves are written through `AdtClient.getLocalTestClass()`;
   * a container class for them, where one is wanted, is `getClass()`.
   */
  getClassTestRunner(): ClassTestRunner<typeof classTestRunnerDocuments, V>;
  getClassTestRunner<R extends IClassTestRunnerResults>(
    results: R,
  ): ClassTestRunner<R, V>;
  getClassTestRunner(
    results: IClassTestRunnerResults = classTestRunnerDocuments,
  ): ClassTestRunner<IClassTestRunnerResults, V> {
    return new ClassTestRunner<IClassTestRunnerResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  getProgramExecutor(): ProgramExecutor<typeof programExecutorDocuments, V>;
  getProgramExecutor<R extends IProgramExecutorResults>(
    results: R,
  ): ProgramExecutor<R, V>;
  getProgramExecutor(
    results: IProgramExecutorResults = programExecutorDocuments,
  ): ProgramExecutor<IProgramExecutorResults, V> {
    return new ProgramExecutor<IProgramExecutorResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * Running a report's ABAP Unit tests — in its own source or its includes —
   * and asking about the run. The tests are written through
   * `AdtClient.getProgram()` or `getInclude()`.
   */
  getProgramTestRunner(): ProgramTestRunner<
    typeof programTestRunnerDocuments,
    V
  >;
  getProgramTestRunner<R extends IProgramTestRunnerResults>(
    results: R,
  ): ProgramTestRunner<R, V>;
  getProgramTestRunner(
    results: IProgramTestRunnerResults = programTestRunnerDocuments,
  ): ProgramTestRunner<IProgramTestRunnerResults, V> {
    return new ProgramTestRunner<IProgramTestRunnerResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * Running every ABAP Unit test of a function group, and asking about the
   * run. The tests are written through `AdtClient.getFunctionInclude()`.
   */
  getFunctionGroupTestRunner(): FunctionGroupTestRunner<
    typeof functionGroupTestRunnerDocuments,
    V
  >;
  getFunctionGroupTestRunner<R extends IFunctionGroupTestRunnerResults>(
    results: R,
  ): FunctionGroupTestRunner<R, V>;
  getFunctionGroupTestRunner(
    results: IFunctionGroupTestRunnerResults = functionGroupTestRunnerDocuments,
  ): FunctionGroupTestRunner<IFunctionGroupTestRunnerResults, V> {
    return new FunctionGroupTestRunner<IFunctionGroupTestRunnerResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * Running the ABAP Unit tests that exercise one function module, and asking
   * about the run.
   */
  getFunctionModuleTestRunner(): FunctionModuleTestRunner<
    typeof functionModuleTestRunnerDocuments,
    V
  >;
  getFunctionModuleTestRunner<R extends IFunctionModuleTestRunnerResults>(
    results: R,
  ): FunctionModuleTestRunner<R, V>;
  getFunctionModuleTestRunner(
    results: IFunctionModuleTestRunnerResults = functionModuleTestRunnerDocuments,
  ): FunctionModuleTestRunner<IFunctionModuleTestRunnerResults, V> {
    return new FunctionModuleTestRunner<IFunctionModuleTestRunnerResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * The generic ABAP Unit runner: a run of one object of any type the
   * registry (`ABAP_UNIT_RUN_TYPES`) lists, or of a package, and a run of
   * objects named by their ADT URIs — beside the four per-object runners,
   * which keep the types they send. A CDS view's tests are assigned tests:
   * they execute only with `scope: { foreignTests: true }` — with the default
   * preview they are listed without being executed, a failing one with no
   * alert.
   */
  getAbapUnitTestRunner(): AbapUnitTestRunner<
    typeof abapUnitTestRunnerDocuments,
    V
  >;
  getAbapUnitTestRunner<R extends IAbapUnitTestRunnerResults>(
    results: R,
  ): AbapUnitTestRunner<R, V>;
  getAbapUnitTestRunner(
    results: IAbapUnitTestRunnerResults = abapUnitTestRunnerDocuments,
  ): AbapUnitTestRunner<IAbapUnitTestRunnerResults, V> {
    return new AbapUnitTestRunner<IAbapUnitTestRunnerResults, V>(
      this.connection,
      this.logger,
      results,
    );
  }
}
