/**
 * AdtAtc - High-level operations for ATC (ABAP Test Cockpit) checks
 *
 * Implements IAdtObject<IAtcConfig, IAtcState> with the ATC worklist+run flow.
 *
 * Operation chains:
 * - Create:  create worklist -> start run, returns worklistId + runId
 * - Read:    poll status (+ optionally findings when status === 'finished')
 * - Update / Delete / Activate / Check / Lock / Unlock: not supported (throws)
 *
 * Convenience methods:
 * - run(objectType, objectName, options): full create -> poll -> findings flow
 * - getStatus / getFindings / listVariants / getSystemDefaultVariant
 */

import type {
  IAdtResponse as AxiosResponse,
  HttpError,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
  IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import { safeErrorMessage } from '../../utils/internalUtils';
import { throwUnsupportedVersions } from '../shared/versions';
import {
  buildAtcObjectUri,
  createAtcWorklist,
  extractAtcRunId,
  extractAtcWorklistId,
  getAtcCustomizing,
  getAtcRunStatus,
  getAtcWorklistFindings,
  listAtcVariants,
  parseSystemDefaultVariant,
  startAtcRun,
} from './run';
import type {
  AtcFindingsFormat,
  AtcObjectType,
  IAtcConfig,
  IAtcFindingsOptions,
  IAtcListVariantsOptions,
  IAtcRunOptions,
  IAtcState,
} from './types';

const DEFAULT_POLL_INTERVAL_MS = 4_000;
const DEFAULT_MAX_POLLS = 75; // 75 * 4s = 5 minutes (matches Java reference)

export interface IAtcPollOptions {
  pollIntervalMs?: number;
  maxPolls?: number;
}

export class AdtAtc implements IAdtObject<IAtcConfig, IAtcState> {
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  public readonly objectType: string = 'Atc';

  protected lastWorklistId?: string;
  protected lastRunId?: string;
  protected lastCheckVariant?: string;
  protected state: IAtcState = { errors: [] };

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate ATC run configuration before creation.
   * ATC has no dedicated validation endpoint; we enforce minimum required fields.
   */
  async validate(config: Partial<IAtcConfig>): Promise<IAtcState> {
    if (!config.objectName) {
      throw new Error('objectName is required to start an ATC run');
    }
    if (!config.objectType) {
      throw new Error('objectType is required to start an ATC run');
    }
    return { errors: [] };
  }

  /**
   * Start an ATC run: create a worklist, then submit the run.
   * Returns state populated with worklistId, runId, and the resolved checkVariant.
   * The run is asynchronous; use read() to poll status and fetch findings.
   */
  async create(
    config: IAtcConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IAtcState> {
    if (!config.objectName || !config.objectType) {
      throw new Error('objectName and objectType are required');
    }

    try {
      const checkVariant =
        config.options?.checkVariant ??
        (await this.resolveCheckVariant());
      if (!checkVariant) {
        throw new Error(
          'No check variant provided and no system default check variant configured',
        );
      }

      this.logger?.info?.(
        `Creating ATC worklist (checkVariant=${checkVariant})`,
      );
      const worklistResponse = await createAtcWorklist(
        this.connection,
        checkVariant,
      );
      const worklistId = extractAtcWorklistId(worklistResponse);
      if (!worklistId) {
        throw new Error(
          'Failed to extract worklistId from ATC worklist response (expected 32-char GUID)',
        );
      }

      this.logger?.info?.(`ATC worklist created: ${worklistId}`);
      const objectUri = buildAtcObjectUri(
        config.objectType,
        config.objectName,
      );
      const runResponse = await startAtcRun(
        this.connection,
        worklistId,
        objectUri,
        config.options?.maxFindings ?? 100,
      );
      const runId = extractAtcRunId(runResponse);
      if (!runId) {
        throw new Error(
          'Failed to extract runId from ATC run response (missing Location header)',
        );
      }

      this.logger?.info?.(`ATC run started: ${runId}`);
      this.lastWorklistId = worklistId;
      this.lastRunId = runId;
      this.lastCheckVariant = checkVariant;
      this.state = {
        worklistId,
        runId,
        checkVariant,
        errors: [],
      };
      return this.state;
    } catch (error: unknown) {
      this.logger?.error?.('ATC create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read ATC run state: poll status and, when worklistId is provided and the run
   * has finished, fetch findings. Returns undefined when the run does not exist.
   */
  async read(
    config: Partial<IAtcConfig>,
    _version: 'active' | 'inactive' = 'active',
  ): Promise<IAtcState | undefined> {
    const runId = config.runId ?? this.lastRunId;
    if (!runId) {
      throw new Error('runId is required to read ATC run state');
    }

    try {
      const statusResponse = await getAtcRunStatus(
        this.connection,
        runId,
        true,
      );

      let findingsResponse: AxiosResponse | undefined;
      const worklistId = config.worklistId ?? this.lastWorklistId;
      const statusBody =
        typeof statusResponse.data === 'string' ? statusResponse.data : '';
      const isFinished = statusBody.includes('status="finished"');
      if (worklistId && isFinished) {
        try {
          findingsResponse = await getAtcWorklistFindings(
            this.connection,
            worklistId,
            {
              format: config.findingsFormat,
              includeExemptedFindings: config.includeExemptedFindings,
            },
          );
        } catch (error: unknown) {
          this.logger?.info?.(
            'ATC findings not available yet:',
            safeErrorMessage(error),
          );
        }
      }

      this.state = {
        ...this.state,
        runId,
        worklistId,
        runStatus: statusResponse.data,
        findings: findingsResponse?.data,
        errors: [],
      };
      return this.state;
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * ATC has no separate metadata vs read distinction; delegate to read.
   */
  async readMetadata(config: Partial<IAtcConfig>): Promise<IAtcState> {
    const result = await this.read(config);
    if (!result) {
      throw new Error('ATC run not found');
    }
    return result;
  }

  async update(
    _config: Partial<IAtcConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<IAtcState> {
    throw new Error('Update operation is not supported for ATC runs');
  }

  async delete(_config: Partial<IAtcConfig>): Promise<IAtcState> {
    throw new Error('Delete operation is not supported for ATC runs');
  }

  async activate(_config: Partial<IAtcConfig>): Promise<IAtcState> {
    throw new Error('Activate operation is not supported for ATC runs');
  }

  async check(
    _config: Partial<IAtcConfig>,
    _status?: string,
  ): Promise<IAtcState> {
    throw new Error('Check operation is not supported for ATC runs');
  }

  async readTransport(_config: Partial<IAtcConfig>): Promise<IAtcState> {
    return { errors: [] };
  }

  async lock(_config: Partial<IAtcConfig>): Promise<string> {
    throw new Error('Lock operation is not supported for ATC runs');
  }

  async unlock(
    _config: Partial<IAtcConfig>,
    _lockHandle: string,
  ): Promise<IAtcState> {
    throw new Error('Unlock operation is not supported for ATC runs');
  }

  /**
   * Convenience: run ATC end-to-end and return findings when available.
   * Creates a worklist + run, polls until status === 'finished' (or 'cancelled'),
   * then fetches findings. Throws on cancellation or poll timeout.
   */
  async run(
    objectType: AtcObjectType,
    objectName: string,
    options?: IAtcRunOptions & IAtcFindingsOptions & IAtcPollOptions,
  ): Promise<IAtcState> {
    await this.create({
      objectName,
      objectType,
      options: {
        checkVariant: options?.checkVariant,
        maxFindings: options?.maxFindings,
      },
    });
    if (!this.lastRunId) {
      throw new Error('ATC create did not yield a runId');
    }
    await this.pollUntilFinished(this.lastRunId, options);
    return (await this.read({
      runId: this.lastRunId,
      worklistId: this.lastWorklistId,
      findingsFormat: options?.format,
      includeExemptedFindings: options?.includeExemptedFindings,
    })) as IAtcState;
  }

  /**
   * Poll the run status until it reports 'finished'.
   * Throws on 'cancelled' or after maxPolls intervals elapse.
   */
  async pollUntilFinished(
    runId: string,
    options?: IAtcPollOptions,
  ): Promise<void> {
    const interval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxPolls = options?.maxPolls ?? DEFAULT_MAX_POLLS;
    for (let i = 0; i < maxPolls; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      const response = await getAtcRunStatus(this.connection, runId, true);
      const body =
        typeof response.data === 'string' ? response.data : '';
      if (body.includes('status="finished"')) {
        return;
      }
      if (body.includes('status="cancelled"')) {
        throw new Error(`ATC run ${runId} was cancelled`);
      }
    }
    throw new Error(
      `ATC run ${runId} did not finish within ${maxPolls * interval}ms`,
    );
  }

  /**
   * Convenience read: status by runId.
   */
  async getStatus(
    runId: string,
    withLongPolling: boolean = true,
  ): Promise<AxiosResponse> {
    return getAtcRunStatus(this.connection, runId, withLongPolling);
  }

  /**
   * Convenience read: findings by worklistId.
   */
  async getFindings(
    worklistId: string,
    options?: { format?: AtcFindingsFormat; includeExemptedFindings?: boolean },
  ): Promise<AxiosResponse> {
    return getAtcWorklistFindings(this.connection, worklistId, options);
  }

  /**
   * Convenience read: list available check variants.
   */
  async listVariants(
    options?: IAtcListVariantsOptions,
  ): Promise<AxiosResponse> {
    return listAtcVariants(this.connection, options);
  }

  /**
   * Convenience read: resolve the system default check variant via customizing.
   * Returns null when no system default is configured (caller must supply variant).
   */
  async getSystemDefaultVariant(): Promise<string | null> {
    try {
      const response = await getAtcCustomizing(this.connection);
      const body =
        typeof response.data === 'string' ? response.data : undefined;
      return parseSystemDefaultVariant(body);
    } catch (error: unknown) {
      this.logger?.warn?.(
        'Could not fetch ATC system default variant:',
        safeErrorMessage(error),
      );
      return null;
    }
  }

  getRunId(): string | undefined {
    return this.lastRunId;
  }

  getWorklistId(): string | undefined {
    return this.lastWorklistId;
  }

  getCheckVariant(): string | undefined {
    return this.lastCheckVariant;
  }

  protected async resolveCheckVariant(): Promise<string | null> {
    const variant = await this.getSystemDefaultVariant();
    if (variant) {
      this.logger?.info?.(`Using system default ATC variant: ${variant}`);
    }
    return variant;
  }

  // ATC runs are transient check executions, not versioned source objects;
  // the IAdtObject version-history contract does not apply.
  async getVersions(_config: Partial<IAtcConfig>): Promise<IObjectVersion[]> {
    throwUnsupportedVersions('ATC');
  }

  async getVersionSource(_contentUri: string): Promise<string> {
    throwUnsupportedVersions('ATC');
  }
}
