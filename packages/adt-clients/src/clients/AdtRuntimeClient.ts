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
  type ApplicationLogValues,
  applicationLogDocuments,
  type IApplicationLogResults,
} from '../runtime/applicationLog/ApplicationLog';
import {
  AdtAtc,
  type AtcValues,
  atcDocuments,
  type IAtcResults,
} from '../runtime/atc/AdtAtc';
import {
  AtcLog,
  type AtcLogValues,
  atcLogDocuments,
  type IAtcLogResults,
} from '../runtime/atc/AtcLog';
import {
  DdicActivation,
  type DdicActivationValues,
  ddicActivationDocuments,
  type IDdicActivationResults,
} from '../runtime/ddic/DdicActivation';
import {
  type IRuntimeDumpsResults,
  RuntimeDumps,
  type RuntimeDumpsValues,
  runtimeDumpsDocuments,
} from '../runtime/dumps/RuntimeDumps';
import {
  FeedRepository,
  type FeedValues,
  feedDocuments,
  type IFeedResults,
} from '../runtime/feeds/FeedRepository';
import {
  GatewayErrorLog,
  type GatewayErrorLogValues,
  gatewayErrorLogDocuments,
  type IGatewayErrorLogResults,
} from '../runtime/gatewayErrorLog/GatewayErrorLog';
import {
  type ISystemMessagesResults,
  SystemMessages,
  type SystemMessagesValues,
  systemMessagesDocuments,
} from '../runtime/systemMessages/SystemMessages';
import {
  CrossTrace,
  type CrossTraceValues,
  crossTraceDocuments,
  type ICrossTraceResultSet,
} from '../runtime/traces/CrossTraceDomain';
import {
  type IProfilerResults,
  Profiler,
  type ProfilerValues,
  profilerDocuments,
} from '../runtime/traces/ProfilerDomain';
import {
  type ISt05TraceResults,
  St05Trace,
  type St05TraceValues,
  st05TraceDocuments,
} from '../runtime/traces/St05Trace';
import { withRequestTrace } from '../utils/requestTrace';
import type { ResultValuesOf } from '../utils/resultStrategy';

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

  getProfiler(): Profiler<ResultValuesOf<typeof profilerDocuments>>;
  getProfiler<R extends IProfilerResults>(
    results: R,
  ): Profiler<ResultValuesOf<R>>;
  getProfiler(
    results: IProfilerResults = profilerDocuments,
  ): Profiler<ProfilerValues> {
    return new Profiler<ProfilerValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getCrossTrace(): CrossTrace<ResultValuesOf<typeof crossTraceDocuments>>;
  getCrossTrace<R extends ICrossTraceResultSet>(
    results: R,
  ): CrossTrace<ResultValuesOf<R>>;
  getCrossTrace(
    results: ICrossTraceResultSet = crossTraceDocuments,
  ): CrossTrace<CrossTraceValues> {
    return new CrossTrace<CrossTraceValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getSt05Trace(): St05Trace<ResultValuesOf<typeof st05TraceDocuments>>;
  getSt05Trace<R extends ISt05TraceResults>(
    results: R,
  ): St05Trace<ResultValuesOf<R>>;
  getSt05Trace(
    results: ISt05TraceResults = st05TraceDocuments,
  ): St05Trace<St05TraceValues> {
    return new St05Trace<St05TraceValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getApplicationLog(): ApplicationLog<
    ResultValuesOf<typeof applicationLogDocuments>
  >;
  getApplicationLog<R extends IApplicationLogResults>(
    results: R,
  ): ApplicationLog<ResultValuesOf<R>>;
  getApplicationLog(
    results: IApplicationLogResults = applicationLogDocuments,
  ): ApplicationLog<ApplicationLogValues> {
    return new ApplicationLog<ApplicationLogValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  /**
   * ATC check runs.
   *
   * The intersection is spelled here rather than given a name: one getter has
   * this set, and a composite earns a name when more than one handler does.
   */
  getAtc(): AdtAtc<ResultValuesOf<typeof atcDocuments>>;
  getAtc<R extends IAtcResults>(results: R): AdtAtc<ResultValuesOf<R>>;
  getAtc(results: IAtcResults = atcDocuments): AdtAtc<AtcValues> {
    return new AdtAtc<AtcValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getAtcLog(): AtcLog<ResultValuesOf<typeof atcLogDocuments>>;
  getAtcLog<R extends IAtcLogResults>(results: R): AtcLog<ResultValuesOf<R>>;
  getAtcLog(results: IAtcLogResults = atcLogDocuments): AtcLog<AtcLogValues> {
    return new AtcLog<AtcLogValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getDdicActivation(): DdicActivation<
    ResultValuesOf<typeof ddicActivationDocuments>
  >;
  getDdicActivation<R extends IDdicActivationResults>(
    results: R,
  ): DdicActivation<ResultValuesOf<R>>;
  getDdicActivation(
    results: IDdicActivationResults = ddicActivationDocuments,
  ): DdicActivation<DdicActivationValues> {
    return new DdicActivation<DdicActivationValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getDumps(): RuntimeDumps<ResultValuesOf<typeof runtimeDumpsDocuments>>;
  getDumps<R extends IRuntimeDumpsResults>(
    results: R,
  ): RuntimeDumps<ResultValuesOf<R>>;
  getDumps(
    results: IRuntimeDumpsResults = runtimeDumpsDocuments,
  ): RuntimeDumps<RuntimeDumpsValues> {
    return new RuntimeDumps<RuntimeDumpsValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  // ============================================================================
  // Feed, SystemMessages, GatewayErrorLog Factories
  // ============================================================================

  getFeeds(): FeedRepository<ResultValuesOf<typeof feedDocuments>>;
  getFeeds<R extends IFeedResults>(
    results: R,
  ): FeedRepository<ResultValuesOf<R>>;
  getFeeds(results: IFeedResults = feedDocuments): FeedRepository<FeedValues> {
    return new FeedRepository<FeedValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getSystemMessages(): SystemMessages<
    ResultValuesOf<typeof systemMessagesDocuments>
  >;
  getSystemMessages<R extends ISystemMessagesResults>(
    results: R,
  ): SystemMessages<ResultValuesOf<R>>;
  getSystemMessages(
    results: ISystemMessagesResults = systemMessagesDocuments,
  ): SystemMessages<SystemMessagesValues> {
    return new SystemMessages<SystemMessagesValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  getGatewayErrorLog(): GatewayErrorLog<
    ResultValuesOf<typeof gatewayErrorLogDocuments>
  >;
  getGatewayErrorLog<R extends IGatewayErrorLogResults>(
    results: R,
  ): GatewayErrorLog<ResultValuesOf<R>>;
  getGatewayErrorLog(
    results: IGatewayErrorLogResults = gatewayErrorLogDocuments,
  ): GatewayErrorLog<GatewayErrorLogValues> {
    return new GatewayErrorLog<GatewayErrorLogValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }
}
