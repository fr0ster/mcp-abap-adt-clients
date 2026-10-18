/**
 * AbapDebugger - Domain object for the standard ABAP debugger
 *
 * One member per request of the measured sequence in `./abap.ts`; the order,
 * the stateful session and the second session that runs the program are the
 * caller's.
 */

import type {
  IAbapDebugger,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IDebuggerBreakpoint,
  IDebuggerBreakpointSync,
  IDebuggerIdentity,
  IDebuggerSettings,
  IDebuggerStepMethod,
  IDebuggerStepToLineMethod,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { nothing, rawDocument } from '../../utils/resultStrategy';
import {
  attach,
  checkListener,
  createMemorySnapshot,
  createWatchpoint,
  deleteBreakpoint,
  deleteWatchpoint,
  detachDebugger,
  getChildVariables,
  getMemorySizes,
  getStack,
  getVariables,
  type IDebuggerListenerConflict,
  listen,
  listWatchpoints,
  setBreakpoints,
  setDebuggerSettings,
  setStackPosition,
  setVariableValue,
  step,
  stepToLine,
  stopListener,
  syncBreakpoints,
  terminateDebuggee,
  terminateDebugger,
} from './abap';

/** One strategy per kind of answer the debugger gives. */
export interface IAbapDebuggerResults {
  readonly breakpoints: IResultStrategy<unknown>;
  readonly listener: IResultStrategy<unknown>;
  readonly attach: IResultStrategy<unknown>;
  readonly stack: IResultStrategy<unknown>;
  readonly variables: IResultStrategy<unknown>;
  readonly step: IResultStrategy<unknown>;
  /** Answers with nothing to read: deletes, the cursor move, termination. */
  readonly done: IResultStrategy<unknown>;
  readonly watchpoints: IResultStrategy<unknown>;
  /** The memory sizes and the snapshot's confirmation. */
  readonly memory: IResultStrategy<unknown>;
  /** The debugger settings' confirmation. */
  readonly settings: IResultStrategy<unknown>;
}

/**
 * The shipped default: every document as it arrived, and nothing where the
 * answer carries nothing.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const abapDebuggerDocuments = {
  breakpoints: rawDocument,
  listener: rawDocument,
  attach: rawDocument,
  stack: rawDocument,
  variables: rawDocument,
  step: rawDocument,
  done: nothing,
  watchpoints: rawDocument,
  memory: rawDocument,
  settings: rawDocument,
} satisfies IAbapDebuggerResults;

/** How this implementation behaves, fixed when it is constructed. */
export interface IAbapDebuggerOptions {
  /**
   * When another listener already holds the user's debugging — an Eclipse,
   * another agent: `refuse` (the default) is answered 409 and leaves it
   * alone, `takeOver` displaces it. A consumer wanting both constructs two
   * debuggers.
   */
  readonly onConflict?: IDebuggerListenerConflict;
}

type Of<
  R extends IAbapDebuggerResults,
  K extends keyof IAbapDebuggerResults,
> = ReturnType<R[K]>;

/**
 * The ABAP debugger on one connection, with the settings it was constructed
 * with (`onConflict`).
 *
 * **One debug session per identity.** The server binds the listener context -
 * request user and IDE id - to the ABAP session the connection carries (see
 * `listen` in `abap.ts`), so one debugger serves one identity. Another
 * identity - another request user, another mode, another `ideId` - needs
 * another debug session: a new `AbapDebugger` on a connection of its own,
 * with its own settings. The library does not guard this; a call naming an
 * identity other than the one the session was bound to is answered by the
 * server as it is.
 */
export class AbapDebugger<
  R extends IAbapDebuggerResults = typeof abapDebuggerDocuments,
> implements
    IAbapDebugger<
      Of<R, 'breakpoints'>,
      Of<R, 'listener'>,
      Of<R, 'attach'>,
      Of<R, 'stack'>,
      Of<R, 'variables'>,
      Of<R, 'step'>,
      Of<R, 'done'>,
      Of<R, 'watchpoints'>,
      Of<R, 'memory'>,
      Of<R, 'settings'>
    >
{
  readonly kind = 'abapDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    _logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = abapDebuggerDocuments as unknown as R,
    private readonly options: IAbapDebuggerOptions = {},
  ) {}

  private reading<K extends keyof IAbapDebuggerResults>(
    key: K,
  ): IResultStrategy<Of<R, K>> {
    return this.results[key] as IResultStrategy<Of<R, K>>;
  }

  /**
   * Arm breakpoints under the identity's key, replacing what the key held -
   * a `validationOnly` request too (see `setBreakpoints` in `abap.ts`).
   *
   * `clientId` on a breakpoint tags it; the server echoes it on every answer
   * row, placed and refused, in an order of its own (see `setBreakpoints` in
   * `abap.ts`).
   */
  async setBreakpoints<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    breakpoints: readonly IDebuggerBreakpoint[],
    options: { headers: IAdtHeaders } & {
      validationOnly?: boolean;
    } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'breakpoints'>, E>> {
    return answering(
      () =>
        setBreakpoints(
          this.connection,
          options.headers,
          identity,
          breakpoints,
          options?.validationOnly,
        ),
      this.reading('breakpoints'),
      options?.analyse,
    );
  }

  async deleteBreakpoint<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    breakpointId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => deleteBreakpoint(this.connection, identity, breakpointId),
      this.reading('done'),
      options?.analyse,
    );
  }

  /**
   * Start a listener for the identity, with the conflict behaviour this
   * debugger was constructed with (`onConflict`).
   *
   * The listener belongs to the identity's debug session: a listener for
   * another identity needs a new `AbapDebugger` on a connection of its own
   * (see the class and `listen` in `abap.ts`).
   */
  async listen<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options?: { holdSeconds?: number } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'listener'>, E>> {
    return answering(
      () =>
        listen(
          this.connection,
          identity,
          this.options.onConflict ?? 'refuse',
          options?.holdSeconds,
        ),
      this.reading('listener'),
      options?.analyse,
    );
  }

  /**
   * Release the listener - and delete the key's breakpoints with it, whether
   * or not a listener was running (see `stopListener` in `abap.ts`). Stop the
   * listener last, or arm again before the next listen. It acts for the
   * identity's debug session; another identity needs a debugger of its own.
   */
  async stopListener<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => stopListener(this.connection, identity),
      this.reading('done'),
      options?.analyse,
    );
  }

  /**
   * Attach to the debuggee a listener caught. The attach, and everything after
   * it, goes on a debugger with a connection opened for this debuggee, never
   * the listener's (see `attach` in `abap.ts`); the identity is the one the
   * session was bound to - another identity needs a debugger of its own.
   */
  async attach<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    debuggeeId: string,
    options?: {
      dynproDebugging?: boolean;
      /** The debuggee's application server (`INSTANCE_NAME` in the listener's answer). */
      server?: string;
    } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'attach'>, E>> {
    return answering(
      () =>
        attach(
          this.connection,
          identity,
          debuggeeId,
          options?.dynproDebugging,
          options?.server,
        ),
      this.reading('attach'),
      options?.analyse,
    );
  }

  async getStack<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'stack'>, E>> {
    return answering(
      () => getStack(this.connection),
      this.reading('stack'),
      options?.analyse,
    );
  }

  async getChildVariables<E extends IAdtError = IAdtError>(
    parentIds: readonly string[],
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'variables'>, E>> {
    return answering(
      () => getChildVariables(this.connection, options.headers, parentIds),
      this.reading('variables'),
      options?.analyse,
    );
  }

  async getVariables<E extends IAdtError = IAdtError>(
    variableIds: readonly string[],
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'variables'>, E>> {
    return answering(
      () => getVariables(this.connection, options.headers, variableIds),
      this.reading('variables'),
      options?.analyse,
    );
  }

  async step<E extends IAdtError = IAdtError>(
    method: IDebuggerStepMethod,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'step'>, E>> {
    return answering(
      () => step(this.connection, method),
      this.reading('step'),
      options?.analyse,
    );
  }

  async stepToLine<E extends IAdtError = IAdtError>(
    method: IDebuggerStepToLineMethod,
    uri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'step'>, E>> {
    return answering(
      () => stepToLine(this.connection, method, uri),
      this.reading('step'),
      options?.analyse,
    );
  }

  async setStackPosition<E extends IAdtError = IAdtError>(
    position: number,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => setStackPosition(this.connection, position),
      this.reading('done'),
      options?.analyse,
    );
  }

  async setVariableValue<E extends IAdtError = IAdtError>(
    variableName: string,
    value: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'variables'>, E>> {
    return answering(
      () => setVariableValue(this.connection, variableName, value),
      this.reading('variables'),
      options?.analyse,
    );
  }

  async terminateDebuggee<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => terminateDebuggee(this.connection),
      this.reading('done'),
      options?.analyse,
    );
  }

  async createWatchpoint<E extends IAdtError = IAdtError>(
    variableName: string,
    options?: { condition?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'watchpoints'>, E>> {
    return answering(
      () => createWatchpoint(this.connection, variableName, options?.condition),
      this.reading('watchpoints'),
      options?.analyse,
    );
  }

  async listWatchpoints<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'watchpoints'>, E>> {
    return answering(
      () => listWatchpoints(this.connection),
      this.reading('watchpoints'),
      options?.analyse,
    );
  }

  async deleteWatchpoint<E extends IAdtError = IAdtError>(
    watchpointId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => deleteWatchpoint(this.connection, watchpointId),
      this.reading('done'),
      options?.analyse,
    );
  }

  async getMemorySizes<E extends IAdtError = IAdtError>(
    options?: { includeAbap?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'memory'>, E>> {
    return answering(
      () => getMemorySizes(this.connection, options?.includeAbap),
      this.reading('memory'),
      options?.analyse,
    );
  }

  async createMemorySnapshot<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'memory'>, E>> {
    return answering(
      () => createMemorySnapshot(this.connection),
      this.reading('memory'),
      options?.analyse,
    );
  }

  /**
   * Replace the key's breakpoints, `full` or by object with `partial` (see
   * `syncBreakpoints` in `abap.ts`).
   *
   * `clientId` on a breakpoint tags it; the server echoes it on every answer
   * row, placed and refused, in an order of its own (see `setBreakpoints` in
   * `abap.ts`).
   */
  async syncBreakpoints<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    sync: IDebuggerBreakpointSync,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'breakpoints'>, E>> {
    return answering(
      () => syncBreakpoints(this.connection, options.headers, identity, sync),
      this.reading('breakpoints'),
      options?.analyse,
    );
  }

  /**
   * Ask whether a listener for the identity would conflict; starts nothing.
   * The answer is read in the identity's debug session: for another identity,
   * use a debugger on a connection of its own (see the class).
   */
  async checkListener<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => checkListener(this.connection, identity),
      this.reading('done'),
      options?.analyse,
    );
  }

  async detachDebugger<E extends IAdtError = IAdtError>(
    options?: { debuggeeId?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => detachDebugger(this.connection, options?.debuggeeId),
      this.reading('done'),
      options?.analyse,
    );
  }

  /**
   * Free the debugger; the program runs on. SAP answers it with a plain ICF
   * `500` (no ADT exception document) when it worked: pass
   * `analyseDebuggerFreed` from `@mcp-abap-adt/adt-strategies` (0.9.0) to take
   * that `500` as no failure, or `analyseException` to let it stop you. See
   * the errata entry "The debugger freeing its session is answered as an ICF
   * 500" and `terminateDebugger` in `abap.ts`.
   */
  async terminateDebugger<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'done'>, E>> {
    return answering(
      () => terminateDebugger(this.connection),
      this.reading('done'),
      options?.analyse,
    );
  }

  async setDebuggerSettings<E extends IAdtError = IAdtError>(
    settings: IDebuggerSettings,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'settings'>, E>> {
    return answering(
      () => setDebuggerSettings(this.connection, options.headers, settings),
      this.reading('settings'),
      options?.analyse,
    );
  }
}
