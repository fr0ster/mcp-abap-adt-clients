import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAdtRunnable,
  IProfilerTraceParameters,
  IProgramExecuteWithProfilerOptions,
  IProgramExecutionTarget,
  IResultStrategy,
  IRunnableWithProfiler,
  ITraceScheduling,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { runProgram } from '../../core/program/run';
import { answering } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { rawDocument } from '../../utils/resultStrategy';
import { getTimeout } from '../../utils/timeouts';
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
  R extends IProgramExecutorResults = typeof programExecutorDocuments,
> implements
    IAdtRunnable<IProgramExecutionTarget, ReturnType<R['run']>>,
    IRunnableWithProfiler<
      IProgramExecutionTarget,
      ReturnType<R['run']>,
      IProgramExecuteWithProfilerOptions
    >,
    ITraceScheduling<
      ReturnType<R['types']>,
      ReturnType<R['requests']>,
      ReturnType<R['scheduled']>
    >
{
  private readonly connection: IAbapConnection;
  private readonly results: R;
  private readonly scheduling: TraceScheduling<R>;

  constructor(
    connection: IAbapConnection,
    _logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = programExecutorDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.results = results;
    this.scheduling = new TraceScheduling(connection, results);
  }

  // --- ITraceScheduling, delegated. Composed into the executor because a run
  // is what fulfils a scheduled request; not on a base, because an ATC run
  // implements IAdtRunnable too and has no business with traces.

  listObjectTypes<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return this.scheduling.listObjectTypes(options);
  }

  listProcessTypes<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return this.scheduling.listProcessTypes(options);
  }

  listRequests<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['requests']>, E>> {
    return this.scheduling.listRequests(options);
  }

  getRequestsByUri<E extends IAdtError = IAdtError>(
    uri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['requests']>, E>> {
    return this.scheduling.getRequestsByUri(uri, options);
  }

  scheduleTrace<E extends IAdtError = IAdtError>(
    options?: IProfilerTraceParameters & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['scheduled']>, E>> {
    return this.scheduling.scheduleTrace(options);
  }

  async run<E extends IAdtError = IAdtError>(
    target: IProgramExecutionTarget,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return answering(
      () => runProgram(this.connection, target.programName),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options?.analyse,
    );
  }

  async runWithProfiler<E extends IAdtError = IAdtError>(
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    const normalizedProgramName = encodeSapObjectName(
      target.programName,
    ).toUpperCase();
    const encodedProfilerId = encodeURIComponent(options.profilerId);
    return answering(
      () =>
        this.connection.makeAdtRequest({
          url: `/sap/bc/adt/programs/programrun/${normalizedProgramName}?profilerId=${encodedProfilerId}`,
          method: 'POST',
          timeout: getTimeout('default'),
          headers: {
            Accept: 'text/plain',
            'X-sap-adt-profiling': 'server-time',
          },
        }),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options.analyse,
    );
  }
}
