import type {
  AdtVariant,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IAdtRunnable,
  IProfilerTraceParameters,
  IProgramExecuteOptions,
  IProgramExecuteWithProfilerOptions,
  IProgramExecutionTarget,
  IResultStrategy,
  IRunnableWithProfiler,
  ITraceScheduling,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { runProgram } from '../../core/program/run';
import type { AdtHandlerOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import {
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
} from '../../utils/resultStrategy';
import {
  type ITraceSchedulingResults,
  TraceScheduling,
  traceSchedulingDocuments,
} from '../traceScheduling';

/**
 * One strategy per distinct answer of a program executor: the run's output, and
 * the trace-scheduling answers it composes in.
 */
export interface IProgramExecutorResults extends ITraceSchedulingResults {
  /** What a run answered — `run` and `runWithProfiler`, the same document. */
  readonly run: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const programExecutorDocuments = {
  ...traceSchedulingDocuments,
  run: rawDocument,
} satisfies IProgramExecutorResults;

/** What each slot of the result set answers. */
export type ProgramExecutorValues = {
  readonly [K in keyof IProgramExecutorResults]: unknown;
};

/**
 * **Not `IProgramExecutor` since 19.0.0.** That composite includes
 * `IRunnableWithProfiling`, whose `runWithProfiling` scheduled a trace, ran the
 * program under it, and answered both — three requests in one member, with the
 * order fixed here. The three atoms below are what this class offers; a caller
 * who wants the old member writes `scheduleTrace`, then `runWithProfiler` with
 * the id it answered. The composite stays in the contract for an implementation
 * that joins them.
 */
export class ProgramExecutor<
  T extends ProgramExecutorValues = ResultValuesOf<
    typeof programExecutorDocuments
  >,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtRunnable<IProgramExecutionTarget, T['run']>,
    IRunnableWithProfiler<
      IProgramExecutionTarget,
      T['run'],
      IProgramExecuteWithProfilerOptions
    >,
    ITraceScheduling<T['types'], T['requests'], T['scheduled']>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  private readonly connection: IAbapConnection;
  private readonly results: ResultStrategiesOf<T>;
  private readonly scheduling: TraceScheduling<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<ResultStrategiesOf<T>, 'logger'>,
  ) {
    const { results } = options;
    this.connection = connection;
    this.results = results;
    this.scheduling = new TraceScheduling(connection, { results });
  }

  // --- ITraceScheduling, delegated. Composed into the executor because a run
  // is what fulfils a scheduled request; not on a base, because an ATC run
  // implements IAdtRunnable too and has no business with traces.

  listObjectTypes<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['types'], E>> {
    return this.scheduling.listObjectTypes(options);
  }

  listProcessTypes<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['types'], E>> {
    return this.scheduling.listProcessTypes(options);
  }

  listRequests<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['requests'], E>> {
    return this.scheduling.listRequests(options);
  }

  getRequestsByUri<E extends IAdtError = IAdtError>(
    uri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['requests'], E>> {
    return this.scheduling.getRequestsByUri(uri, options);
  }

  scheduleTrace<E extends IAdtError = IAdtError>(
    options: { headers: IAdtHeaders } & IProfilerTraceParameters &
      IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['scheduled'], E>> {
    return this.scheduling.scheduleTrace(options);
  }

  async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'run'>,
    target: IProgramExecutionTarget,
    options?: IProgramExecuteOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return answering(
      () =>
        runProgram(
          this.connection,
          target.programName,
          undefined,
          options?.debuggee,
        ),
      this.results.run,
      options?.analyse,
    );
  }

  async runWithProfiler<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'profile'>,
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E>> {
    const normalizedProgramName = encodeSapObjectName(
      target.programName,
    ).toUpperCase();
    const encodedProfilerId = encodeURIComponent(options.profilerId);
    return answering(
      () =>
        this.connection.makeAdtRequest({
          url: `/sap/bc/adt/programs/programrun/${normalizedProgramName}?profilerId=${encodedProfilerId}`,
          method: 'POST',
          timeout: 0,
          headers: {
            Accept: 'text/plain',
            'X-sap-adt-profiling': 'server-time',
          },
        }),
      this.results.run,
      options.analyse,
    );
  }
}
