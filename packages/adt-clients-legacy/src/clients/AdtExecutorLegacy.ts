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
  type AbapUnitRunnerValues,
  AdtExecutor,
  abapUnitTestRunnerDocuments,
  type ClassExecutorValues,
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
  type ProgramExecutorValues,
  programExecutorDocuments,
  programTestRunnerDocuments,
  type ResultValuesOf,
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
    ResultValuesOf<typeof classExecutorDocuments>
  >;
  override getClassExecutor<R extends IClassExecutorResults>(
    results: R,
  ): ClassExecutorLegacy<ResultValuesOf<R>>;
  override getClassExecutor(
    results: IClassExecutorResults = classExecutorDocuments,
  ): ClassExecutorLegacy<ClassExecutorValues> {
    return new ClassExecutorLegacy<ClassExecutorValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  /** Runs and the trace type lists refuse on 7.40; the trace schedule is inherited. */
  override getProgramExecutor(): ProgramExecutorLegacy<
    ResultValuesOf<typeof programExecutorDocuments>
  >;
  override getProgramExecutor<R extends IProgramExecutorResults>(
    results: R,
  ): ProgramExecutorLegacy<ResultValuesOf<R>>;
  override getProgramExecutor(
    results: IProgramExecutorResults = programExecutorDocuments,
  ): ProgramExecutorLegacy<ProgramExecutorValues> {
    return new ProgramExecutorLegacy<ProgramExecutorValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  override getClassTestRunner(): ClassTestRunnerLegacy<
    ResultValuesOf<typeof classTestRunnerDocuments>
  >;
  override getClassTestRunner<R extends IClassTestRunnerResults>(
    results: R,
  ): ClassTestRunnerLegacy<ResultValuesOf<R>>;
  override getClassTestRunner(
    results: IClassTestRunnerResults = classTestRunnerDocuments,
  ): ClassTestRunnerLegacy<AbapUnitRunnerValues> {
    return new ClassTestRunnerLegacy<AbapUnitRunnerValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  override getProgramTestRunner(): ProgramTestRunnerLegacy<
    ResultValuesOf<typeof programTestRunnerDocuments>
  >;
  override getProgramTestRunner<R extends IProgramTestRunnerResults>(
    results: R,
  ): ProgramTestRunnerLegacy<ResultValuesOf<R>>;
  override getProgramTestRunner(
    results: IProgramTestRunnerResults = programTestRunnerDocuments,
  ): ProgramTestRunnerLegacy<AbapUnitRunnerValues> {
    return new ProgramTestRunnerLegacy<AbapUnitRunnerValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  override getFunctionGroupTestRunner(): FunctionGroupTestRunnerLegacy<
    ResultValuesOf<typeof functionGroupTestRunnerDocuments>
  >;
  override getFunctionGroupTestRunner<
    R extends IFunctionGroupTestRunnerResults,
  >(results: R): FunctionGroupTestRunnerLegacy<ResultValuesOf<R>>;
  override getFunctionGroupTestRunner(
    results: IFunctionGroupTestRunnerResults = functionGroupTestRunnerDocuments,
  ): FunctionGroupTestRunnerLegacy<AbapUnitRunnerValues> {
    return new FunctionGroupTestRunnerLegacy<AbapUnitRunnerValues>(
      this.connection,
      { logger: this.logger, results },
    );
  }

  override getFunctionModuleTestRunner(): FunctionModuleTestRunnerLegacy<
    ResultValuesOf<typeof functionModuleTestRunnerDocuments>
  >;
  override getFunctionModuleTestRunner<
    R extends IFunctionModuleTestRunnerResults,
  >(results: R): FunctionModuleTestRunnerLegacy<ResultValuesOf<R>>;
  override getFunctionModuleTestRunner(
    results: IFunctionModuleTestRunnerResults = functionModuleTestRunnerDocuments,
  ): FunctionModuleTestRunnerLegacy<AbapUnitRunnerValues> {
    return new FunctionModuleTestRunnerLegacy<AbapUnitRunnerValues>(
      this.connection,
      { logger: this.logger, results },
    );
  }

  /**
   * The URI run on `/abapunit/testruns`; an object or package target, the
   * poll and the result refuse on 7.40, which has no `/abapunit/runs`.
   */
  override getAbapUnitTestRunner(): AbapUnitTestRunnerLegacy<
    ResultValuesOf<typeof abapUnitTestRunnerDocuments>
  >;
  override getAbapUnitTestRunner<R extends IAbapUnitTestRunnerResults>(
    results: R,
  ): AbapUnitTestRunnerLegacy<ResultValuesOf<R>>;
  override getAbapUnitTestRunner(
    results: IAbapUnitTestRunnerResults = abapUnitTestRunnerDocuments,
  ): AbapUnitTestRunnerLegacy<AbapUnitRunnerValues> {
    return new AbapUnitTestRunnerLegacy<AbapUnitRunnerValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }
}
