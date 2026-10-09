import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
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

export type IDebuggerStepMethod =
  | 'stepInto'
  | 'stepOver'
  | 'stepReturn'
  | 'stepContinue'
  | 'stepRunToLine'
  | 'stepJumpToLine';

// --- AMDP Debugger option types ---

export interface IStartAmdpDebuggerOptions {
  /** End a debug session the user already has. Eclipse sends `false`. */
  stopExisting?: boolean;
  /** Eclipse sends `NONE`. */
  cascadeMode?: string;
}

/**
 * An AMDP breakpoint: the AMDP class's source URI with `#start=<line>` of a
 * SQLScript statement, and an id of the caller's choosing that the events
 * name it by.
 */
export interface IAmdpBreakpoint {
  uri: string;
  clientId: string;
}

export type IAmdpStepMethod = 'over' | 'continue';

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
    options?: { holdSeconds?: number } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TListener, E>>;
  stopListener<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TDone, E>>;

  attach<E extends IAdtError = IAdtError>(
    requestUser: string,
    debuggeeId: string,
    options?: {
      dynproDebugging?: boolean;
      /** The debuggee's application server (`INSTANCE_NAME` in the listener's answer). */
      server?: string;
    } & IAdtAnalyseOptions<E>,
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

/**
 * The AMDP debugger, one member per request. Two sessions: `start` and
 * `getEvents` on one stateful connection, the commands on another; see
 * `runtime/debugger/amdp.ts`.
 */
export interface IAmdpDebugger<
  TStarted = unknown,
  TEvents = unknown,
  TCommand = unknown,
  TPreview = unknown,
> extends IRuntimeAnalysisObject<'amdpDebugger'> {
  start<E extends IAdtError = IAdtError>(
    requestUser: string,
    options?: IStartAmdpDebuggerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TStarted, E>>;
  syncBreakpoints<E extends IAdtError = IAdtError>(
    mainId: string,
    breakpoints: readonly IAmdpBreakpoint[],
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TCommand, E>>;
  getEvents<E extends IAdtError = IAdtError>(
    mainId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TEvents, E>>;
  step<E extends IAdtError = IAdtError>(
    mainId: string,
    debuggeeId: string,
    step: IAmdpStepMethod,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TCommand, E>>;
  deleteDebuggee<E extends IAdtError = IAdtError>(
    mainId: string,
    debuggeeId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TCommand, E>>;
  stop<E extends IAdtError = IAdtError>(
    mainId: string,
    options?: { hardStop?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TCommand, E>>;
  /** A table variable's rows. Not yet measured. */
  getDataPreview<E extends IAdtError = IAdtError>(
    options?: IGetAmdpDataPreviewOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TPreview, E>>;
  /** Part of one long cell of a table variable. Not yet measured. */
  getCellSubstring<E extends IAdtError = IAdtError>(
    options?: IGetAmdpCellSubstringOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TPreview, E>>;
}
