/**
 * AdtRuntimeClient - Runtime Operations Client
 *
 * Provides access to runtime-related ADT operations through domain object factories:
 * - profiler() — Profiler traces
 * - crossTrace() — Cross trace analysis
 * - st05Trace() — ST05 performance traces
 * - debugger() — ABAP debugger operations
 * - applicationLog() — Application log analysis
 * - atcLog() — ATC check failure and execution logs
 * - ddicActivation() — DDIC activation graph
 * - dumps() — Runtime dump analysis
 * - memorySnapshots() — Memory snapshot analysis
 *
 * Feed reader operations (getFeeds, getFeedVariants) remain as direct methods
 * because they don't belong to a specific domain object.
 *
 * Usage:
 * ```typescript
 * import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtRuntimeClient(connection, logger);
 *
 * // Profiler traces
 * const traceFiles = await client.profiler().listTraceFiles();
 * const traceParams = await client.profiler().getParameters();
 *
 * // Debugging
 * await client.debugger().launch({ debuggingMode: 'external' });
 * const callStack = await client.debugger().getCallStack();
 *
 * // Logs
 * const appLog = await client.applicationLog().getObject('Z_MY_LOG');
 * const atcLogs = await client.atcLog().getCheckFailureLogs();
 * ```
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { ApplicationLog } from '../runtime/applicationLog/ApplicationLog';
import { AtcLog } from '../runtime/atc/AtcLog';
import { DdicActivation } from '../runtime/ddic/DdicActivation';
import { AbapDebugger } from '../runtime/debugger/AbapDebugger';
import { RuntimeDumps } from '../runtime/dumps/RuntimeDumps';
import {
  getFeeds as getFeedsUtil,
  getFeedVariants as getFeedVariantsUtil,
} from '../runtime/feeds';
import { MemorySnapshots } from '../runtime/memory/MemorySnapshots';
import { CrossTrace } from '../runtime/traces/CrossTrace';
import { Profiler } from '../runtime/traces/Profiler';
import { St05Trace } from '../runtime/traces/St05Trace';

export class AdtRuntimeClient {
  protected readonly connection: IAbapConnection;
  protected readonly logger: ILogger;

  private _profiler?: Profiler;
  private _crossTrace?: CrossTrace;
  private _st05Trace?: St05Trace;
  private _debugger?: AbapDebugger;
  private _applicationLog?: ApplicationLog;
  private _atcLog?: AtcLog;
  private _ddicActivation?: DdicActivation;
  private _dumps?: RuntimeDumps;
  private _memorySnapshots?: MemorySnapshots;

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

  profiler(): Profiler {
    if (!this._profiler) {
      this._profiler = new Profiler(this.connection, this.logger);
    }
    return this._profiler;
  }

  crossTrace(): CrossTrace {
    if (!this._crossTrace) {
      this._crossTrace = new CrossTrace(this.connection, this.logger);
    }
    return this._crossTrace;
  }

  st05Trace(): St05Trace {
    if (!this._st05Trace) {
      this._st05Trace = new St05Trace(this.connection, this.logger);
    }
    return this._st05Trace;
  }

  debugger(): AbapDebugger {
    if (!this._debugger) {
      this._debugger = new AbapDebugger(this.connection, this.logger);
    }
    return this._debugger;
  }

  applicationLog(): ApplicationLog {
    if (!this._applicationLog) {
      this._applicationLog = new ApplicationLog(this.connection, this.logger);
    }
    return this._applicationLog;
  }

  atcLog(): AtcLog {
    if (!this._atcLog) {
      this._atcLog = new AtcLog(this.connection, this.logger);
    }
    return this._atcLog;
  }

  ddicActivation(): DdicActivation {
    if (!this._ddicActivation) {
      this._ddicActivation = new DdicActivation(this.connection, this.logger);
    }
    return this._ddicActivation;
  }

  dumps(): RuntimeDumps {
    if (!this._dumps) {
      this._dumps = new RuntimeDumps(this.connection, this.logger);
    }
    return this._dumps;
  }

  memorySnapshots(): MemorySnapshots {
    if (!this._memorySnapshots) {
      this._memorySnapshots = new MemorySnapshots(this.connection, this.logger);
    }
    return this._memorySnapshots;
  }

  // ============================================================================
  // Feed Reader (no dedicated domain object — thin pass-through)
  // ============================================================================

  /**
   * Get feeds
   *
   * @returns Axios response with feeds
   */
  async getFeeds(): Promise<AxiosResponse> {
    return getFeedsUtil(this.connection);
  }

  /**
   * Get feed variants
   *
   * @returns Axios response with feed variants
   */
  async getFeedVariants(): Promise<AxiosResponse> {
    return getFeedVariantsUtil(this.connection);
  }
}
