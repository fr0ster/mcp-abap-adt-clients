/**
 * AdtRuntimeClient - Runtime Operations Client
 *
 * Provides access to runtime-related ADT operations:
 * - Memory snapshots analysis
 * - Profiler traces
 * - Debugger operations
 * - Logs analysis
 * - Feed reader operations
 *
 * This is a standalone client for runtime operations, similar to AdtClient.
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
  executeBatchRequest as executeBatchRequestUtil,
  executeDebuggerAction as executeDebuggerActionUtil,
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
  type IGetDebuggerOptions,
  type IGetSystemAreaOptions,
  type IGetVariableAsCsvOptions,
  type IGetVariableAsJsonOptions,
  type IGetVariableValueStatementOptions,
  type ILaunchDebuggerOptions,
  type IStopDebuggerOptions,
  insertWatchpoint as insertWatchpointUtil,
  launchDebugger as launchDebuggerUtil,
  stopDebugger as stopDebuggerUtil,
  synchronizeBreakpoints as synchronizeBreakpointsUtil,
  validateBreakpoints as validateBreakpointsUtil,
} from '../runtime/debugger/abap';
// Import AMDP debugger functions
import {
  getAmdpBreakpointsLlang as getAmdpBreakpointsLlangUtil,
  getAmdpBreakpointsTableFunctions as getAmdpBreakpointsTableFunctionsUtil,
  getAmdpBreakpoints as getAmdpBreakpointsUtil,
  getAmdpDebuggee as getAmdpDebuggeeUtil,
  getAmdpVariable as getAmdpVariableUtil,
  type IStartAmdpDebuggerOptions,
  lookupAmdp as lookupAmdpUtil,
  resumeAmdpDebugger as resumeAmdpDebuggerUtil,
  setAmdpVariable as setAmdpVariableUtil,
  startAmdpDebugger as startAmdpDebuggerUtil,
  stepContinueAmdp as stepContinueAmdpUtil,
  stepOverAmdp as stepOverAmdpUtil,
  terminateAmdpDebugger as terminateAmdpDebuggerUtil,
} from '../runtime/debugger/amdp';
// Import AMDP data preview functions
import {
  getAmdpCellSubstring as getAmdpCellSubstringUtil,
  getAmdpDataPreview as getAmdpDataPreviewUtil,
  type IGetAmdpCellSubstringOptions,
  type IGetAmdpDataPreviewOptions,
} from '../runtime/debugger/amdpDataPreview';
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
  getTraceParametersForAmdp as getTraceParametersForAmdpUtil,
  getTraceParametersForCallstack as getTraceParametersForCallstackUtil,
  getTraceParameters as getTraceParametersUtil,
  getTraceRequestsByUri as getTraceRequestsByUriUtil,
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
  private connection: IAbapConnection;
  private logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
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

  // ============================================================================
  // AMDP Debugger
  // ============================================================================

  /**
   * Start AMDP debugger session
   *
   * @param options - Debugger start options
   * @returns Axios response with debugger session
   */
  async startAmdpDebugger(
    options?: IStartAmdpDebuggerOptions,
  ): Promise<AxiosResponse> {
    return startAmdpDebuggerUtil(this.connection, options);
  }

  /**
   * Resume AMDP debugger session
   *
   * @param mainId - Main debugger session ID
   * @returns Axios response with debugger session
   */
  async resumeAmdpDebugger(mainId: string): Promise<AxiosResponse> {
    return resumeAmdpDebuggerUtil(this.connection, mainId);
  }

  /**
   * Terminate AMDP debugger session
   *
   * @param mainId - Main debugger session ID
   * @param hardStop - Whether to perform hard stop
   * @returns Axios response
   */
  async terminateAmdpDebugger(
    mainId: string,
    hardStop?: boolean,
  ): Promise<AxiosResponse> {
    return terminateAmdpDebuggerUtil(this.connection, mainId, hardStop);
  }

  /**
   * Get AMDP debuggee information
   *
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @returns Axios response with debuggee information
   */
  async getAmdpDebuggee(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return getAmdpDebuggeeUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Get AMDP variable value
   *
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @param varname - Variable name
   * @param offset - Offset for variable value
   * @param length - Length of variable value to retrieve
   * @returns Axios response with variable value
   */
  async getAmdpVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<AxiosResponse> {
    return getAmdpVariableUtil(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      offset,
      length,
    );
  }

  /**
   * Set AMDP variable value
   *
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @param varname - Variable name
   * @param setNull - Whether to set variable to null
   * @returns Axios response
   */
  async setAmdpVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    setNull?: boolean,
  ): Promise<AxiosResponse> {
    return setAmdpVariableUtil(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      setNull,
    );
  }

  /**
   * Lookup objects/variables in AMDP debugger
   *
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @param name - Name to lookup
   * @returns Axios response with lookup results
   */
  async lookupAmdp(
    mainId: string,
    debuggeeId: string,
    name?: string,
  ): Promise<AxiosResponse> {
    return lookupAmdpUtil(this.connection, mainId, debuggeeId, name);
  }

  /**
   * Step over in AMDP debugger
   *
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @returns Axios response
   */
  async stepOverAmdp(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepOverAmdpUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Continue execution in AMDP debugger
   *
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @returns Axios response
   */
  async stepContinueAmdp(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepContinueAmdpUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Get AMDP breakpoints
   *
   * @param mainId - Main debugger session ID
   * @returns Axios response with breakpoints
   */
  async getAmdpBreakpoints(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsUtil(this.connection, mainId);
  }

  /**
   * Get AMDP breakpoints for LLang
   *
   * @param mainId - Main debugger session ID
   * @returns Axios response with LLang breakpoints
   */
  async getAmdpBreakpointsLlang(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsLlangUtil(this.connection, mainId);
  }

  /**
   * Get AMDP breakpoints for table functions
   *
   * @param mainId - Main debugger session ID
   * @returns Axios response with table function breakpoints
   */
  async getAmdpBreakpointsTableFunctions(
    mainId: string,
  ): Promise<AxiosResponse> {
    return getAmdpBreakpointsTableFunctionsUtil(this.connection, mainId);
  }

  /**
   * Get AMDP debugger data preview
   *
   * @param options - Data preview options
   * @returns Axios response with data preview
   */
  async getAmdpDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<AxiosResponse> {
    return getAmdpDataPreviewUtil(this.connection, options);
  }

  /**
   * Get cell substring from AMDP debugger data preview
   *
   * @param options - Cell substring options
   * @returns Axios response with cell substring
   */
  async getAmdpCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<AxiosResponse> {
    return getAmdpCellSubstringUtil(this.connection, options);
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
