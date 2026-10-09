/**
 * Configuring a measurement — the executors' half of the trace story.
 *
 * One implementation, delegated to by both executors. It is a class rather than
 * a base class because `ClassExecutor` and `ProgramExecutor` already extend
 * nothing and share no hierarchy; making one for this would be inventing a
 * relationship between a class run and a report run that does not exist.
 *
 * The vocabulary is deliberately kept apart from the reading side: this yields
 * a **request id**, the profiler takes a **trace id**, and the two were easy to
 * confuse while one type carried both.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IProfilerTraceParameters,
  IResultStrategy,
  ITraceScheduling,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  createTraceParameters,
  getTraceRequestsByUri,
  listObjectTypes,
  listProcessTypes,
  listTraceRequests,
} from '../runtime/traces/profiler';
import { answering } from '../utils/adtResponse';
import { rawDocument } from '../utils/resultStrategy';

/** One strategy per distinct answer of trace scheduling. */
export interface ITraceSchedulingResults {
  /**
   * A trace catalogue — `listObjectTypes` and `listProcessTypes`, both a
   * `nameditem:namedItemList`. `traceSchedulingTypes` reads it.
   */
  readonly types: IResultStrategy<unknown>;
  /**
   * The schedule — `listRequests` and `getRequestsByUri`, an Atom feed.
   * `traceSchedulingRequests` reads it.
   */
  readonly requests: IResultStrategy<unknown>;
  /**
   * What `scheduleTrace` was answered with. The request id is in `Location`
   * and nowhere else, so `rawDocument` — which reads the body — answers `''`;
   * a caller who wants the id passes `traceSchedulingProfilerId`.
   */
  readonly scheduled: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const traceSchedulingDocuments = {
  types: rawDocument,
  requests: rawDocument,
  scheduled: rawDocument,
} satisfies ITraceSchedulingResults;

export class TraceScheduling<
  R extends ITraceSchedulingResults = typeof traceSchedulingDocuments,
> implements
    ITraceScheduling<
      ReturnType<R['types']>,
      ReturnType<R['requests']>,
      ReturnType<R['scheduled']>
    >
{
  constructor(
    private readonly connection: IAbapConnection,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = traceSchedulingDocuments as unknown as R,
  ) {}

  async listObjectTypes<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return answering(
      () => listObjectTypes(this.connection),
      this.results.types as IResultStrategy<ReturnType<R['types']>>,
      options?.analyse,
    );
  }

  async listProcessTypes<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return answering(
      () => listProcessTypes(this.connection),
      this.results.types as IResultStrategy<ReturnType<R['types']>>,
      options?.analyse,
    );
  }

  /**
   * What is queued.
   *
   * An empty answer means nothing is scheduled — the runs that fulfil requests
   * consume them — not that the endpoint is dead.
   */
  async listRequests<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['requests']>, E>> {
    return answering(
      () => listTraceRequests(this.connection),
      this.results.requests as IResultStrategy<ReturnType<R['requests']>>,
      options?.analyse,
    );
  }

  async getRequestsByUri<E extends IAdtError = IAdtError>(
    uri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['requests']>, E>> {
    return answering(
      () => getTraceRequestsByUri(this.connection, uri),
      this.results.requests as IResultStrategy<ReturnType<R['requests']>>,
      options?.analyse,
    );
  }

  /**
   * Configure a measurement.
   *
   * The request id comes back in the response's `Location`, which is the only
   * place it appears: reading the created resource back answers `200` with an
   * **empty body**, measured. So a caller that loses the id cannot recover it
   * from the resource — read it with `traceSchedulingProfilerId`, and judge a
   * missing one with `analyse`.
   */
  async scheduleTrace<E extends IAdtError = IAdtError>(
    options?: IProfilerTraceParameters & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['scheduled']>, E>> {
    return answering(
      () => createTraceParameters(this.connection, options),
      this.results.scheduled as IResultStrategy<ReturnType<R['scheduled']>>,
      options?.analyse,
    );
  }
}
