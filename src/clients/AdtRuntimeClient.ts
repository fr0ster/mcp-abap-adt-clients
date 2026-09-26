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

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: { enableAcceptCorrection?: boolean },
  ) {
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
    if (options?.enableAcceptCorrection !== undefined) {
      const {
        setAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
        getAcceptCorrectionEnabled,
      } = require('../utils/acceptNegotiation');
      setAcceptCorrectionEnabled(
        this.connection,
        options.enableAcceptCorrection,
      );
      const shouldWrap =
        options.enableAcceptCorrection ??
        getAcceptCorrectionEnabled(this.connection);
      if (shouldWrap) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    } else {
      const {
        getAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
      } = require('../utils/acceptNegotiation');
      if (getAcceptCorrectionEnabled(this.connection)) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    }
  }

  // ============================================================================
  // Domain Object Factories
  // ============================================================================

  getProfiler<R extends IProfilerResults = typeof profilerDocuments>(
    results: R = profilerDocuments as unknown as R,
  ): Profiler<R> {
    return new Profiler<R>(this.connection, this.logger, results);
  }

  getCrossTrace<R extends ICrossTraceResultSet = typeof crossTraceDocuments>(
    results: R = crossTraceDocuments as unknown as R,
  ): CrossTrace<R> {
    return new CrossTrace<R>(this.connection, this.logger, results);
  }

  getSt05Trace<R extends ISt05TraceResults = typeof st05TraceDocuments>(
    results: R = st05TraceDocuments as unknown as R,
  ): St05Trace<R> {
    return new St05Trace<R>(this.connection, this.logger, results);
  }

  getApplicationLog<
    R extends IApplicationLogResults = typeof applicationLogDocuments,
  >(results: R = applicationLogDocuments as unknown as R): ApplicationLog<R> {
    return new ApplicationLog<R>(this.connection, this.logger, results);
  }

  /**
   * ATC check runs.
   *
   * The intersection is spelled here rather than given a name: one getter has
   * this set, and a composite earns a name when more than one handler does.
   */
  getAtc<R extends IAtcResults = typeof atcDocuments>(
    results: R = atcDocuments as unknown as R,
  ): AdtAtc<R> {
    return new AdtAtc<R>(this.connection, this.logger, results);
  }

  getAtcLog<R extends IAtcLogResults = typeof atcLogDocuments>(
    results: R = atcLogDocuments as unknown as R,
  ): AtcLog<R> {
    return new AtcLog<R>(this.connection, this.logger, results);
  }

  getDdicActivation<
    R extends IDdicActivationResults = typeof ddicActivationDocuments,
  >(results: R = ddicActivationDocuments as unknown as R): DdicActivation<R> {
    return new DdicActivation<R>(this.connection, this.logger, results);
  }

  getDumps<R extends IRuntimeDumpsResults = typeof runtimeDumpsDocuments>(
    results: R = runtimeDumpsDocuments as unknown as R,
  ): RuntimeDumps<R> {
    return new RuntimeDumps<R>(this.connection, this.logger, results);
  }

  // ============================================================================
  // Feed, SystemMessages, GatewayErrorLog Factories
  // ============================================================================

  getFeeds<R extends IFeedResults = typeof feedDocuments>(
    results: R = feedDocuments as unknown as R,
  ): FeedRepository<R> {
    return new FeedRepository<R>(this.connection, this.logger, results);
  }

  getSystemMessages<
    R extends ISystemMessagesResults = typeof systemMessagesDocuments,
  >(results: R = systemMessagesDocuments as unknown as R): SystemMessages<R> {
    return new SystemMessages<R>(this.connection, this.logger, results);
  }

  getGatewayErrorLog<
    R extends IGatewayErrorLogResults = typeof gatewayErrorLogDocuments,
  >(results: R = gatewayErrorLogDocuments as unknown as R): GatewayErrorLog<R> {
    return new GatewayErrorLog<R>(this.connection, this.logger, results);
  }
}
