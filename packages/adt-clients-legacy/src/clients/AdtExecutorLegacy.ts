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
  type abapUnitTestRunnerDocuments,
  type classExecutorDocuments,
  type classTestRunnerDocuments,
  type functionGroupTestRunnerDocuments,
  type functionModuleTestRunnerDocuments,
  type IAbapUnitTestRunnerResults,
  type IClassExecutorResults,
  type IClassTestRunnerResults,
  type IFunctionGroupTestRunnerResults,
  type IFunctionModuleTestRunnerResults,
  type IProgramExecutorResults,
  type IProgramTestRunnerResults,
  type programExecutorDocuments,
  type programTestRunnerDocuments,
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
  override getClassExecutor<
    R extends IClassExecutorResults = typeof classExecutorDocuments,
  >(results?: R): ClassExecutorLegacy<R> {
    return new ClassExecutorLegacy<R>(this.connection, this.logger, results);
  }

  /** Runs and the trace type lists refuse on 7.40; the trace schedule is inherited. */
  override getProgramExecutor<
    R extends IProgramExecutorResults = typeof programExecutorDocuments,
  >(results?: R): ProgramExecutorLegacy<R> {
    return new ProgramExecutorLegacy<R>(this.connection, this.logger, results);
  }

  override getClassTestRunner<
    R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
  >(results?: R): ClassTestRunnerLegacy<R> {
    return new ClassTestRunnerLegacy<R>(this.connection, this.logger, results);
  }

  override getProgramTestRunner<
    R extends IProgramTestRunnerResults = typeof programTestRunnerDocuments,
  >(results?: R): ProgramTestRunnerLegacy<R> {
    return new ProgramTestRunnerLegacy<R>(
      this.connection,
      this.logger,
      results,
    );
  }

  override getFunctionGroupTestRunner<
    R extends
      IFunctionGroupTestRunnerResults = typeof functionGroupTestRunnerDocuments,
  >(results?: R): FunctionGroupTestRunnerLegacy<R> {
    return new FunctionGroupTestRunnerLegacy<R>(
      this.connection,
      this.logger,
      results,
    );
  }

  override getFunctionModuleTestRunner<
    R extends
      IFunctionModuleTestRunnerResults = typeof functionModuleTestRunnerDocuments,
  >(results?: R): FunctionModuleTestRunnerLegacy<R> {
    return new FunctionModuleTestRunnerLegacy<R>(
      this.connection,
      this.logger,
      results,
    );
  }

  /**
   * The URI run on `/abapunit/testruns`; an object or package target, the
   * poll and the result refuse on 7.40, which has no `/abapunit/runs`.
   */
  override getAbapUnitTestRunner<
    R extends IAbapUnitTestRunnerResults = typeof abapUnitTestRunnerDocuments,
  >(results?: R): AbapUnitTestRunnerLegacy<R> {
    return new AbapUnitTestRunnerLegacy<R>(
      this.connection,
      this.logger,
      results,
    );
  }
}
