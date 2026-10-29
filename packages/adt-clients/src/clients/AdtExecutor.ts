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

  getClassExecutor<
    R extends IClassExecutorResults = typeof classExecutorDocuments,
  >(results: R = classExecutorDocuments as unknown as R): ClassExecutor<R, V> {
    return new ClassExecutor<R, V>(this.connection, this.logger, results);
  }

  /**
   * Running a class's ABAP Unit tests, and asking about the run.
   *
   * The tests themselves are written through `AdtClient.getLocalTestClass()`;
   * a container class for them, where one is wanted, is `getClass()`.
   */
  getClassTestRunner<
    R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
  >(
    results: R = classTestRunnerDocuments as unknown as R,
  ): ClassTestRunner<R, V> {
    return new ClassTestRunner<R, V>(this.connection, this.logger, results);
  }

  getProgramExecutor<
    R extends IProgramExecutorResults = typeof programExecutorDocuments,
  >(
    results: R = programExecutorDocuments as unknown as R,
  ): ProgramExecutor<R, V> {
    return new ProgramExecutor<R, V>(this.connection, this.logger, results);
  }

  /**
   * Running a report's ABAP Unit tests — in its own source or its includes —
   * and asking about the run. The tests are written through
   * `AdtClient.getProgram()` or `getInclude()`.
   */
  getProgramTestRunner<
    R extends IProgramTestRunnerResults = typeof programTestRunnerDocuments,
  >(
    results: R = programTestRunnerDocuments as unknown as R,
  ): ProgramTestRunner<R, V> {
    return new ProgramTestRunner<R, V>(this.connection, this.logger, results);
  }

  /**
   * Running every ABAP Unit test of a function group, and asking about the
   * run. The tests are written through `AdtClient.getFunctionInclude()`.
   */
  getFunctionGroupTestRunner<
    R extends
      IFunctionGroupTestRunnerResults = typeof functionGroupTestRunnerDocuments,
  >(
    results: R = functionGroupTestRunnerDocuments as unknown as R,
  ): FunctionGroupTestRunner<R, V> {
    return new FunctionGroupTestRunner<R, V>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * Running the ABAP Unit tests that exercise one function module, and asking
   * about the run.
   */
  getFunctionModuleTestRunner<
    R extends
      IFunctionModuleTestRunnerResults = typeof functionModuleTestRunnerDocuments,
  >(
    results: R = functionModuleTestRunnerDocuments as unknown as R,
  ): FunctionModuleTestRunner<R, V> {
    return new FunctionModuleTestRunner<R, V>(
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
  getAbapUnitTestRunner<
    R extends IAbapUnitTestRunnerResults = typeof abapUnitTestRunnerDocuments,
  >(
    results: R = abapUnitTestRunnerDocuments as unknown as R,
  ): AbapUnitTestRunner<R, V> {
    return new AbapUnitTestRunner<R, V>(this.connection, this.logger, results);
  }
}
