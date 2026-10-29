/**
 * AdtRuntimeClient - Runtime Operations Client
 *
 * Provides access to runtime-related ADT operations through domain object factories:
 * - getProfiler() — Profiler traces
 * - getCrossTrace() — Cross trace analysis
 * - getSt05Trace() — ST05 performance traces
 * - getApplicationLog() — Application log analysis
 * - getAtc() — ATC: the check variant, a worklist, a run, its status, its findings
 * - getAtcLog() — ATC check failure and execution logs
 * - getDdicActivation() — DDIC activation graph
 * - getDumps() — Runtime dump analysis
 * - getFeeds() — Feed repository (list feeds, variants, parse Atom feeds)
 * - getSystemMessages() — System messages (SM02)
 * - getGatewayErrorLog() — Gateway error log (/IWFND/ERROR_LOG)
 *
 * Usage:
 * ```typescript
 * import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtRuntimeClient(connection, logger);
 *
 * // Profiler traces
 * const traceFiles = await client.getProfiler().list();
 * const traceParams = await client.getProfiler().getParameters();
 *
 * // Debugging
 *
 * // Logs
 * const appLog = await client.getApplicationLog().getObject('Z_MY_LOG');
 * const atc = client.getAtc();
 * const variant = await atc.resolveCheckVariant();
 * const worklistId = await atc.createWorklist(variant);
 * const started = await atc.startRun(worklistId, {
 *   objects: [{ objectType: 'class', objectName: 'ZCL_MY_CLASS' }],
 * });
 * const atcLogs = await client.getAtcLog().getCheckFailureLogs();
 * ```
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ApplicationLog,
  applicationLogDocuments,
  type IApplicationLogResults,
} from '../runtime/applicationLog/ApplicationLog';
import { AdtAtc, atcDocuments, type IAtcResults } from '../runtime/atc/AdtAtc';
import {
  AtcLog,
  atcLogDocuments,
  type IAtcLogResults,
} from '../runtime/atc/AtcLog';
import {
  DdicActivation,
  ddicActivationDocuments,
  type IDdicActivationResults,
} from '../runtime/ddic/DdicActivation';
import {
  type IRuntimeDumpsResults,
  RuntimeDumps,
  runtimeDumpsDocuments,
} from '../runtime/dumps/RuntimeDumps';
import {
  FeedRepository,
  feedDocuments,
  type IFeedResults,
} from '../runtime/feeds/FeedRepository';
import {
  GatewayErrorLog,
  gatewayErrorLogDocuments,
  type IGatewayErrorLogResults,
} from '../runtime/gatewayErrorLog/GatewayErrorLog';
import {
  type ISystemMessagesResults,
  SystemMessages,
  systemMessagesDocuments,
} from '../runtime/systemMessages/SystemMessages';
import {
  CrossTrace,
  crossTraceDocuments,
  type ICrossTraceResultSet,
} from '../runtime/traces/CrossTraceDomain';
import {
  type IProfilerResults,
  Profiler,
  profilerDocuments,
} from '../runtime/traces/ProfilerDomain';
import {
  type ISt05TraceResults,
  St05Trace,
  st05TraceDocuments,
} from '../runtime/traces/St05Trace';
import { withRequestTrace } from '../utils/requestTrace';

export class AdtRuntimeClient {
  protected readonly connection: IAbapConnection;
  protected readonly logger: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    // Wrapped once, here, where a connection enters the library. The wrapper
    // puts the request back on the answer and reads nothing: what a body means
    // is the caller's, through the `analyse` they pass.
    this.connection = withRequestTrace(connection);
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  // ============================================================================
  // Domain Object Factories
  // ============================================================================

  getProfiler(): Profiler<typeof profilerDocuments>;
  getProfiler<R extends IProfilerResults>(results: R): Profiler<R>;
  getProfiler(
    results: IProfilerResults = profilerDocuments,
  ): Profiler<IProfilerResults> {
    return new Profiler<IProfilerResults>(this.connection, this.logger, {
      results,
    });
  }

  getCrossTrace(): CrossTrace<typeof crossTraceDocuments>;
  getCrossTrace<R extends ICrossTraceResultSet>(results: R): CrossTrace<R>;
  getCrossTrace(
    results: ICrossTraceResultSet = crossTraceDocuments,
  ): CrossTrace<ICrossTraceResultSet> {
    return new CrossTrace<ICrossTraceResultSet>(this.connection, this.logger, {
      results,
    });
  }

  getSt05Trace(): St05Trace<typeof st05TraceDocuments>;
  getSt05Trace<R extends ISt05TraceResults>(results: R): St05Trace<R>;
  getSt05Trace(
    results: ISt05TraceResults = st05TraceDocuments,
  ): St05Trace<ISt05TraceResults> {
    return new St05Trace<ISt05TraceResults>(this.connection, this.logger, {
      results,
    });
  }

  getApplicationLog(): ApplicationLog<typeof applicationLogDocuments>;
  getApplicationLog<R extends IApplicationLogResults>(
    results: R,
  ): ApplicationLog<R>;
  getApplicationLog(
    results: IApplicationLogResults = applicationLogDocuments,
  ): ApplicationLog<IApplicationLogResults> {
    return new ApplicationLog<IApplicationLogResults>(
      this.connection,
      this.logger,
      { results },
    );
  }

  /**
   * ATC check runs.
   *
   * The intersection is spelled here rather than given a name: one getter has
   * this set, and a composite earns a name when more than one handler does.
   */
  getAtc(): AdtAtc<typeof atcDocuments>;
  getAtc<R extends IAtcResults>(results: R): AdtAtc<R>;
  getAtc(results: IAtcResults = atcDocuments): AdtAtc<IAtcResults> {
    return new AdtAtc<IAtcResults>(this.connection, this.logger, { results });
  }

  getAtcLog(): AtcLog<typeof atcLogDocuments>;
  getAtcLog<R extends IAtcLogResults>(results: R): AtcLog<R>;
  getAtcLog(results: IAtcLogResults = atcLogDocuments): AtcLog<IAtcLogResults> {
    return new AtcLog<IAtcLogResults>(this.connection, this.logger, {
      results,
    });
  }

  getDdicActivation(): DdicActivation<typeof ddicActivationDocuments>;
  getDdicActivation<R extends IDdicActivationResults>(
    results: R,
  ): DdicActivation<R>;
  getDdicActivation(
    results: IDdicActivationResults = ddicActivationDocuments,
  ): DdicActivation<IDdicActivationResults> {
    return new DdicActivation<IDdicActivationResults>(
      this.connection,
      this.logger,
      { results },
    );
  }

  getDumps(): RuntimeDumps<typeof runtimeDumpsDocuments>;
  getDumps<R extends IRuntimeDumpsResults>(results: R): RuntimeDumps<R>;
  getDumps(
    results: IRuntimeDumpsResults = runtimeDumpsDocuments,
  ): RuntimeDumps<IRuntimeDumpsResults> {
    return new RuntimeDumps<IRuntimeDumpsResults>(
      this.connection,
      this.logger,
      { results },
    );
  }

  // ============================================================================
  // Feed, SystemMessages, GatewayErrorLog Factories
  // ============================================================================

  getFeeds(): FeedRepository<typeof feedDocuments>;
  getFeeds<R extends IFeedResults>(results: R): FeedRepository<R>;
  getFeeds(
    results: IFeedResults = feedDocuments,
  ): FeedRepository<IFeedResults> {
    return new FeedRepository<IFeedResults>(this.connection, this.logger, {
      results,
    });
  }

  getSystemMessages(): SystemMessages<typeof systemMessagesDocuments>;
  getSystemMessages<R extends ISystemMessagesResults>(
    results: R,
  ): SystemMessages<R>;
  getSystemMessages(
    results: ISystemMessagesResults = systemMessagesDocuments,
  ): SystemMessages<ISystemMessagesResults> {
    return new SystemMessages<ISystemMessagesResults>(
      this.connection,
      this.logger,
      { results },
    );
  }

  getGatewayErrorLog(): GatewayErrorLog<typeof gatewayErrorLogDocuments>;
  getGatewayErrorLog<R extends IGatewayErrorLogResults>(
    results: R,
  ): GatewayErrorLog<R>;
  getGatewayErrorLog(
    results: IGatewayErrorLogResults = gatewayErrorLogDocuments,
  ): GatewayErrorLog<IGatewayErrorLogResults> {
    return new GatewayErrorLog<IGatewayErrorLogResults>(
      this.connection,
      this.logger,
      { results },
    );
  }
}
