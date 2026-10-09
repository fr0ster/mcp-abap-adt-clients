import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
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

export class AdtExecutor {
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
  >(results: R = classExecutorDocuments as unknown as R): ClassExecutor<R> {
    return new ClassExecutor<R>(this.connection, this.logger, results);
  }

  /**
   * Running a class's ABAP Unit tests, and asking about the run.
   *
   * The tests themselves are written through `AdtClient.getLocalTestClass()`;
   * a container class for them, where one is wanted, is `getClass()`.
   */
  getClassTestRunner<
    R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
  >(results: R = classTestRunnerDocuments as unknown as R): ClassTestRunner<R> {
    return new ClassTestRunner<R>(this.connection, this.logger, results);
  }

  getProgramExecutor<
    R extends IProgramExecutorResults = typeof programExecutorDocuments,
  >(results: R = programExecutorDocuments as unknown as R): ProgramExecutor<R> {
    return new ProgramExecutor<R>(this.connection, this.logger, results);
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
  ): ProgramTestRunner<R> {
    return new ProgramTestRunner<R>(this.connection, this.logger, results);
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
  ): FunctionGroupTestRunner<R> {
    return new FunctionGroupTestRunner<R>(
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
  ): FunctionModuleTestRunner<R> {
    return new FunctionModuleTestRunner<R>(
      this.connection,
      this.logger,
      results,
    );
  }
}
