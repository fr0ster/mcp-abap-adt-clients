/**
 * AmdpDebugger - Domain object for the AMDP debugger
 *
 * One member per request of the measured protocol in `./amdp.ts`. The two
 * sessions — `start` and `getEvents` on one stateful connection, the commands
 * on another — are the caller's: a consumer constructs one AmdpDebugger per
 * connection.
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
import { rawDocument, wireItself } from '../../utils/resultStrategy';
import {
  deleteAmdpDebuggee,
  getAmdpEvents,
  startAmdpDebugger,
  stepAmdpDebuggee,
  stopAmdpDebugger,
  syncAmdpBreakpoints,
} from './amdp';
import { getAmdpCellSubstring, getAmdpDataPreview } from './amdpDataPreview';
import type {
  IAmdpBreakpoint,
  IAmdpDebugger,
  IAmdpStepMethod,
  IGetAmdpCellSubstringOptions,
  IGetAmdpDataPreviewOptions,
  IStartAmdpDebuggerOptions,
} from './contracts';

/** One strategy per kind of answer the AMDP debugger gives. */
export interface IAmdpDebuggerResults {
  /** The start: `Location` names the session, the body the database session. */
  readonly started: IResultStrategy<unknown>;
  /** The events document. */
  readonly events: IResultStrategy<unknown>;
  /** A command's answer: `Location` carries its request id, the body is empty. */
  readonly command: IResultStrategy<unknown>;
  readonly preview: IResultStrategy<unknown>;
}

/**
 * The shipped default: the start and the commands answered whole — what
 * they say is in a header — and the documents as they arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const amdpDebuggerDocuments = {
  started: wireItself,
  events: rawDocument,
  command: wireItself,
  preview: rawDocument,
} satisfies IAmdpDebuggerResults;

type Of<
  R extends IAmdpDebuggerResults,
  K extends keyof IAmdpDebuggerResults,
> = ReturnType<R[K]>;

export class AmdpDebugger<
  R extends IAmdpDebuggerResults = typeof amdpDebuggerDocuments,
> implements
    IAmdpDebugger<
      Of<R, 'started'>,
      Of<R, 'events'>,
      Of<R, 'command'>,
      Of<R, 'preview'>
    >
{
  readonly kind = 'amdpDebugger' as const;

  constructor(
    private readonly connection: IAbapConnection,
    _logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = amdpDebuggerDocuments as unknown as R,
  ) {}

  private reading<K extends keyof IAmdpDebuggerResults>(
    key: K,
  ): IResultStrategy<Of<R, K>> {
    return this.results[key] as IResultStrategy<Of<R, K>>;
  }

  async start<E extends IAdtError = IAdtError>(
    requestUser: string,
    options?: IStartAmdpDebuggerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'started'>, E>> {
    return answering(
      () => startAmdpDebugger(this.connection, requestUser, options),
      this.reading('started'),
      options?.analyse,
    );
  }

  async syncBreakpoints<E extends IAdtError = IAdtError>(
    mainId: string,
    breakpoints: readonly IAmdpBreakpoint[],
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'command'>, E>> {
    return answering(
      () => syncAmdpBreakpoints(this.connection, mainId, breakpoints),
      this.reading('command'),
      options?.analyse,
    );
  }

  async getEvents<E extends IAdtError = IAdtError>(
    mainId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'events'>, E>> {
    return answering(
      () => getAmdpEvents(this.connection, mainId),
      this.reading('events'),
      options?.analyse,
    );
  }

  async step<E extends IAdtError = IAdtError>(
    mainId: string,
    debuggeeId: string,
    step: IAmdpStepMethod,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'command'>, E>> {
    return answering(
      () => stepAmdpDebuggee(this.connection, mainId, debuggeeId, step),
      this.reading('command'),
      options?.analyse,
    );
  }

  async deleteDebuggee<E extends IAdtError = IAdtError>(
    mainId: string,
    debuggeeId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'command'>, E>> {
    return answering(
      () => deleteAmdpDebuggee(this.connection, mainId, debuggeeId),
      this.reading('command'),
      options?.analyse,
    );
  }

  async stop<E extends IAdtError = IAdtError>(
    mainId: string,
    options?: { hardStop?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'command'>, E>> {
    return answering(
      () => stopAmdpDebugger(this.connection, mainId, options?.hardStop),
      this.reading('command'),
      options?.analyse,
    );
  }

  async getDataPreview<E extends IAdtError = IAdtError>(
    options?: IGetAmdpDataPreviewOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'preview'>, E>> {
    return answering(
      () => getAmdpDataPreview(this.connection, options),
      this.reading('preview'),
      options?.analyse,
    );
  }

  async getCellSubstring<E extends IAdtError = IAdtError>(
    options?: IGetAmdpCellSubstringOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'preview'>, E>> {
    return answering(
      () => getAmdpCellSubstring(this.connection, options),
      this.reading('preview'),
      options?.analyse,
    );
  }
}
