/**
 * ADT Clients — runtime barrel
 * Covers: AdtRuntimeClient, AdtRuntimeClientExperimental, and all runtime/** modules.
 */

export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export { AdtRuntimeClientExperimental } from './clients/AdtRuntimeClientExperimental';
export { ApplicationLog } from './runtime/applicationLog/ApplicationLog';
export { AdtAtc } from './runtime/atc/AdtAtc';
export { AtcLog } from './runtime/atc/AtcLog';
export { DdicActivation } from './runtime/ddic/DdicActivation';
export { AbapDebugger } from './runtime/debugger/AbapDebugger';
export { AmdpDebugger } from './runtime/debugger/AmdpDebugger';
export { Debugger } from './runtime/debugger/Debugger';
// Keep low-level dump types/functions (may be used by consumers)
export {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
} from './runtime/dumps';
export { RuntimeDumps } from './runtime/dumps/RuntimeDumps';
export { FeedRepository } from './runtime/feeds/FeedRepository';

export { GatewayErrorLog } from './runtime/gatewayErrorLog/GatewayErrorLog';

// MemorySnapshots is now accessed via getDebugger().getMemorySnapshots()
// The class is still exported for backward compatibility
export { MemorySnapshots } from './runtime/memory/MemorySnapshots';
export { SystemMessages } from './runtime/systemMessages/SystemMessages';

export { CrossTrace } from './runtime/traces/CrossTraceDomain';
// Domain objects
export { Profiler } from './runtime/traces/ProfilerDomain';
export { St05Trace } from './runtime/traces/St05Trace';
/**
 * Public since 15.0.0, because the removal of `latestTraceId()` made it the
 * replacement — and a replacement a consumer cannot import is no replacement.
 * Sorting a trace listing needs it: `recordedAt` compared as text gets the
 * order wrong across UTC offsets, so every caller would otherwise write the
 * same subtle bug by hand.
 */
export { compareRecordedAt } from './runtime/traces/traceParsing';
