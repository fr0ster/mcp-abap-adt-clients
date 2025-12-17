/**
 * AdtRuntime - Runtime Operations Wrapper
 * 
 * Provides access to runtime-related ADT operations:
 * - Memory snapshots analysis
 * - Profiler traces
 * - Debugger operations
 * - Logs analysis
 * - Feed reader operations
 * 
 * Usage:
 * ```typescript
 * const client = new AdtClient(connection, logger);
 * const runtime = client.getRuntime();
 * 
 * // Memory snapshots
 * const snapshots = await runtime.listMemorySnapshots();
 * const snapshot = await runtime.getMemorySnapshot('snapshot-id');
 * 
 * // Profiler traces
 * const traceFiles = await runtime.listProfilerTraceFiles();
 * const traceParams = await runtime.getProfilerTraceParameters();
 * ```
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';

// Import memory snapshot functions
import {
  listSnapshots as listSnapshotsUtil,
  getSnapshot as getSnapshotUtil,
  getSnapshotRankingList as getSnapshotRankingListUtil,
  getSnapshotDeltaRankingList as getSnapshotDeltaRankingListUtil,
  getSnapshotChildren as getSnapshotChildrenUtil,
  getSnapshotDeltaChildren as getSnapshotDeltaChildrenUtil,
  getSnapshotReferences as getSnapshotReferencesUtil,
  getSnapshotDeltaReferences as getSnapshotDeltaReferencesUtil,
  getSnapshotOverview as getSnapshotOverviewUtil,
  getSnapshotDeltaOverview as getSnapshotDeltaOverviewUtil,
  type ISnapshotRankingListOptions,
  type ISnapshotChildrenOptions,
  type ISnapshotReferencesOptions
} from './memory';

// Import profiler trace functions
import {
  listTraceFiles as listTraceFilesUtil,
  getTraceParameters as getTraceParametersUtil,
  getTraceParametersForCallstack as getTraceParametersForCallstackUtil,
  getTraceParametersForAmdp as getTraceParametersForAmdpUtil,
  listTraceRequests as listTraceRequestsUtil,
  getTraceRequestsByUri as getTraceRequestsByUriUtil,
  listObjectTypes as listObjectTypesUtil,
  listProcessTypes as listProcessTypesUtil
} from './traces/profiler';

// Import ABAP debugger functions
import {
  launchDebugger as launchDebuggerUtil,
  stopDebugger as stopDebuggerUtil,
  getDebugger as getDebuggerUtil,
  getMemorySizes as getMemorySizesUtil,
  getSystemArea as getSystemAreaUtil,
  synchronizeBreakpoints as synchronizeBreakpointsUtil,
  getBreakpointStatements as getBreakpointStatementsUtil,
  getBreakpointMessageTypes as getBreakpointMessageTypesUtil,
  getBreakpointConditions as getBreakpointConditionsUtil,
  validateBreakpoints as validateBreakpointsUtil,
  getVitBreakpoints as getVitBreakpointsUtil,
  getVariableMaxLength as getVariableMaxLengthUtil,
  getVariableSubcomponents as getVariableSubcomponentsUtil,
  getVariableAsCsv as getVariableAsCsvUtil,
  getVariableAsJson as getVariableAsJsonUtil,
  getVariableValueStatement as getVariableValueStatementUtil,
  executeDebuggerAction as executeDebuggerActionUtil,
  getCallStack as getCallStackUtil,
  insertWatchpoint as insertWatchpointUtil,
  getWatchpoints as getWatchpointsUtil,
  executeBatchRequest as executeBatchRequestUtil,
  type ILaunchDebuggerOptions,
  type IStopDebuggerOptions,
  type IGetDebuggerOptions,
  type IGetSystemAreaOptions,
  type IGetVariableAsCsvOptions,
  type IGetVariableAsJsonOptions,
  type IGetVariableValueStatementOptions
} from './debugger/abap';

// Import AMDP debugger functions
import {
  startAmdpDebugger as startAmdpDebuggerUtil,
  resumeAmdpDebugger as resumeAmdpDebuggerUtil,
  terminateAmdpDebugger as terminateAmdpDebuggerUtil,
  getAmdpDebuggee as getAmdpDebuggeeUtil,
  getAmdpVariable as getAmdpVariableUtil,
  setAmdpVariable as setAmdpVariableUtil,
  lookupAmdp as lookupAmdpUtil,
  stepOverAmdp as stepOverAmdpUtil,
  stepContinueAmdp as stepContinueAmdpUtil,
  getAmdpBreakpoints as getAmdpBreakpointsUtil,
  getAmdpBreakpointsLlang as getAmdpBreakpointsLlangUtil,
  getAmdpBreakpointsTableFunctions as getAmdpBreakpointsTableFunctionsUtil,
  type IStartAmdpDebuggerOptions
} from './debugger/amdp';

// Import AMDP data preview functions
import {
  getAmdpDataPreview as getAmdpDataPreviewUtil,
  getAmdpCellSubstring as getAmdpCellSubstringUtil,
  type IGetAmdpDataPreviewOptions,
  type IGetAmdpCellSubstringOptions
} from './debugger/amdpDataPreview';

export class AdtRuntime {
  private connection: IAbapConnection;
  private logger: ILogger;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger
  ) {
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
  async listMemorySnapshots(user?: string, originalUser?: string): Promise<AxiosResponse> {
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
    options?: ISnapshotRankingListOptions
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
    options?: ISnapshotRankingListOptions
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaRankingListUtil(this.connection, uri1, uri2, options);
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
    options?: ISnapshotChildrenOptions
  ): Promise<AxiosResponse> {
    return getSnapshotChildrenUtil(this.connection, snapshotId, parentKey, options);
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
    options?: ISnapshotChildrenOptions
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaChildrenUtil(this.connection, uri1, uri2, parentKey, options);
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
    options?: ISnapshotReferencesOptions
  ): Promise<AxiosResponse> {
    return getSnapshotReferencesUtil(this.connection, snapshotId, objectKey, options);
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
    options?: ISnapshotReferencesOptions
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaReferencesUtil(this.connection, uri1, uri2, objectKey, options);
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
  async getMemorySnapshotDeltaOverview(uri1: string, uri2: string): Promise<AxiosResponse> {
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
  // ABAP Debugger
  // ============================================================================

  /**
   * Launch debugger session
   * 
   * @param options - Debugger launch options
   * @returns Axios response with debugger session
   */
  async launchDebugger(options?: ILaunchDebuggerOptions): Promise<AxiosResponse> {
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
  async getDebuggerSystemArea(systemarea: string, options?: IGetSystemAreaOptions): Promise<AxiosResponse> {
    return getSystemAreaUtil(this.connection, systemarea, options);
  }

  /**
   * Synchronize breakpoints
   * 
   * @param checkConflict - Check for conflicts (optional)
   * @returns Axios response with breakpoints
   */
  async synchronizeBreakpoints(checkConflict?: boolean): Promise<AxiosResponse> {
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
  async getVariableMaxLength(variableName: string, part: string, maxLength?: number): Promise<AxiosResponse> {
    return getVariableMaxLengthUtil(this.connection, variableName, part, maxLength);
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
  async getVariableSubcomponents(variableName: string, part: string, component?: string, line?: number): Promise<AxiosResponse> {
    return getVariableSubcomponentsUtil(this.connection, variableName, part, component, line);
  }

  /**
   * Get variable as CSV
   * 
   * @param variableName - Variable name
   * @param part - Variable part
   * @param options - CSV options
   * @returns Axios response with CSV data
   */
  async getVariableAsCsv(variableName: string, part: string, options?: IGetVariableAsCsvOptions): Promise<AxiosResponse> {
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
  async getVariableAsJson(variableName: string, part: string, options?: IGetVariableAsJsonOptions): Promise<AxiosResponse> {
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
  async getVariableValueStatement(variableName: string, part: string, options?: IGetVariableValueStatementOptions): Promise<AxiosResponse> {
    return getVariableValueStatementUtil(this.connection, variableName, part, options);
  }

  /**
   * Execute debugger action
   * 
   * @param action - Action name
   * @param value - Action value (optional)
   * @returns Axios response
   */
  async executeDebuggerAction(action: string, value?: string): Promise<AxiosResponse> {
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
  async insertWatchpoint(variableName: string, condition?: string): Promise<AxiosResponse> {
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
  async startAmdpDebugger(options?: IStartAmdpDebuggerOptions): Promise<AxiosResponse> {
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
  async terminateAmdpDebugger(mainId: string, hardStop?: boolean): Promise<AxiosResponse> {
    return terminateAmdpDebuggerUtil(this.connection, mainId, hardStop);
  }

  /**
   * Get AMDP debuggee information
   * 
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @returns Axios response with debuggee information
   */
  async getAmdpDebuggee(mainId: string, debuggeeId: string): Promise<AxiosResponse> {
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
    length?: number
  ): Promise<AxiosResponse> {
    return getAmdpVariableUtil(this.connection, mainId, debuggeeId, varname, offset, length);
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
    setNull?: boolean
  ): Promise<AxiosResponse> {
    return setAmdpVariableUtil(this.connection, mainId, debuggeeId, varname, setNull);
  }

  /**
   * Lookup objects/variables in AMDP debugger
   * 
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @param name - Name to lookup
   * @returns Axios response with lookup results
   */
  async lookupAmdp(mainId: string, debuggeeId: string, name?: string): Promise<AxiosResponse> {
    return lookupAmdpUtil(this.connection, mainId, debuggeeId, name);
  }

  /**
   * Step over in AMDP debugger
   * 
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @returns Axios response
   */
  async stepOverAmdp(mainId: string, debuggeeId: string): Promise<AxiosResponse> {
    return stepOverAmdpUtil(this.connection, mainId, debuggeeId);
  }

  /**
   * Continue execution in AMDP debugger
   * 
   * @param mainId - Main debugger session ID
   * @param debuggeeId - Debuggee ID
   * @returns Axios response
   */
  async stepContinueAmdp(mainId: string, debuggeeId: string): Promise<AxiosResponse> {
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
  async getAmdpBreakpointsTableFunctions(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsTableFunctionsUtil(this.connection, mainId);
  }

  /**
   * Get AMDP debugger data preview
   * 
   * @param options - Data preview options
   * @returns Axios response with data preview
   */
  async getAmdpDataPreview(options?: IGetAmdpDataPreviewOptions): Promise<AxiosResponse> {
    return getAmdpDataPreviewUtil(this.connection, options);
  }

  /**
   * Get cell substring from AMDP debugger data preview
   * 
   * @param options - Cell substring options
   * @returns Axios response with cell substring
   */
  async getAmdpCellSubstring(options?: IGetAmdpCellSubstringOptions): Promise<AxiosResponse> {
    return getAmdpCellSubstringUtil(this.connection, options);
  }
}

