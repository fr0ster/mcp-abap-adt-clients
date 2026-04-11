/**
 * AdtRuntimeClient - Runtime Operations Client
 *
 * Provides access to runtime-related ADT operations through domain object factories:
 * - getProfiler() — Profiler traces
 * - getCrossTrace() — Cross trace analysis
 * - getSt05Trace() — ST05 performance traces
 * - getDebugger() — Composite debugger (ABAP, AMDP, memory snapshots)
 * - getApplicationLog() — Application log analysis
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
 * await client.getDebugger().getAbap().launch({ debuggingMode: 'external' });
 * const callStack = await client.getDebugger().getAbap().getCallStack();
 *
 * // Logs
 * const appLog = await client.getApplicationLog().getObject('Z_MY_LOG');
 * const atcLogs = await client.getAtcLog().getCheckFailureLogs();
 * ```
 */

import type {
  IAbapConnection,
  IApplicationLog,
  IAtcLog,
  ICrossTrace,
  IDdicActivation,
  IDebugger,
  IFeedRepository,
  IGatewayErrorLog,
  ILogger,
  IProfiler,
  IRuntimeDumps,
  ISt05Trace,
  ISystemMessages,
} from '@mcp-abap-adt/interfaces';
import { ApplicationLog } from '../runtime/applicationLog/ApplicationLog';
import { AtcLog } from '../runtime/atc/AtcLog';
import { DdicActivation } from '../runtime/ddic/DdicActivation';
import { Debugger } from '../runtime/debugger/Debugger';
import { RuntimeDumps } from '../runtime/dumps/RuntimeDumps';
import { FeedRepository } from '../runtime/feeds/FeedRepository';
import { GatewayErrorLog } from '../runtime/gatewayErrorLog/GatewayErrorLog';
import { SystemMessages } from '../runtime/systemMessages/SystemMessages';
import { CrossTrace } from '../runtime/traces/CrossTraceDomain';
import { Profiler } from '../runtime/traces/ProfilerDomain';
import { St05Trace } from '../runtime/traces/St05Trace';

export class AdtRuntimeClient {
  protected readonly connection: IAbapConnection;
  protected readonly logger: ILogger;

  private _profiler?: Profiler;
  private _crossTrace?: CrossTrace;
  private _st05Trace?: St05Trace;
  private _debugger?: Debugger;
  private _applicationLog?: ApplicationLog;
  private _atcLog?: AtcLog;
  private _ddicActivation?: DdicActivation;
  private _dumps?: RuntimeDumps;
  private _feeds?: FeedRepository;
  private _systemMessages?: SystemMessages;
  private _gatewayErrorLog?: GatewayErrorLog;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: { enableAcceptCorrection?: boolean },
  ) {
    this.connection = connection;
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
      setAcceptCorrectionEnabled(options.enableAcceptCorrection);
      const shouldWrap =
        options.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
      if (shouldWrap) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    } else {
      const {
        getAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
      } = require('../utils/acceptNegotiation');
      if (getAcceptCorrectionEnabled()) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    }
  }

  // ============================================================================
  // Domain Object Factories
  // ============================================================================

  getProfiler(): IProfiler {
    if (!this._profiler) {
      this._profiler = new Profiler(this.connection, this.logger);
    }
    return this._profiler;
  }

  getCrossTrace(): ICrossTrace {
    if (!this._crossTrace) {
      this._crossTrace = new CrossTrace(this.connection, this.logger);
    }
    return this._crossTrace;
  }

  getSt05Trace(): ISt05Trace {
    if (!this._st05Trace) {
      this._st05Trace = new St05Trace(this.connection, this.logger);
    }
    return this._st05Trace;
  }

  getDebugger(): IDebugger {
    if (!this._debugger) {
      this._debugger = new Debugger(this.connection, this.logger);
    }
    return this._debugger;
  }

  getApplicationLog(): IApplicationLog {
    if (!this._applicationLog) {
      this._applicationLog = new ApplicationLog(this.connection, this.logger);
    }
    return this._applicationLog;
  }

  getAtcLog(): IAtcLog {
    if (!this._atcLog) {
      this._atcLog = new AtcLog(this.connection, this.logger);
    }
    return this._atcLog;
  }

  getDdicActivation(): IDdicActivation {
    if (!this._ddicActivation) {
      this._ddicActivation = new DdicActivation(this.connection, this.logger);
    }
    return this._ddicActivation;
  }

  getDumps(): IRuntimeDumps {
    if (!this._dumps) {
      this._dumps = new RuntimeDumps(this.connection, this.logger);
    }
    return this._dumps;
  }

  // ============================================================================
  // Feed, SystemMessages, GatewayErrorLog Factories
  // ============================================================================

  getFeeds(): IFeedRepository {
    if (!this._feeds) {
      this._feeds = new FeedRepository(this.connection, this.logger);
    }
    return this._feeds;
  }

  getSystemMessages(): ISystemMessages {
    if (!this._systemMessages) {
      this._systemMessages = new SystemMessages(this.connection, this.logger);
    }
    return this._systemMessages;
  }

  getGatewayErrorLog(): IGatewayErrorLog {
    if (!this._gatewayErrorLog) {
      this._gatewayErrorLog = new GatewayErrorLog(this.connection, this.logger);
    }
    return this._gatewayErrorLog;
  }
}
