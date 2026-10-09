/**
 * AbapDebugger - Domain object for the standard ABAP debugger
 *
 * One member per request of the measured sequence in `./abap.ts`; the order,
 * the stateful session and the second session that runs the program are the
 * caller's.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { nothing, rawDocument } from '../../utils/resultStrategy';
import {
  attach,
  createWatchpoint,
  deleteBreakpoint,
  deleteWatchpoint,
  getChildVariables,
  getStack,
  getVariables,
  listen,
  listWatchpoints,
  setBreakpoints,
  setStackPosition,
  setVariableValue,
  step,
  stopListener,
  terminateDebuggee,
} from './abap';
import type {
  IAbapDebugger,
  IDebuggerBreakpoint,
  IDebuggerIdentity,
  IDebuggerStepMethod,
} from './contracts';

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
} satisfies IAbapDebuggerResults;

type Of<
  R extends IAbapDebuggerResults,
  K extends keyof IAbapDebuggerResults,
> = ReturnType<R[K]>;

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
      Of<R, 'watchpoints'>
    >
{
  readonly kind = 'abapDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = abapDebuggerDocuments as unknown as R,
  ) {}

  private reading<K extends keyof IAbapDebuggerResults>(
    key: K,
  ): IResultStrategy<Of<R, K>> {
    return this.results[key] as IResultStrategy<Of<R, K>>;
  }

  async setBreakpoints<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    breakpoints: readonly IDebuggerBreakpoint[],
    options?: { validationOnly?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'breakpoints'>, E>> {
    return answering(
      () =>
        setBreakpoints(
          this.connection,
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

  async listen<E extends IAdtError = IAdtError>(
    identity: IDebuggerIdentity,
    options?: { holdSeconds?: number } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'listener'>, E>> {
    return answering(
      () => listen(this.connection, identity, options?.holdSeconds),
      this.reading('listener'),
      options?.analyse,
    );
  }

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

  async attach<E extends IAdtError = IAdtError>(
    requestUser: string,
    debuggeeId: string,
    options?: { dynproDebugging?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'attach'>, E>> {
    return answering(
      () =>
        attach(
          this.connection,
          requestUser,
          debuggeeId,
          options?.dynproDebugging,
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
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'variables'>, E>> {
    return answering(
      () => getChildVariables(this.connection, parentIds),
      this.reading('variables'),
      options?.analyse,
    );
  }

  async getVariables<E extends IAdtError = IAdtError>(
    variableIds: readonly string[],
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'variables'>, E>> {
    return answering(
      () => getVariables(this.connection, variableIds),
      this.reading('variables'),
      options?.analyse,
    );
  }

  async step<E extends IAdtError = IAdtError>(
    method: IDebuggerStepMethod,
    options?: { uri?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'step'>, E>> {
    return answering(
      () => step(this.connection, method, options?.uri),
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
}
