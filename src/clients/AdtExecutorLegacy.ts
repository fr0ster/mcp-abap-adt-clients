/**
 * AdtExecutorLegacy — executors for legacy SAP systems (BASIS < 7.50), over RFC.
 *
 * The ABAP Unit runners differ: 7.40 has no `/abapunit/runs`, so the
 * `/abapunit/testruns` request with `<options>` is what runs the tests —
 * measured on 7.40 SP04 for a class, a report, a function group and a function
 * module. A class's, a report's and a group's `run` and `runSync` all send it;
 * a function module's `runSync` sends it and its `run` is refused (it names no
 * group); `getStatus` and `getResult` are refused, as there is no run id.
 *
 * The class and program executors refuse their runs and the trace type lists
 * without a request (7.40 has no `/oo/classrun`; `programrun` and the trace
 * catalogues are not advertised and not measured); the trace schedule is
 * inherited, unmeasured.
 */

import type {
  classExecutorDocuments,
  IClassExecutorResults,
} from '../executors/class/ClassExecutor';
import { ClassExecutorLegacy } from '../executors/class/ClassExecutorLegacy';
import type {
  classTestRunnerDocuments,
  IClassTestRunnerResults,
} from '../executors/class/ClassTestRunner';
import { ClassTestRunnerLegacy } from '../executors/class/ClassTestRunnerLegacy';
import type {
  functionGroupTestRunnerDocuments,
  IFunctionGroupTestRunnerResults,
} from '../executors/functionGroup/FunctionGroupTestRunner';
import { FunctionGroupTestRunnerLegacy } from '../executors/functionGroup/FunctionGroupTestRunnerLegacy';
import type {
  functionModuleTestRunnerDocuments,
  IFunctionModuleTestRunnerResults,
} from '../executors/functionModule/FunctionModuleTestRunner';
import { FunctionModuleTestRunnerLegacy } from '../executors/functionModule/FunctionModuleTestRunnerLegacy';
import type {
  IProgramExecutorResults,
  programExecutorDocuments,
} from '../executors/program/ProgramExecutor';
import { ProgramExecutorLegacy } from '../executors/program/ProgramExecutorLegacy';
import type {
  IProgramTestRunnerResults,
  programTestRunnerDocuments,
} from '../executors/program/ProgramTestRunner';
import { ProgramTestRunnerLegacy } from '../executors/program/ProgramTestRunnerLegacy';
import { AdtExecutor } from './AdtExecutor';

export class AdtExecutorLegacy extends AdtExecutor {
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
}
