import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { IMemorySnapshots } from './IMemorySnapshots';
import type { IRuntimeAnalysisObject } from './types';

// --- ABAP Debugger option types ---

export interface ILaunchDebuggerOptions {
  debuggingMode?: string;
  requestUser?: string;
  terminalId?: string;
  ideId?: string;
  timeout?: number;
  checkConflict?: boolean;
  isNotifiedOnConflict?: boolean;
}

export interface IStopDebuggerOptions {
  debuggingMode?: string;
  requestUser?: string;
  terminalId?: string;
  ideId?: string;
  checkConflict?: boolean;
  notifyConflict?: boolean;
}

export interface IGetDebuggerOptions {
  debuggingMode?: string;
  requestUser?: string;
  terminalId?: string;
  ideId?: string;
  checkConflict?: boolean;
}

export interface IGetSystemAreaOptions {
  offset?: number;
  length?: number;
  element?: string;
  isSelection?: boolean;
  selectedLine?: number;
  selectedColumn?: number;
  programContext?: string;
  filter?: string;
}

export interface IGetVariableAsCsvOptions {
  offset?: number;
  length?: number;
  filter?: string;
  sortComponent?: string;
  sortDirection?: string;
  whereClause?: string;
  c?: string;
}

export interface IGetVariableAsJsonOptions {
  offset?: number;
  length?: number;
  filter?: string;
  sortComponent?: string;
  sortDirection?: string;
  whereClause?: string;
  c?: string;
}

export interface IGetVariableValueStatementOptions {
  rows?: number;
  maxStringLength?: number;
  maxNestingLevel?: number;
  maxTotalSize?: number;
  ignoreInitialValues?: boolean;
  c?: string;
  lineBreakThreshold?: number;
}

export type IAbapDebuggerStepMethod = 'stepInto' | 'stepOut' | 'stepContinue';

// --- AMDP Debugger option types ---

export interface IStartAmdpDebuggerOptions {
  stopExisting?: boolean;
  requestUser?: string;
  cascadeMode?: string;
}

export interface IGetAmdpDataPreviewOptions {
  rowNumber?: number;
  colNumber?: number;
  sessionId?: string;
  debuggerId?: string;
  debuggeeId?: string;
  variableName?: string;
  schema?: string;
  provideRowId?: boolean;
  action?: string;
}

export interface IGetAmdpCellSubstringOptions {
  rowNumber?: number;
  columnName?: string;
  sessionId?: string;
  debuggerId?: string;
  debuggeeId?: string;
  variableName?: string;
  valueOffset?: number;
  valueLength?: number;
  schema?: string;
  action?: string;
}

// --- Interfaces ---

export interface IDebugger extends IRuntimeAnalysisObject<'debugger'> {
  getAbap(): IAbapDebugger;
  getAmdp(): IAmdpDebugger;
  getMemorySnapshots(): IMemorySnapshots;
}

export interface IAbapDebugger extends IRuntimeAnalysisObject<'abapDebugger'> {
  // Session management
  launch(options?: ILaunchDebuggerOptions): Promise<IAdtWireResponse>;
  stop(options?: IStopDebuggerOptions): Promise<IAdtWireResponse>;
  get(options?: IGetDebuggerOptions): Promise<IAdtWireResponse>;
  getMemorySizes(includeAbap?: boolean): Promise<IAdtWireResponse>;
  getSystemArea(
    systemarea: string,
    options?: IGetSystemAreaOptions,
  ): Promise<IAdtWireResponse>;

  // Breakpoints
  synchronizeBreakpoints(checkConflict?: boolean): Promise<IAdtWireResponse>;
  getBreakpointStatements(): Promise<IAdtWireResponse>;
  getBreakpointMessageTypes(): Promise<IAdtWireResponse>;
  getBreakpointConditions(): Promise<IAdtWireResponse>;
  validateBreakpoints(): Promise<IAdtWireResponse>;
  getVitBreakpoints(): Promise<IAdtWireResponse>;

  // Variables
  getVariableMaxLength(
    variableName: string,
    part: string,
    maxLength?: number,
  ): Promise<IAdtWireResponse>;
  getVariableSubcomponents(
    variableName: string,
    part: string,
    component?: string,
    line?: number,
  ): Promise<IAdtWireResponse>;
  getVariableAsCsv(
    variableName: string,
    part: string,
    options?: IGetVariableAsCsvOptions,
  ): Promise<IAdtWireResponse>;
  getVariableAsJson(
    variableName: string,
    part: string,
    options?: IGetVariableAsJsonOptions,
  ): Promise<IAdtWireResponse>;
  getVariableValueStatement(
    variableName: string,
    part: string,
    options?: IGetVariableValueStatementOptions,
  ): Promise<IAdtWireResponse>;

  // Actions & stack
  executeAction(action: string, value?: string): Promise<IAdtWireResponse>;
  getCallStack(): Promise<IAdtWireResponse>;

  // Watchpoints
  insertWatchpoint(
    variableName: string,
    condition?: string,
  ): Promise<IAdtWireResponse>;
  getWatchpoints(): Promise<IAdtWireResponse>;

  // Batch operations
  executeBatchRequest(requests: string): Promise<IAdtWireResponse>;
  executeStepBatch(
    stepMethod: IAbapDebuggerStepMethod,
  ): Promise<IAdtWireResponse>;
  stepIntoBatch(): Promise<IAdtWireResponse>;
  stepOutBatch(): Promise<IAdtWireResponse>;
  stepContinueBatch(): Promise<IAdtWireResponse>;
}

export interface IAmdpDebugger extends IRuntimeAnalysisObject<'amdpDebugger'> {
  start(options?: IStartAmdpDebuggerOptions): Promise<IAdtWireResponse>;
  resume(mainId: string): Promise<IAdtWireResponse>;
  terminate(mainId: string, hardStop?: boolean): Promise<IAdtWireResponse>;
  getDebuggee(mainId: string, debuggeeId: string): Promise<IAdtWireResponse>;
  getVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<IAdtWireResponse>;
  setVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    setNull?: boolean,
  ): Promise<IAdtWireResponse>;
  lookup(
    mainId: string,
    debuggeeId: string,
    name?: string,
  ): Promise<IAdtWireResponse>;
  stepOver(mainId: string, debuggeeId: string): Promise<IAdtWireResponse>;
  stepContinue(mainId: string, debuggeeId: string): Promise<IAdtWireResponse>;
  getBreakpoints(mainId: string): Promise<IAdtWireResponse>;
  getBreakpointsLlang(mainId: string): Promise<IAdtWireResponse>;
  getBreakpointsTableFunctions(mainId: string): Promise<IAdtWireResponse>;
  getDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<IAdtWireResponse>;
  getCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<IAdtWireResponse>;
}
