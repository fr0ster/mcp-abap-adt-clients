/**
 * ADT Clients — runtime barrel
 * Covers: AdtRuntimeClient, AdtRuntimeClientExperimental, and all runtime/** modules.
 */

export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export { AdtRuntimeClientExperimental } from './clients/AdtRuntimeClientExperimental';
export { ApplicationLog } from './runtime/applicationLog/ApplicationLog';
export { AtcLog } from './runtime/atc/AtcLog';
export { DdicActivation } from './runtime/ddic/DdicActivation';
export { AbapDebugger } from './runtime/debugger/AbapDebugger';
export { AmdpDebugger } from './runtime/debugger/AmdpDebugger';
export { Debugger } from './runtime/debugger/Debugger';
// Keep low-level dump types/functions (may be used by consumers)
export {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  type IRuntimeDumpReadOptions,
  type IRuntimeDumpReadView,
  type IRuntimeDumpsListOptions,
} from './runtime/dumps';
export { RuntimeDumps } from './runtime/dumps/RuntimeDumps';
export { FeedRepository } from './runtime/feeds/FeedRepository';
export type {
  IFeedEntry,
  IFeedQueryOptions,
  IFeedRepository,
} from './runtime/feeds/types';
export { GatewayErrorLog } from './runtime/gatewayErrorLog/GatewayErrorLog';
export type {
  ICallStackEntry,
  IGatewayErrorDetail,
  IGatewayErrorEntry,
  IGatewayException,
  ISourceCodeLine,
} from './runtime/gatewayErrorLog/types';
// MemorySnapshots is now accessed via getDebugger().getMemorySnapshots()
// The class is still exported for backward compatibility
export { MemorySnapshots } from './runtime/memory/MemorySnapshots';
export { SystemMessages } from './runtime/systemMessages/SystemMessages';
export type { ISystemMessageEntry } from './runtime/systemMessages/types';
export { CrossTrace } from './runtime/traces/CrossTraceDomain';
// Domain objects
export { Profiler } from './runtime/traces/ProfilerDomain';
export { St05Trace } from './runtime/traces/St05Trace';
export type {
  IListableRuntimeObject,
  IRuntimeAnalysisObject,
} from './runtime/types';
