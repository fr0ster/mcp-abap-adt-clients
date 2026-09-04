import type {
  IAbapConnection,
  IAdtResponse,
  IClassExecuteWithProfilerOptions,
  IClassExecuteWithProfilingOptions,
  IClassExecuteWithProfilingResult,
  IClassExecutionTarget,
  IClassExecutor,
  ILogger,
  IProfilerTraceParameters,
} from '@mcp-abap-adt/interfaces';
import { runClass } from '../../core/class/run';
import type { INamedItem } from '../../core/shared/utilResults';
import type { ITraceRequestEntry } from '../../runtime/traces/types';
import { answering, failed, succeeded } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getTimeout } from '../../utils/timeouts';
import { TraceScheduling } from '../traceScheduling';

export class ClassExecutor
  implements IClassExecutor<string, INamedItem[], ITraceRequestEntry[], string>
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
  ): Promise<IAdtResponse<IClassExecuteWithProfilingResult<string>>> {
    if (!target.className) {
      throw new Error('Class name is required');
    }

    const scheduled = await this.scheduleTrace(options.profilerParameters);
    if (!scheduled.ok) {
      // The measurement could not be configured, so there is nothing to run
      // under it — the scheduling's own failure is the answer.
      return failed(scheduled.getError());
    }
    const profilerId = scheduled.getResult().value;
    this.logger?.debug?.('Scheduled trace for class run', {
      className: target.className,
      profilerId,
    });

    const run = await this.runWithProfilerId(target.className, profilerId);
    if (!run.ok) return failed(run.getError());
    return succeeded({ run: run.getResult().value, profilerId });
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
