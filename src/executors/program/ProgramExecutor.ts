import type {
  IAbapConnection,
  IAdtResponse,
  IAdtRunnable,
  ILogger,
  IProfilerTraceParameters,
  IProgramExecuteWithProfilerOptions,
  IProgramExecuteWithProfilingOptions,
  IProgramExecuteWithProfilingResult,
  IProgramExecutionTarget,
  IRunnableWithProfiler,
  ITraceScheduling,
} from '@mcp-abap-adt/interfaces';
import { runProgram } from '../../core/program/run';
import type { INamedItem } from '../../core/shared/utilResults';
import type { ITraceRequestEntry } from '../../runtime/traces/types';
import { answering, failed, succeeded } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { rawDocument } from '../../utils/resultStrategy';
import { getTimeout } from '../../utils/timeouts';
import { TraceScheduling } from '../traceScheduling';

/**
 * **Not `IProgramExecutor` since 19.0.0.** That composite includes
 * `IRunnableWithProfiling`, whose `runWithProfiling` scheduled a trace, ran the
 * program under it, and answered both — three requests in one member, with the
 * order fixed here. The three atoms below are what this class offers; a caller
 * who wants the old member writes `scheduleTrace`, then `runWithProfiler` with
 * the id it answered. The composite stays in the contract for an implementation
 * that joins them.
 */
export class ProgramExecutor
  implements
    IAdtRunnable<IProgramExecutionTarget, string>,
    IRunnableWithProfiler<
      IProgramExecutionTarget,
      string,
      IProgramExecuteWithProfilerOptions
    >,
    ITraceScheduling<INamedItem[], ITraceRequestEntry[], string>
{
  private readonly connection: IAbapConnection;
  private readonly scheduling: TraceScheduling;

  constructor(connection: IAbapConnection, _logger?: ILogger) {
    this.connection = connection;
    this.scheduling = new TraceScheduling(connection);
  }

  // --- ITraceScheduling, delegated. Same capability as the class executor,
  // because a report run fulfils a scheduled request exactly as a class run
  // does — which is why this lives on both and on neither's base.

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

  async run(target: IProgramExecutionTarget): Promise<IAdtResponse<string>> {
    return answering(
      () => runProgram(this.connection, target.programName),
      rawDocument,
    );
  }

  async runWithProfiler(
    target: IProgramExecutionTarget,
    options: IProgramExecuteWithProfilerOptions,
  ): Promise<IAdtResponse<string>> {
    return this.runWithProfilerId(target.programName, options.profilerId);
  }

  private async runWithProfilerId(
    programName: string,
    profilerId: string,
  ): Promise<IAdtResponse<string>> {
    const normalizedProgramName =
      encodeSapObjectName(programName).toUpperCase();
    const encodedProfilerId = encodeURIComponent(profilerId);
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
      rawDocument,
    );
  }
}
