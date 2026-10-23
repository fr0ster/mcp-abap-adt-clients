/**
 * AdtExecutorLegacy — executors for legacy SAP systems (BASIS < 7.50).
 *
 * The ABAP Unit runners differ: 7.40 has no `/abapunit/runs`, so every
 * runner's inherited `runSync` — `/abapunit/testruns` with `<options>`,
 * measured for a class, a report, a function group and a function module — is
 * what runs the tests. A class's, a report's and a group's `run` send that same
 * request; a function module's `run` is refused (it names no group), and there
 * is no run to poll or fetch. The rest is inherited.
 */

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
  IProgramTestRunnerResults,
  programTestRunnerDocuments,
} from '../executors/program/ProgramTestRunner';
import { ProgramTestRunnerLegacy } from '../executors/program/ProgramTestRunnerLegacy';
import { AdtExecutor } from './AdtExecutor';

export class AdtExecutorLegacy extends AdtExecutor {
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
