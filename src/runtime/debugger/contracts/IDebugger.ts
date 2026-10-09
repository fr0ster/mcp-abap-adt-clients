import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { IMemorySnapshots } from './IMemorySnapshots';
import type { IRuntimeAnalysisObject } from './types';

// --- ABAP debugger ---

/**
 * Who is debugging: the four values SAP keys a user-mode listener and the
 * breakpoints armed for it on. `terminalId` and `ideId` are 32 upper-case hex
 * characters, chosen by the caller and kept for the whole session.
 *
 * One listener per SAP user: a second one is refused 409 whatever its
 * terminal id, so two debuggers under the same user cannot both listen.
 */
export interface IDebuggerIdentity {
  requestUser: string;
  terminalId: string;
  ideId: string;
}

interface IBreakpointCommon {
  /** An ABAP condition; the breakpoint stops only where it holds. */
  condition?: string;
}

/**
 * The four kinds of breakpoint. Only a line breakpoint is tied to an object;
 * the others fire wherever the user's code reaches them, framework included.
 * An exception breakpoint stops at the raise when a handler exists up the
 * stack (measured on premise, 2026-10-09).
 */
export type IDebuggerBreakpoint =
  | (IBreakpointCommon & {
      kind: 'line';
      /** The source URI with `#start=<line>`. */
      uri: string;
    })
  | (IBreakpointCommon & { kind: 'exception'; exceptionClass: string })
  | (IBreakpointCommon & { kind: 'statement'; statement: string })
  | (IBreakpointCommon & {
      kind: 'message';
      msgId: string;
      msgNo: string;
      msgTy: string;
    });

/**
 * What a listener does when another one already holds the user's debugging:
 * `refuse` is answered 409 and leaves the other alone; `takeOver` displaces
 * it, and its holder only gets a notice.
 */
export type IDebuggerListenerConflict = 'refuse' | 'takeOver';

export type IDebuggerStepMethod =
  | 'stepInto'
  | 'stepOver'
  | 'stepReturn'
  | 'stepContinue'
  | 'stepRunToLine'
  | 'stepJumpToLine';

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

/**
 * The ABAP debugger, one member per request. The session must be stateful;
 * see `runtime/debugger/abap.ts` for the order the requests take.
 */
export interface IAbapDebugger<
  TBreakpoints = unknown,
  TListener = unknown,
  TAttach = unknown,
  TStack = unknown,
  TVariables = unknown,
  TStep = unknown,
  TDone = unknown,
  TWatchpoints = unknown,
> extends IRuntimeAnalysisObject<'abapDebugger'> {
  setBreakpoints<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    breakpoints: readonly IDebuggerBreakpoint[],
    options?: { validationOnly?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TBreakpoints, E>>;
  deleteBreakpoint<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    breakpointId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TDone, E>>;

  listen<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options: {
      onConflict: IDebuggerListenerConflict;
      holdSeconds?: number;
    } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TListener, E>>;
  stopListener<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TDone, E>>;

  attach<E extends IAdtError = IAdtError>(
    requestUser: string,
    debuggeeId: string,
    options?: { dynproDebugging?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TAttach, E>>;
  getStack<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TStack, E>>;
  getChildVariables<E extends IAdtError = IAdtError>(
    parentIds: readonly string[],
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TVariables, E>>;
  getVariables<E extends IAdtError = IAdtError>(
    variableIds: readonly string[],
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TVariables, E>>;
  step<E extends IAdtError = IAdtError>(
    method: IDebuggerStepMethod,
    options?: { uri?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TStep, E>>;
  setStackPosition<E extends IAdtError = IAdtError>(
    position: number,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TDone, E>>;
  setVariableValue<E extends IAdtError = IAdtError>(
    variableName: string,
    value: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TVariables, E>>;
  terminateDebuggee<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TDone, E>>;

  createWatchpoint<E extends IAdtError = IAdtError>(
    variableName: string,
    options?: { condition?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TWatchpoints, E>>;
  listWatchpoints<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TWatchpoints, E>>;
  deleteWatchpoint<E extends IAdtError = IAdtError>(
    watchpointId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TDone, E>>;
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
