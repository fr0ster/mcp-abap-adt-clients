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
