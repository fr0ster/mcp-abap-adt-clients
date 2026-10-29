/**
 * ADT Clients — executors barrel
 * Covers: AdtExecutor, createAdtExecutor. Contract types (IClassExecutor, IProgramExecutor
 * and friends) come from @mcp-abap-adt/interfaces — that is the one place
 * to import them.
 */

export { AdtExecutor } from './clients/AdtExecutor';
export { createAdtExecutor } from './clients/createAdtExecutor';
/**
 * What a subclass in another package extends or calls: the executor and
 * runner classes, and the helper a class runner's override reads its
 * containers with. The set is the compiler's, and nothing more.
 */
export {
  AbapUnitTestRunner,
  abapUnitTestRunnerDocuments,
  type IAbapUnitTestRunnerResults,
} from './executors/abapUnitTestRunner';
export {
  ClassExecutor,
  classExecutorDocuments,
  type IClassExecutorResults,
} from './executors/class/ClassExecutor';
export {
  ClassTestRunner,
  classTestRunnerDocuments,
  containersOf,
  type IClassTestRunnerResults,
  type IClassTestRunTarget,
} from './executors/class/ClassTestRunner';
export {
  FunctionGroupTestRunner,
  functionGroupTestRunnerDocuments,
  type IFunctionGroupTestRunnerResults,
} from './executors/functionGroup/FunctionGroupTestRunner';
export {
  FunctionModuleTestRunner,
  functionModuleTestRunnerDocuments,
  type IFunctionModuleTestRunnerResults,
  type IFunctionModuleTestRunSyncTarget,
} from './executors/functionModule/FunctionModuleTestRunner';
export {
  type IProgramExecutorResults,
  ProgramExecutor,
  programExecutorDocuments,
} from './executors/program/ProgramExecutor';
export {
  type IProgramTestRunnerResults,
  ProgramTestRunner,
  programTestRunnerDocuments,
} from './executors/program/ProgramTestRunner';
export {
  type ITraceSchedulingResults,
  traceSchedulingDocuments,
} from './executors/traceScheduling';
