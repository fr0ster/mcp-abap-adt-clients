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
  IAdtHeaders,
  IAdtResponse,
  IAmdpBreakpoint,
  IAmdpDebugger,
  IAmdpStepMethod,
  IGetAmdpDataPreviewOptions,
  IResultStrategy,
  IStartAmdpDebuggerOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type {
  AdtHandlerOptions,
  AdtShippedOptions,
} from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import {
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
  wireItself,
} from '../../utils/resultStrategy';
import {
  deleteAmdpDebuggee,
  getAmdpEvents,
  startAmdpDebugger,
  stepAmdpDebuggee,
  stopAmdpDebugger,
  syncAmdpBreakpoints,
} from './amdp';
import { getAmdpDataPreview } from './amdpDataPreview';

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

/** What each slot of the result set answers. */
export type AmdpDebuggerValues = {
  readonly [K in keyof IAmdpDebuggerResults]: unknown;
};

export class AmdpDebugger<
  T extends AmdpDebuggerValues = ResultValuesOf<typeof amdpDebuggerDocuments>,
> implements
    IAmdpDebugger<T['started'], T['events'], T['command'], T['preview']>
{
  readonly kind = 'amdpDebugger' as const;

  private readonly results: ResultStrategiesOf<T>;

  /**
   * An AMDP debugger with the shipped documents, or with the caller's results.
   * No client hands one out, so this is where the shipped documents are the
   * default, as a getter's are.
   */
  static create(
    connection: IAbapConnection,
    options?: AdtShippedOptions<'logger'>,
  ): AmdpDebugger<ResultValuesOf<typeof amdpDebuggerDocuments>>;
  static create<R extends IAmdpDebuggerResults>(
    connection: IAbapConnection,
    options: AdtHandlerOptions<R, 'logger'>,
  ): AmdpDebugger<ResultValuesOf<R>>;
  static create(
    connection: IAbapConnection,
    options: Partial<AdtHandlerOptions<IAmdpDebuggerResults, 'logger'>> = {},
  ): AmdpDebugger<AmdpDebuggerValues> {
    return new AmdpDebugger<AmdpDebuggerValues>(connection, {
      ...options,
      results: options.results ?? amdpDebuggerDocuments,
    });
  }

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtHandlerOptions<ResultStrategiesOf<T>, 'logger'>,
  ) {
    this.results = options.results;
  }

  private reading<K extends keyof T>(key: K): IResultStrategy<T[K]> {
    return this.results[key];
  }

  async start<E extends IAdtError = IAdtError>(
    requestUser: string,
    options?: IStartAmdpDebuggerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['started'], E>> {
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
  ): Promise<IAdtResponse<T['command'], E>> {
    return answering(
      () => syncAmdpBreakpoints(this.connection, mainId, breakpoints),
      this.reading('command'),
      options?.analyse,
    );
  }

  async getEvents<E extends IAdtError = IAdtError>(
    mainId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['events'], E>> {
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
  ): Promise<IAdtResponse<T['command'], E>> {
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
  ): Promise<IAdtResponse<T['command'], E>> {
    return answering(
      () => deleteAmdpDebuggee(this.connection, mainId, debuggeeId),
      this.reading('command'),
      options?.analyse,
    );
  }

  async stop<E extends IAdtError = IAdtError>(
    mainId: string,
    options?: { hardStop?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['command'], E>> {
    return answering(
      () => stopAmdpDebugger(this.connection, mainId, options?.hardStop),
      this.reading('command'),
      options?.analyse,
    );
  }

  async getDataPreview<E extends IAdtError = IAdtError>(
    options: { headers: IAdtHeaders } & IGetAmdpDataPreviewOptions &
      IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['preview'], E>> {
    return answering(
      () => getAmdpDataPreview(this.connection, options.headers, options),
      this.reading('preview'),
      options.analyse,
    );
  }
}
