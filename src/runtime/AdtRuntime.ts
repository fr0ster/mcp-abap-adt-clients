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
}

