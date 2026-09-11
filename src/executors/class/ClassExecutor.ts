import type {
  IAbapConnection,
  IAdtResponse,
  IAdtRunnable,
  IClassExecuteWithProfilerOptions,
  IClassExecuteWithProfilingOptions,
  IClassExecuteWithProfilingResult,
  IClassExecutionTarget,
  ILogger,
  IProfilerTraceParameters,
  IRunnableWithProfiler,
  ITraceScheduling,
} from '@mcp-abap-adt/interfaces';
import { runClass } from '../../core/class/run';
import type { INamedItem } from '../../core/shared/utilResults';
import type { ITraceRequestEntry } from '../../runtime/traces/types';
import { answering, failed, succeeded } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getTimeout } from '../../utils/timeouts';
import { TraceScheduling } from '../traceScheduling';

/**
 * **Not `IClassExecutor` since 19.0.0.** That composite includes
 * `IRunnableWithProfiling`, whose `runWithProfiling` scheduled a trace, ran the
 * class under it, and answered both — three requests in one member, with the
 * order fixed here. The three atoms below are what this class offers; a caller
 * who wants the old member writes `scheduleTrace`, then `runWithProfiler` with
 * the id it answered. The composite stays in the contract for an implementation
 * that joins them.
 */
export class ClassExecutor
  implements
    IAdtRunnable<IClassExecutionTarget, string>,
    IRunnableWithProfiler<
      IClassExecutionTarget,
      string,
      IClassExecuteWithProfilerOptions
    >,
    ITraceScheduling<INamedItem[], ITraceRequestEntry[], string>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly scheduling: TraceScheduling;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
    this.scheduling = new TraceScheduling(connection);
  }

  // --- ITraceScheduling, delegated. Composed into the executor because a run
  // is what fulfils a scheduled request; not on IExecutor, because an ATC run
  // implements that too and has no business with traces.

  listObjectTypes = (): Promise<IAdtResponse<INamedItem[]>> =>
    this.scheduling.listObjectTypes();
  listProcessTypes = (): Promise<IAdtResponse<INamedItem[]>> =>
    this.scheduling.listProcessTypes();
  listRequests = (): Promise<IAdtResponse<ITraceRequestEntry[]>> =>
    this.scheduling.listRequests();
  getRequestsByUri = (
    uri: string,
  ): Promise<IAdtResponse<ITraceRequestEntry[]>> =>
    this.scheduling.getRequestsByUri(uri);
  scheduleTrace = (
    options?: IProfilerTraceParameters,
  ): Promise<IAdtResponse<string>> => this.scheduling.scheduleTrace(options);

  async run(target: IClassExecutionTarget): Promise<IAdtResponse<string>> {
    if (!target.className) {
      throw new Error('Class name is required');
    }
    return answering(
      () => runClass(this.connection, target.className, true),
      rawDocument,
    );
  }

  async runWithProfiler(
    target: IClassExecutionTarget,
    options: IClassExecuteWithProfilerOptions,
  ): Promise<IAdtResponse<string>> {
    if (!target.className) {
      throw new Error('Class name is required');
    }
    if (!options.profilerId) {
      throw new Error('profilerId is required');
    }
    return this.runWithProfilerId(target.className, options.profilerId);
  }

  private async runWithProfilerId(
    className: string,
    profilerId: string,
  ): Promise<IAdtResponse<string>> {
    const encodedProfilerId = encodeURIComponent(profilerId);
    return answering(
      () =>
        this.connection.makeAdtRequest({
          url: `/sap/bc/adt/oo/classrun/${className}?profilerId=${encodedProfilerId}`,
          method: 'POST',
          timeout: getTimeout('default'),
          headers: {
            Accept: 'text/plain',
            'X-sap-adt-profiling': 'server-time',
          },
        }),
      rawDocument,
    );
  }
}
