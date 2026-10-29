/**
 * AdtExecutorLegacy — executors for legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04), over RFC.
 *
 * The ABAP Unit runners differ: 7.40 has no `/abapunit/runs`, so the
 * `/abapunit/testruns` request with `<options>` is what runs the tests —
 * measured on 7.40 SP04 for a class, a report, a function group and a function
 * module. A class's, a report's and a group's `run` and `runSync` all send it;
 * a function module's `runSync` sends it and its `run` is refused (it names no
 * group); `getStatus` and `getResult` are refused, as there is no run id.
 *
 * The generic runner keeps its URI run on `/abapunit/testruns` and refuses an
 * object or a package target, and the poll and result, without a request.
 *
 * The class and program executors refuse their runs and the trace type lists
 * without a request (7.40 has no `/oo/classrun`; `programrun` and the trace
 * catalogues are not advertised and not measured); the trace schedule is
 * inherited, unmeasured.
 */

import {
  AdtExecutor,
  abapUnitTestRunnerDocuments,
  classExecutorDocuments,
  classTestRunnerDocuments,
  functionGroupTestRunnerDocuments,
  functionModuleTestRunnerDocuments,
  type IAbapUnitTestRunnerResults,
  type IClassExecutorResults,
  type IClassTestRunnerResults,
  type IFunctionGroupTestRunnerResults,
  type IFunctionModuleTestRunnerResults,
  type IProgramExecutorResults,
  type IProgramTestRunnerResults,
  programExecutorDocuments,
  programTestRunnerDocuments,
} from '@mcp-abap-adt/adt-clients';
import { AbapUnitTestRunnerLegacy } from '../executors/abapUnit/AbapUnitTestRunnerLegacy';
import { ClassExecutorLegacy } from '../executors/class/ClassExecutorLegacy';
import { ClassTestRunnerLegacy } from '../executors/class/ClassTestRunnerLegacy';
import { FunctionGroupTestRunnerLegacy } from '../executors/functionGroup/FunctionGroupTestRunnerLegacy';
import { FunctionModuleTestRunnerLegacy } from '../executors/functionModule/FunctionModuleTestRunnerLegacy';
import { ProgramExecutorLegacy } from '../executors/program/ProgramExecutorLegacy';
import { ProgramTestRunnerLegacy } from '../executors/program/ProgramTestRunnerLegacy';

export class AdtExecutorLegacy extends AdtExecutor<'basis740'> {
  /** Runs and the trace type lists refuse on 7.40; the trace schedule is inherited. */
  override getClassExecutor(): ClassExecutorLegacy<
    typeof classExecutorDocuments
  >;
  override getClassExecutor<R extends IClassExecutorResults>(
    results: R,
  ): ClassExecutorLegacy<R>;
  override getClassExecutor(
    results: IClassExecutorResults = classExecutorDocuments,
  ): ClassExecutorLegacy<IClassExecutorResults> {
    return new ClassExecutorLegacy<IClassExecutorResults>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  /** Runs and the trace type lists refuse on 7.40; the trace schedule is inherited. */
  override getProgramExecutor(): ProgramExecutorLegacy<
    typeof programExecutorDocuments
  >;
  override getProgramExecutor<R extends IProgramExecutorResults>(
    results: R,
  ): ProgramExecutorLegacy<R>;
  override getProgramExecutor(
    results: IProgramExecutorResults = programExecutorDocuments,
  ): ProgramExecutorLegacy<IProgramExecutorResults> {
    return new ProgramExecutorLegacy<IProgramExecutorResults>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  override getClassTestRunner(): ClassTestRunnerLegacy<
    typeof classTestRunnerDocuments
  >;
  override getClassTestRunner<R extends IClassTestRunnerResults>(
    results: R,
  ): ClassTestRunnerLegacy<R>;
  override getClassTestRunner(
    results: IClassTestRunnerResults = classTestRunnerDocuments,
  ): ClassTestRunnerLegacy<IClassTestRunnerResults> {
    return new ClassTestRunnerLegacy<IClassTestRunnerResults>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  override getProgramTestRunner(): ProgramTestRunnerLegacy<
    typeof programTestRunnerDocuments
  >;
  override getProgramTestRunner<R extends IProgramTestRunnerResults>(
    results: R,
  ): ProgramTestRunnerLegacy<R>;
  override getProgramTestRunner(
    results: IProgramTestRunnerResults = programTestRunnerDocuments,
  ): ProgramTestRunnerLegacy<IProgramTestRunnerResults> {
    return new ProgramTestRunnerLegacy<IProgramTestRunnerResults>(
      this.connection,
      { logger: this.logger, results },
    );
  }

  override getFunctionGroupTestRunner(): FunctionGroupTestRunnerLegacy<
    typeof functionGroupTestRunnerDocuments
  >;
  override getFunctionGroupTestRunner<
    R extends IFunctionGroupTestRunnerResults,
  >(results: R): FunctionGroupTestRunnerLegacy<R>;
  override getFunctionGroupTestRunner(
    results: IFunctionGroupTestRunnerResults = functionGroupTestRunnerDocuments,
  ): FunctionGroupTestRunnerLegacy<IFunctionGroupTestRunnerResults> {
    return new FunctionGroupTestRunnerLegacy<IFunctionGroupTestRunnerResults>(
      this.connection,
      { logger: this.logger, results },
    );
  }

  override getFunctionModuleTestRunner(): FunctionModuleTestRunnerLegacy<
    typeof functionModuleTestRunnerDocuments
  >;
  override getFunctionModuleTestRunner<
    R extends IFunctionModuleTestRunnerResults,
  >(results: R): FunctionModuleTestRunnerLegacy<R>;
  override getFunctionModuleTestRunner(
    results: IFunctionModuleTestRunnerResults = functionModuleTestRunnerDocuments,
  ): FunctionModuleTestRunnerLegacy<IFunctionModuleTestRunnerResults> {
    return new FunctionModuleTestRunnerLegacy<IFunctionModuleTestRunnerResults>(
      this.connection,
      { logger: this.logger, results },
    );
  }

  /**
   * The URI run on `/abapunit/testruns`; an object or package target, the
   * poll and the result refuse on 7.40, which has no `/abapunit/runs`.
   */
  override getAbapUnitTestRunner(): AbapUnitTestRunnerLegacy<
    typeof abapUnitTestRunnerDocuments
  >;
  override getAbapUnitTestRunner<R extends IAbapUnitTestRunnerResults>(
    results: R,
  ): AbapUnitTestRunnerLegacy<R>;
  override getAbapUnitTestRunner(
    results: IAbapUnitTestRunnerResults = abapUnitTestRunnerDocuments,
  ): AbapUnitTestRunnerLegacy<IAbapUnitTestRunnerResults> {
    return new AbapUnitTestRunnerLegacy<IAbapUnitTestRunnerResults>(
      this.connection,
      { logger: this.logger, results },
    );
  }
}
