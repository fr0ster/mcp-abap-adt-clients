/**
 * AdtRuntimeClient - Runtime Operations Client
 *
 * Provides access to runtime-related ADT operations:
 * - Memory snapshots analysis
 * - Profiler traces
 * - ABAP debugger operations
 * - Logs analysis
 * - Feed reader operations
 *
 * This is a standalone client for runtime operations, similar to AdtClient.
 * Experimental runtime APIs (for example AMDP debugger) are provided separately
 * in AdtRuntimeClientExperimental.
 *
 * Usage:
 * ```typescript
 * import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtRuntimeClient(connection, logger);
 *
 * // Memory snapshots
 * const snapshots = await client.listMemorySnapshots();
 * const snapshot = await client.getMemorySnapshot('snapshot-id');
 *
 * // Profiler traces
 * const traceFiles = await client.listProfilerTraceFiles();
 * const traceParams = await client.getProfilerTraceParameters();
 *
 * // Debugging
 * await client.launchDebugger({ debuggingMode: 'external' });
 * const callStack = await client.getCallStack();
 *
 * // Logs
 * const appLog = await client.getApplicationLogObject('Z_MY_LOG');
 * const atcLogs = await client.getAtcCheckFailureLogs();
 * ```
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
// Import log functions
import {
  getApplicationLogObject as getApplicationLogObjectUtil,
  getApplicationLogSource as getApplicationLogSourceUtil,
  type IGetApplicationLogObjectOptions,
  type IGetApplicationLogSourceOptions,
  validateApplicationLogName as validateApplicationLogNameUtil,
} from '../runtime/applicationLog/read';
import {
  getCheckFailureLogs as getCheckFailureLogsUtil,
  getExecutionLog as getExecutionLogUtil,
  type IGetCheckFailureLogsOptions,
} from '../runtime/atc/logs';
import {
  getActivationGraph as getActivationGraphUtil,
  type IGetActivationGraphOptions,
} from '../runtime/ddic/activationGraph';
// Import ABAP debugger functions
import {
  buildDebuggerBatchPayload as buildDebuggerBatchPayloadUtil,
  buildDebuggerStepWithStackBatchPayload as buildDebuggerStepWithStackBatchPayloadUtil,
  executeBatchRequest as executeBatchRequestUtil,
  executeDebuggerAction as executeDebuggerActionUtil,
  executeDebuggerStepBatch as executeDebuggerStepBatchUtil,
  getBreakpointConditions as getBreakpointConditionsUtil,
  getBreakpointMessageTypes as getBreakpointMessageTypesUtil,
  getBreakpointStatements as getBreakpointStatementsUtil,
  getCallStack as getCallStackUtil,
  getDebugger as getDebuggerUtil,
  getMemorySizes as getMemorySizesUtil,
  getSystemArea as getSystemAreaUtil,
  getVariableAsCsv as getVariableAsCsvUtil,
  getVariableAsJson as getVariableAsJsonUtil,
  getVariableMaxLength as getVariableMaxLengthUtil,
  getVariableSubcomponents as getVariableSubcomponentsUtil,
  getVariableValueStatement as getVariableValueStatementUtil,
  getVitBreakpoints as getVitBreakpointsUtil,
  getWatchpoints as getWatchpointsUtil,
  type IAbapDebuggerStepMethod,
  type IDebuggerBatchPayload,
  type IGetDebuggerOptions,
  type IGetSystemAreaOptions,
  type IGetVariableAsCsvOptions,
  type IGetVariableAsJsonOptions,
  type IGetVariableValueStatementOptions,
  type ILaunchDebuggerOptions,
  type IStopDebuggerOptions,
  insertWatchpoint as insertWatchpointUtil,
  launchDebugger as launchDebuggerUtil,
  stepContinueDebuggerBatch as stepContinueDebuggerBatchUtil,
  stepIntoDebuggerBatch as stepIntoDebuggerBatchUtil,
  stepOutDebuggerBatch as stepOutDebuggerBatchUtil,
  stopDebugger as stopDebuggerUtil,
  synchronizeBreakpoints as synchronizeBreakpointsUtil,
  validateBreakpoints as validateBreakpointsUtil,
} from '../runtime/debugger/abap';
// Import runtime dumps functions
import {
  buildRuntimeDumpsUserQuery as buildRuntimeDumpsUserQueryUtil,
  getRuntimeDumpById as getRuntimeDumpByIdUtil,
  type IRuntimeDumpsListOptions,
  listRuntimeDumpsByUser as listRuntimeDumpsByUserUtil,
  listRuntimeDumps as listRuntimeDumpsUtil,
} from '../runtime/dumps';
// Import feed functions
import {
  getFeeds as getFeedsUtil,
  getFeedVariants as getFeedVariantsUtil,
} from '../runtime/feeds';
// Import memory snapshot functions
import {
  getSnapshotChildren as getSnapshotChildrenUtil,
  getSnapshotDeltaChildren as getSnapshotDeltaChildrenUtil,
  getSnapshotDeltaOverview as getSnapshotDeltaOverviewUtil,
  getSnapshotDeltaRankingList as getSnapshotDeltaRankingListUtil,
  getSnapshotDeltaReferences as getSnapshotDeltaReferencesUtil,
  getSnapshotOverview as getSnapshotOverviewUtil,
  getSnapshotRankingList as getSnapshotRankingListUtil,
  getSnapshotReferences as getSnapshotReferencesUtil,
  getSnapshot as getSnapshotUtil,
  type ISnapshotChildrenOptions,
  type ISnapshotRankingListOptions,
  type ISnapshotReferencesOptions,
  listSnapshots as listSnapshotsUtil,
} from '../runtime/memory';
// Import cross trace functions
import {
  getCrossTraceActivations as getCrossTraceActivationsUtil,
  getCrossTraceRecordContent as getCrossTraceRecordContentUtil,
  getCrossTraceRecords as getCrossTraceRecordsUtil,
  getCrossTrace as getCrossTraceUtil,
  type IListCrossTracesOptions,
  listCrossTraces as listCrossTracesUtil,
} from '../runtime/traces/crossTrace';
// Import profiler trace functions
import {
  buildTraceParametersXml as buildTraceParametersXmlUtil,
  createTraceParameters as createTraceParametersUtil,
  DEFAULT_PROFILER_TRACE_PARAMETERS,
  extractProfilerIdFromResponse as extractProfilerIdFromResponseUtil,
  getTraceDbAccesses as getTraceDbAccessesUtil,
  getTraceHitList as getTraceHitListUtil,
  getTraceParametersForAmdp as getTraceParametersForAmdpUtil,
  getTraceParametersForCallstack as getTraceParametersForCallstackUtil,
  getTraceParameters as getTraceParametersUtil,
  getTraceRequestsByUri as getTraceRequestsByUriUtil,
  getTraceStatements as getTraceStatementsUtil,
  type IProfilerTraceDbAccessesOptions,
  type IProfilerTraceHitListOptions,
  type IProfilerTraceParameters,
  type IProfilerTraceStatementsOptions,
  listObjectTypes as listObjectTypesUtil,
  listProcessTypes as listProcessTypesUtil,
  listTraceFiles as listTraceFilesUtil,
  listTraceRequests as listTraceRequestsUtil,
} from '../runtime/traces/profiler';
// Import ST05 trace functions
import {
  getSt05TraceDirectory as getSt05TraceDirectoryUtil,
  getSt05TraceState as getSt05TraceStateUtil,
} from '../runtime/traces/st05';

export class AdtRuntimeClient {
  protected connection: IAbapConnection;
  protected logger?: ILogger;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: { enableAcceptCorrection?: boolean },
  ) {
    this.connection = connection;
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    if (options?.enableAcceptCorrection !== undefined) {
      const {
        setAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
        getAcceptCorrectionEnabled,
      } = require('../utils/acceptNegotiation');
      setAcceptCorrectionEnabled(options.enableAcceptCorrection);
      const shouldWrap =
        options.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
      if (shouldWrap) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    } else {
      const {
        getAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
      } = require('../utils/acceptNegotiation');
      if (getAcceptCorrectionEnabled()) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    }
  }

  // ============================================================================
  // Memory Snapshots
  // ============================================================================

  /**
   * List memory snapshots
   *
   * @param user - Optional user filter
   * @param originalUser - Optional original user filter
   * @returns Axios response with list of snapshots
   */
  async listMemorySnapshots(
    user?: string,
    originalUser?: string,
  ): Promise<AxiosResponse> {
    return listSnapshotsUtil(this.connection, user, originalUser);
  }

  /**
   * Get memory snapshot by ID
   *
   * @param snapshotId - Snapshot ID
   * @returns Axios response with snapshot data
   */
  async getMemorySnapshot(snapshotId: string): Promise<AxiosResponse> {
    return getSnapshotUtil(this.connection, snapshotId);
  }

  /**
   * Get memory snapshot ranking list
   *
   * @param snapshotId - Snapshot ID
   * @param options - Optional ranking list options
   * @returns Axios response with ranking list
   */
  async getMemorySnapshotRankingList(
    snapshotId: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotRankingListUtil(this.connection, snapshotId, options);
  }

  /**
   * Get delta ranking list between two memory snapshots
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @param options - Optional ranking list options
   * @returns Axios response with delta ranking list
   */
  async getMemorySnapshotDeltaRankingList(
    uri1: string,
    uri2: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaRankingListUtil(
      this.connection,
      uri1,
      uri2,
      options,
    );
  }

  /**
   * Get memory snapshot children
   *
   * @param snapshotId - Snapshot ID
   * @param parentKey - Parent key
   * @param options - Optional children options
   * @returns Axios response with children data
   */
  async getMemorySnapshotChildren(
    snapshotId: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotChildrenUtil(
      this.connection,
      snapshotId,
      parentKey,
      options,
    );
  }

  /**
   * Get delta children between two memory snapshots
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @param parentKey - Parent key
   * @param options - Optional children options
   * @returns Axios response with delta children
   */
  async getMemorySnapshotDeltaChildren(
    uri1: string,
    uri2: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaChildrenUtil(
      this.connection,
      uri1,
      uri2,
      parentKey,
      options,
    );
  }

  /**
   * Get memory snapshot references
   *
   * @param snapshotId - Snapshot ID
   * @param objectKey - Object key
   * @param options - Optional references options
   * @returns Axios response with references data
   */
  async getMemorySnapshotReferences(
    snapshotId: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotReferencesUtil(
      this.connection,
      snapshotId,
      objectKey,
      options,
    );
  }

  /**
   * Get delta references between two memory snapshots
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @param objectKey - Object key
   * @param options - Optional references options
   * @returns Axios response with delta references
   */
  async getMemorySnapshotDeltaReferences(
    uri1: string,
    uri2: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaReferencesUtil(
      this.connection,
      uri1,
      uri2,
      objectKey,
      options,
    );
  }

  /**
   * Get memory snapshot overview
   *
   * @param snapshotId - Snapshot ID
   * @returns Axios response with snapshot overview
   */
  async getMemorySnapshotOverview(snapshotId: string): Promise<AxiosResponse> {
    return getSnapshotOverviewUtil(this.connection, snapshotId);
  }

  /**
   * Get delta overview between two memory snapshots
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @returns Axios response with delta overview
   */
  async getMemorySnapshotDeltaOverview(
    uri1: string,
    uri2: string,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaOverviewUtil(this.connection, uri1, uri2);
  }

  // ============================================================================
  // Profiler Traces
  // ============================================================================

  /**
   * List ABAP profiler trace files
   *
   * @returns Axios response with list of trace files
   */
  async listProfilerTraceFiles(): Promise<AxiosResponse> {
    return listTraceFilesUtil(this.connection);
  }

  /**
   * Get ABAP profiler trace parameters
   *
   * @returns Axios response with trace parameters
   */
  async getProfilerTraceParameters(): Promise<AxiosResponse> {
    return getTraceParametersUtil(this.connection);
  }

  /**
   * Get trace parameters for callstack aggregation
   *
   * @returns Axios response with callstack aggregation parameters
   */
  async getProfilerTraceParametersForCallstack(): Promise<AxiosResponse> {
    return getTraceParametersForCallstackUtil(this.connection);
  }

  /**
   * Get trace parameters for AMDP trace
   *
   * @returns Axios response with AMDP trace parameters
   */
  async getProfilerTraceParametersForAmdp(): Promise<AxiosResponse> {
    return getTraceParametersForAmdpUtil(this.connection);
  }

  /**
   * Build profiler trace parameters XML payload.
   *
   * @param options - Trace parameters options
   * @returns XML payload used by ADT runtime trace parameters endpoint
   */
  buildProfilerTraceParametersXml(
    options: IProfilerTraceParameters = {},
  ): string {
    return buildTraceParametersXmlUtil(options);
  }

  /**
   * Create profiler trace parameters (returns response with profiler URI in headers).
   *
   * @param options - Trace parameters options
   * @returns Axios response from ADT endpoint
   */
  async createProfilerTraceParameters(
    options: IProfilerTraceParameters = {},
  ): Promise<AxiosResponse> {
    return createTraceParametersUtil(this.connection, options);
  }

  /**
   * Extract profiler URI from createProfilerTraceParameters response headers.
   *
   * @param response - ADT response from createProfilerTraceParameters
   * @returns Profiler URI usable as profilerId query parameter
   */
  extractProfilerIdFromResponse(response: AxiosResponse): string | undefined {
    return extractProfilerIdFromResponseUtil(response);
  }

  /**
   * Return default profiler parameters aligned with Eclipse defaults.
   */
  getDefaultProfilerTraceParameters(): Omit<
    IProfilerTraceParameters,
    'description'
  > {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }

  /**
   * Get profiler trace hitlist for a specific trace.
   *
   * @param traceIdOrUri - Trace ID or full trace URI
   * @param options - Optional filters
   * @returns Axios response with hitlist
   */
  async getProfilerTraceHitList(
    traceIdOrUri: string,
    options: IProfilerTraceHitListOptions = {},
  ): Promise<AxiosResponse> {
    return getTraceHitListUtil(this.connection, traceIdOrUri, options);
  }

  /**
   * Get profiler trace statements for a specific trace.
   *
   * @param traceIdOrUri - Trace ID or full trace URI
   * @param options - Optional statement filters
   * @returns Axios response with statements
   */
  async getProfilerTraceStatements(
    traceIdOrUri: string,
    options: IProfilerTraceStatementsOptions = {},
  ): Promise<AxiosResponse> {
    return getTraceStatementsUtil(this.connection, traceIdOrUri, options);
  }

  /**
   * Get profiler trace DB accesses for a specific trace.
   *
   * @param traceIdOrUri - Trace ID or full trace URI
   * @param options - Optional filters
   * @returns Axios response with DB accesses
   */
  async getProfilerTraceDbAccesses(
    traceIdOrUri: string,
    options: IProfilerTraceDbAccessesOptions = {},
  ): Promise<AxiosResponse> {
    return getTraceDbAccessesUtil(this.connection, traceIdOrUri, options);
  }

  /**
   * List ABAP profiler trace requests
   *
   * @returns Axios response with list of trace requests
   */
  async listProfilerTraceRequests(): Promise<AxiosResponse> {
    return listTraceRequestsUtil(this.connection);
  }

  /**
   * Get trace requests filtered by URI
   *
   * @param uri - Object URI to filter by
   * @returns Axios response with filtered trace requests
   */
  async getProfilerTraceRequestsByUri(uri: string): Promise<AxiosResponse> {
    return getTraceRequestsByUriUtil(this.connection, uri);
  }

  /**
   * List available object types for tracing
   *
   * @returns Axios response with list of object types
   */
  async listProfilerObjectTypes(): Promise<AxiosResponse> {
    return listObjectTypesUtil(this.connection);
  }

  /**
   * List available process types for tracing
   *
   * @returns Axios response with list of process types
   */
  async listProfilerProcessTypes(): Promise<AxiosResponse> {
    return listProcessTypesUtil(this.connection);
  }

  // ============================================================================
  // Cross Trace
  // ============================================================================

  /**
   * List cross traces
   *
   * @param options - Optional filters
   * @returns Axios response with list of traces
   */
  async listCrossTraces(
    options?: IListCrossTracesOptions,
  ): Promise<AxiosResponse> {
    return listCrossTracesUtil(this.connection, options);
  }

  /**
   * Get cross trace details
   *
   * @param traceId - Trace ID
   * @param includeSensitiveData - Whether to include sensitive data
   * @returns Axios response with trace details
   */
  async getCrossTrace(
    traceId: string,
    includeSensitiveData?: boolean,
  ): Promise<AxiosResponse> {
    return getCrossTraceUtil(this.connection, traceId, includeSensitiveData);
  }

  /**
   * Get cross trace records
   *
   * @param traceId - Trace ID
   * @returns Axios response with trace records
   */
  async getCrossTraceRecords(traceId: string): Promise<AxiosResponse> {
    return getCrossTraceRecordsUtil(this.connection, traceId);
  }

  /**
   * Get cross trace record content
   *
   * @param traceId - Trace ID
   * @param recordNumber - Record number
   * @returns Axios response with record content
   */
  async getCrossTraceRecordContent(
    traceId: string,
    recordNumber: number,
  ): Promise<AxiosResponse> {
    return getCrossTraceRecordContentUtil(
      this.connection,
      traceId,
      recordNumber,
    );
  }

  /**
   * Get cross trace activations
   *
   * @returns Axios response with trace activations
   */
  async getCrossTraceActivations(): Promise<AxiosResponse> {
    return getCrossTraceActivationsUtil(this.connection);
  }

  // ============================================================================
  // ABAP Debugger
  // ============================================================================

  /**
   * Launch debugger session
   *
   * @param options - Debugger launch options
   * @returns Axios response with debugger session
   */
  async launchDebugger(
    options?: ILaunchDebuggerOptions,
  ): Promise<AxiosResponse> {
    return launchDebuggerUtil(this.connection, options);
  }

  /**
   * Stop debugger session
   *
   * @param options - Debugger stop options
   * @returns Axios response
   */
  async stopDebugger(options?: IStopDebuggerOptions): Promise<AxiosResponse> {
    return stopDebuggerUtil(this.connection, options);
  }

  /**
   * Get debugger session
   *
   * @param options - Debugger get options
   * @returns Axios response with debugger session
   */
  async getDebugger(options?: IGetDebuggerOptions): Promise<AxiosResponse> {
    return getDebuggerUtil(this.connection, options);
  }

  /**
   * Get memory sizes
   *
   * @param includeAbap - Include ABAP memory (optional)
   * @returns Axios response with memory sizes
   */
  async getDebuggerMemorySizes(includeAbap?: boolean): Promise<AxiosResponse> {
    return getMemorySizesUtil(this.connection, includeAbap);
  }

  /**
   * Get system area
   *
   * @param systemarea - System area name
   * @param options - System area options
   * @returns Axios response with system area data
   */
  async getDebuggerSystemArea(
    systemarea: string,
    options?: IGetSystemAreaOptions,
  ): Promise<AxiosResponse> {
    return getSystemAreaUtil(this.connection, systemarea, options);
  }

  /**
   * Synchronize breakpoints
   *
   * @param checkConflict - Check for conflicts (optional)
   * @returns Axios response with breakpoints
   */
  async synchronizeBreakpoints(
    checkConflict?: boolean,
  ): Promise<AxiosResponse> {
    return synchronizeBreakpointsUtil(this.connection, checkConflict);
  }

  /**
   * Get breakpoint statements
   *
   * @returns Axios response with breakpoint statements
   */
  async getBreakpointStatements(): Promise<AxiosResponse> {
    return getBreakpointStatementsUtil(this.connection);
  }

  /**
   * Get breakpoint message types
   *
   * @returns Axios response with message types
   */
  async getBreakpointMessageTypes(): Promise<AxiosResponse> {
    return getBreakpointMessageTypesUtil(this.connection);
  }

  /**
   * Get breakpoint conditions
   *
   * @returns Axios response with breakpoint conditions
   */
  async getBreakpointConditions(): Promise<AxiosResponse> {
    return getBreakpointConditionsUtil(this.connection);
  }

  /**
   * Validate breakpoints
   *
   * @returns Axios response with validation results
   */
  async validateBreakpoints(): Promise<AxiosResponse> {
    return validateBreakpointsUtil(this.connection);
  }

  /**
   * Get VIT breakpoints
   *
   * @returns Axios response with VIT breakpoints
   */
  async getVitBreakpoints(): Promise<AxiosResponse> {
    return getVitBreakpointsUtil(this.connection);
  }

  /**
   * Get variable max length
   *
   * @param variableName - Variable name
   * @param part - Variable part
   * @param maxLength - Max length (optional)
   * @returns Axios response with max length
   */
  async getVariableMaxLength(
    variableName: string,
    part: string,
    maxLength?: number,
  ): Promise<AxiosResponse> {
    return getVariableMaxLengthUtil(
      this.connection,
      variableName,
      part,
      maxLength,
    );
  }

  /**
   * Get variable subcomponents
   *
   * @param variableName - Variable name
   * @param part - Variable part
   * @param component - Component name (optional)
   * @param line - Line number (optional)
   * @returns Axios response with subcomponents
   */
  async getVariableSubcomponents(
    variableName: string,
    part: string,
    component?: string,
    line?: number,
  ): Promise<AxiosResponse> {
    return getVariableSubcomponentsUtil(
      this.connection,
      variableName,
      part,
      component,
      line,
    );
  }

  /**
   * Get variable as CSV
   *
   * @param variableName - Variable name
   * @param part - Variable part
   * @param options - CSV options
   * @returns Axios response with CSV data
   */
  async getVariableAsCsv(
    variableName: string,
    part: string,
    options?: IGetVariableAsCsvOptions,
  ): Promise<AxiosResponse> {
    return getVariableAsCsvUtil(this.connection, variableName, part, options);
  }

  /**
   * Get variable as JSON
   *
   * @param variableName - Variable name
   * @param part - Variable part
   * @param options - JSON options
   * @returns Axios response with JSON data
   */
  async getVariableAsJson(
    variableName: string,
    part: string,
    options?: IGetVariableAsJsonOptions,
  ): Promise<AxiosResponse> {
    return getVariableAsJsonUtil(this.connection, variableName, part, options);
  }

  /**
   * Get variable value statement
   *
   * @param variableName - Variable name
   * @param part - Variable part
   * @param options - Value statement options
   * @returns Axios response with value statement
   */
  async getVariableValueStatement(
    variableName: string,
    part: string,
    options?: IGetVariableValueStatementOptions,
  ): Promise<AxiosResponse> {
    return getVariableValueStatementUtil(
      this.connection,
      variableName,
      part,
      options,
    );
  }

  /**
   * Execute debugger action
   *
   * @param action - Action name
   * @param value - Action value (optional)
   * @returns Axios response
   */
  async executeDebuggerAction(
    action: string,
    value?: string,
  ): Promise<AxiosResponse> {
    return executeDebuggerActionUtil(this.connection, action, value);
  }

  /**
   * Get call stack
   *
   * @returns Axios response with call stack
   */
  async getCallStack(): Promise<AxiosResponse> {
    return getCallStackUtil(this.connection);
  }

  /**
   * Insert watchpoint
   *
   * @param variableName - Variable name
   * @param condition - Watchpoint condition (optional)
   * @returns Axios response
   */
  async insertWatchpoint(
    variableName: string,
    condition?: string,
  ): Promise<AxiosResponse> {
    return insertWatchpointUtil(this.connection, variableName, condition);
  }

  /**
   * Get watchpoints
   *
   * @returns Axios response with watchpoints
   */
  async getWatchpoints(): Promise<AxiosResponse> {
    return getWatchpointsUtil(this.connection);
  }

  /**
   * Execute batch request
   *
   * @param requests - Batch requests (XML body)
   * @returns Axios response with batch results
   */
  async executeBatchRequest(requests: string): Promise<AxiosResponse> {
    return executeBatchRequestUtil(this.connection, requests);
  }

  /**
   * Build multipart debugger batch payload from raw application/http parts.
   *
   * @param requests - Inner HTTP request parts for debugger batch
   * @returns Boundary and multipart body
   */
  buildDebuggerBatchPayload(requests: string[]): IDebuggerBatchPayload {
    return buildDebuggerBatchPayloadUtil(requests);
  }

  /**
   * Build standard debugger batch payload: step operation + getStack.
   *
   * @param stepMethod - Step method to execute
   * @returns Boundary and multipart body
   */
  buildDebuggerStepWithStackBatchPayload(
    stepMethod: IAbapDebuggerStepMethod,
  ): IDebuggerBatchPayload {
    return buildDebuggerStepWithStackBatchPayloadUtil(stepMethod);
  }

  /**
   * Execute debugger step operation via multipart batch and fetch stack in the same batch.
   *
   * @param stepMethod - Step method to execute
   * @returns Axios response with multipart batch result
   */
  async executeDebuggerStepBatch(
    stepMethod: IAbapDebuggerStepMethod,
  ): Promise<AxiosResponse> {
    return executeDebuggerStepBatchUtil(this.connection, stepMethod);
  }

  /**
   * Execute debugger stepInto via multipart batch with stack fetch.
   *
   * @returns Axios response with multipart batch result
   */
  async stepIntoDebuggerBatch(): Promise<AxiosResponse> {
    return stepIntoDebuggerBatchUtil(this.connection);
  }

  /**
   * Execute debugger stepOut via multipart batch with stack fetch.
   *
   * @returns Axios response with multipart batch result
   */
  async stepOutDebuggerBatch(): Promise<AxiosResponse> {
    return stepOutDebuggerBatchUtil(this.connection);
  }

  /**
   * Execute debugger continue via multipart batch with stack fetch.
   *
   * @returns Axios response with multipart batch result
   */
  async stepContinueDebuggerBatch(): Promise<AxiosResponse> {
    return stepContinueDebuggerBatchUtil(this.connection);
  }

  // ============================================================================
  // Logs
  // ============================================================================

  /**
   * Get application log object properties
   *
   * @param objectName - Application log object name
   * @param options - Optional parameters
   * @returns Axios response with application log object properties
   */
  async getApplicationLogObject(
    objectName: string,
    options?: IGetApplicationLogObjectOptions,
  ): Promise<AxiosResponse> {
    return getApplicationLogObjectUtil(this.connection, objectName, options);
  }

  /**
   * Get application log object source
   *
   * @param objectName - Application log object name
   * @param options - Optional parameters
   * @returns Axios response with application log object source
   */
  async getApplicationLogSource(
    objectName: string,
    options?: IGetApplicationLogSourceOptions,
  ): Promise<AxiosResponse> {
    return getApplicationLogSourceUtil(this.connection, objectName, options);
  }

  /**
   * Validate application log object name
   *
   * @param objectName - Application log object name to validate
   * @returns Axios response with validation result
   */
  async validateApplicationLogName(objectName: string): Promise<AxiosResponse> {
    return validateApplicationLogNameUtil(this.connection, objectName);
  }

  /**
   * Get ATC check failure logs
   *
   * @param options - Optional filters
   * @returns Axios response with check failure logs
   */
  async getAtcCheckFailureLogs(
    options?: IGetCheckFailureLogsOptions,
  ): Promise<AxiosResponse> {
    return getCheckFailureLogsUtil(this.connection, options);
  }

  /**
   * Get ATC execution log
   *
   * @param executionId - Execution ID
   * @returns Axios response with execution log
   */
  async getAtcExecutionLog(executionId: string): Promise<AxiosResponse> {
    return getExecutionLogUtil(this.connection, executionId);
  }

  // ============================================================================
  // DDIC Activation Graph Logs
  // ============================================================================

  /**
   * Get DDIC activation graph with logs
   *
   * @param options - Optional parameters
   * @returns Axios response with activation graph
   */
  async getDdicActivationGraph(
    options?: IGetActivationGraphOptions,
  ): Promise<AxiosResponse> {
    return getActivationGraphUtil(this.connection, options);
  }

  // ============================================================================
  // ST05 Performance Trace
  // ============================================================================

  /**
   * Get ST05 trace state
   *
   * @returns Axios response with trace state
   */
  async getSt05TraceState(): Promise<AxiosResponse> {
    return getSt05TraceStateUtil(this.connection);
  }

  /**
   * Get ST05 trace directory
   *
   * @returns Axios response with trace directory information
   */
  async getSt05TraceDirectory(): Promise<AxiosResponse> {
    return getSt05TraceDirectoryUtil(this.connection);
  }

  // ============================================================================
  // Runtime Dumps (ABAP Short Dump Analysis)
  // ============================================================================

  /**
   * Build ADT runtime dumps query expression for user filtering.
   *
   * @example and( equals( user, CB9980000423 ) )
   */
  buildRuntimeDumpsUserQuery(user?: string): string | undefined {
    return buildRuntimeDumpsUserQueryUtil(user);
  }

  /**
   * List runtime dumps feed.
   */
  async listRuntimeDumps(
    options: IRuntimeDumpsListOptions = {},
  ): Promise<AxiosResponse> {
    return listRuntimeDumpsUtil(this.connection, options);
  }

  /**
   * List runtime dumps filtered by user.
   */
  async listRuntimeDumpsByUser(
    user?: string,
    options: Omit<IRuntimeDumpsListOptions, 'query'> = {},
  ): Promise<AxiosResponse> {
    return listRuntimeDumpsByUserUtil(this.connection, user, options);
  }

  /**
   * Read a specific runtime dump by its dump ID.
   */
  async getRuntimeDumpById(dumpId: string): Promise<AxiosResponse> {
    return getRuntimeDumpByIdUtil(this.connection, dumpId);
  }

  // ============================================================================
  // Feed Reader
  // ============================================================================

  /**
   * Get feeds
   *
   * @returns Axios response with feeds
   */
  async getFeeds(): Promise<AxiosResponse> {
    return getFeedsUtil(this.connection);
  }

  /**
   * Get feed variants
   *
   * @returns Axios response with feed variants
   */
  async getFeedVariants(): Promise<AxiosResponse> {
    return getFeedVariantsUtil(this.connection);
  }
}
