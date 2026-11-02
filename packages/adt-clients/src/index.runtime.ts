/**
 * ADT Clients — runtime barrel
 * Covers: AdtRuntimeClient and all runtime/** modules.
 */

export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export {
  ApplicationLog,
  type ApplicationLogValues,
  applicationLogDocuments,
  type IApplicationLogResults,
} from './runtime/applicationLog/ApplicationLog';
export {
  AdtAtc,
  type AtcValues,
  atcDocuments,
  type IAtcResults,
} from './runtime/atc/AdtAtc';
export {
  AtcLog,
  type AtcLogValues,
  atcLogDocuments,
  type IAtcLogResults,
} from './runtime/atc/AtcLog';
export {
  DdicActivation,
  type DdicActivationValues,
  ddicActivationDocuments,
  type IDdicActivationResults,
} from './runtime/ddic/DdicActivation';
// The debuggers and memory snapshots. Each needs sessions of its own — see
// their class docs — so they are constructed on connections the caller opens,
// not handed out by AdtRuntimeClient.
export {
  AbapDebugger,
  type AbapDebuggerConstructorOptions,
  type AbapDebuggerValues,
  abapDebuggerDocuments,
  type IAbapDebuggerOptions,
  type IAbapDebuggerResults,
} from './runtime/debugger/AbapDebugger';
export {
  AmdpDebugger,
  type AmdpDebuggerValues,
  amdpDebuggerDocuments,
  type IAmdpDebuggerResults,
} from './runtime/debugger/AmdpDebugger';
export {
  type IDebuggerListenerConflict,
  readListenerConflict,
} from './runtime/debugger/abap';
// Keep low-level dump types/functions (may be used by consumers)
export {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
} from './runtime/dumps';
export {
  type IRuntimeDumpsResults,
  RuntimeDumps,
  type RuntimeDumpsValues,
  runtimeDumpsDocuments,
} from './runtime/dumps/RuntimeDumps';
export {
  FeedRepository,
  type FeedValues,
  feedDocuments,
  type IFeedResults,
} from './runtime/feeds/FeedRepository';
export {
  GatewayErrorLog,
  type GatewayErrorLogValues,
  gatewayErrorLogDocuments,
  type IGatewayErrorLogResults,
} from './runtime/gatewayErrorLog/GatewayErrorLog';
export {
  type IMemorySnapshotsResults,
  MemorySnapshots,
  type MemorySnapshotsValues,
  memorySnapshotsDocuments,
} from './runtime/memory/MemorySnapshots';

export {
  type ISystemMessagesResults,
  SystemMessages,
  type SystemMessagesValues,
  systemMessagesDocuments,
} from './runtime/systemMessages/SystemMessages';

export {
  CrossTrace,
  type CrossTraceValues,
  crossTraceDocuments,
  type ICrossTraceResultSet,
} from './runtime/traces/CrossTraceDomain';
// Domain objects
export {
  type IProfilerResults,
  Profiler,
  type ProfilerValues,
  profilerDocuments,
} from './runtime/traces/ProfilerDomain';
export {
  type ISt05TraceResults,
  St05Trace,
  type St05TraceValues,
  st05TraceDocuments,
} from './runtime/traces/St05Trace';
