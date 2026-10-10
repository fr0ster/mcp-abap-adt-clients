/**
 * ADT Clients — runtime barrel
 * Covers: AdtRuntimeClient and all runtime/** modules.
 */

export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export {
  ApplicationLog,
  applicationLogDocuments,
  type IApplicationLogResults,
} from './runtime/applicationLog/ApplicationLog';
export {
  AdtAtc,
  atcDocuments,
  type IAtcResults,
} from './runtime/atc/AdtAtc';
export {
  AtcLog,
  atcLogDocuments,
  type IAtcLogResults,
} from './runtime/atc/AtcLog';
export {
  DdicActivation,
  ddicActivationDocuments,
  type IDdicActivationResults,
} from './runtime/ddic/DdicActivation';
// The debuggers and memory snapshots. Each needs sessions of its own — see
// their class docs — so they are constructed on connections the caller opens,
// not handed out by AdtRuntimeClient.
export {
  AbapDebugger,
  abapDebuggerDocuments,
  type IAbapDebuggerOptions,
  type IAbapDebuggerResults,
} from './runtime/debugger/AbapDebugger';
export {
  AmdpDebugger,
  amdpDebuggerDocuments,
  type IAmdpDebuggerResults,
} from './runtime/debugger/AmdpDebugger';
export type { IDebuggerListenerConflict } from './runtime/debugger/abap';
// Keep low-level dump types/functions (may be used by consumers)
export {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
} from './runtime/dumps';
export {
  type IRuntimeDumpsResults,
  RuntimeDumps,
  runtimeDumpsDocuments,
} from './runtime/dumps/RuntimeDumps';
export {
  FeedRepository,
  feedDocuments,
  type IFeedResults,
} from './runtime/feeds/FeedRepository';
export {
  GatewayErrorLog,
  gatewayErrorLogDocuments,
  type IGatewayErrorLogResults,
} from './runtime/gatewayErrorLog/GatewayErrorLog';
export {
  type IMemorySnapshotsResults,
  MemorySnapshots,
  memorySnapshotsDocuments,
} from './runtime/memory/MemorySnapshots';

// The class is still exported for backward compatibility
export {
  type ISystemMessagesResults,
  SystemMessages,
  systemMessagesDocuments,
} from './runtime/systemMessages/SystemMessages';

export {
  CrossTrace,
  crossTraceDocuments,
  type ICrossTraceResultSet,
} from './runtime/traces/CrossTraceDomain';
// Domain objects
export {
  type IProfilerResults,
  Profiler,
  profilerDocuments,
} from './runtime/traces/ProfilerDomain';
export {
  type ISt05TraceResults,
  St05Trace,
  st05TraceDocuments,
} from './runtime/traces/St05Trace';
