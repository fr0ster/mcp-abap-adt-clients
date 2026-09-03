import type {
  IAbapConnection,
  IAdtWireResponse,
  IClassExecuteWithProfilerOptions,
  IClassExecuteWithProfilingOptions,
  IClassExecuteWithProfilingResult,
  IClassExecutionTarget,
  IClassExecutor,
  ILogger,
  INamedItem,
  IProfilerTraceParameters,
  ITraceRequestEntry,
} from '@mcp-abap-adt/interfaces';
import { runClass } from '../../core/class/run';
import { getTimeout } from '../../utils/timeouts';
import { TraceScheduling } from '../traceScheduling';

export class ClassExecutor implements IClassExecutor {
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

  listObjectTypes = (): Promise<INamedItem[]> =>
    this.scheduling.listObjectTypes();
  listProcessTypes = (): Promise<INamedItem[]> =>
    this.scheduling.listProcessTypes();
  listRequests = (): Promise<ITraceRequestEntry[]> =>
    this.scheduling.listRequests();
  getRequestsByUri = (uri: string): Promise<ITraceRequestEntry[]> =>
    this.scheduling.getRequestsByUri(uri);
  scheduleTrace = (options?: IProfilerTraceParameters): Promise<string> =>
    this.scheduling.scheduleTrace(options);

  async run(target: IClassExecutionTarget): Promise<IAdtWireResponse> {
    if (!target.className) {
      throw new Error('Class name is required');
    }
    return runClass(this.connection, target.className, true);
  }

  async runWithProfiler(
    target: IClassExecutionTarget,
    options: IClassExecuteWithProfilerOptions,
  ): Promise<IAdtWireResponse> {
    if (!target.className) {
      throw new Error('Class name is required');
    }
    if (!options.profilerId) {
      throw new Error('profilerId is required');
    }
    return this.runWithProfilerId(target.className, options.profilerId);
  }

  /**
   * Run under a freshly scheduled measurement.
   *
   * It does **not** wait for the trace. SAP writes traces asynchronously, so
   * when this returns there may be no trace, there may never be one, and the
   * caller may legitimately read it a week later — the feed carries an
   * expiration about four weeks out.
   *
   * The previous version polled up to five times and then **threw** when it
   * found nothing, which turned "the trace is not written yet" — the normal
   * case — into a failed run. Worse, its fallback took the first id in the
   * feed, and position in that feed is not age: it could return a trace from
   * eight days earlier with no indication that it had.
   *
   * To read what this run produced: note `profiler.list()` before running,
   * then look for an id that is new.
   */
  async runWithProfiling(
    target: IClassExecutionTarget,
    options: IClassExecuteWithProfilingOptions = {},
  ): Promise<IClassExecuteWithProfilingResult> {
    if (!target.className) {
      throw new Error('Class name is required');
    }

    const profilerId = await this.scheduleTrace(options.profilerParameters);
    this.logger?.debug?.('Scheduled trace for class run', {
      className: target.className,
      profilerId,
    });

    const response = await this.runWithProfilerId(target.className, profilerId);
    return { response, profilerId };
  }

  private async runWithProfilerId(
    className: string,
    profilerId: string,
  ): Promise<IAdtWireResponse> {
    const encodedProfilerId = encodeURIComponent(profilerId);
    return this.connection.makeAdtRequest({
      url: `/sap/bc/adt/oo/classrun/${className}?profilerId=${encodedProfilerId}`,
      method: 'POST',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'text/plain',
        'X-sap-adt-profiling': 'server-time',
      },
    });
  }
}
