/**
 * AdtExecutorLegacy — executors for legacy SAP systems (BASIS < 7.50).
 *
 * The ABAP Unit runners differ: a class's tests run on the legacy endpoint
 * (`ClassTestRunnerLegacy`); a report's, a function group's and a function
 * module's are refused without a request, because that endpoint has not been
 * measured to find them. The rest is inherited.
 */

import type {
  classTestRunnerDocuments,
  IClassTestRunnerResults,
} from '../executors/class/ClassTestRunner';
import { ClassTestRunnerLegacy } from '../executors/class/ClassTestRunnerLegacy';
import {
  FunctionGroupTestRunnerLegacy,
  type functionGroupTestRunnerDocuments,
  type IFunctionGroupTestRunnerResults,
} from '../executors/functionGroup/FunctionGroupTestRunner';
import {
  FunctionModuleTestRunnerLegacy,
  type functionModuleTestRunnerDocuments,
  type IFunctionModuleTestRunnerResults,
} from '../executors/functionModule/FunctionModuleTestRunner';
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
