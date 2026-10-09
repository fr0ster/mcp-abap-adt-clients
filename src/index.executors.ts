/**
 * ADT Clients — executors barrel
 * Covers: AdtExecutor, AdtExecutorLegacy, createAdtExecutor. Contract types (IClassExecutor, IProgramExecutor
 * and friends) come from @mcp-abap-adt/interfaces — that is the one place
 * to import them.
 */

export { AdtExecutor } from './clients/AdtExecutor';
export { AdtExecutorLegacy } from './clients/AdtExecutorLegacy';
export { createAdtExecutor } from './clients/createAdtExecutor';
export {
  classExecutorDocuments,
  type IClassExecutorResults,
} from './executors/class/ClassExecutor';
export {
  classTestRunnerDocuments,
  type IClassTestRunnerResults,
  type IClassTestRunTarget,
} from './executors/class/ClassTestRunner';
export {
  functionGroupTestRunnerDocuments,
  type IFunctionGroupTestRunnerResults,
} from './executors/functionGroup/FunctionGroupTestRunner';
export {
  functionModuleTestRunnerDocuments,
  type IFunctionModuleTestRunnerResults,
} from './executors/functionModule/FunctionModuleTestRunner';
export {
  type IProgramExecutorResults,
  programExecutorDocuments,
} from './executors/program/ProgramExecutor';
export {
  type IProgramTestRunnerResults,
  programTestRunnerDocuments,
} from './executors/program/ProgramTestRunner';
export {
  type ITraceSchedulingResults,
  traceSchedulingDocuments,
} from './executors/traceScheduling';
