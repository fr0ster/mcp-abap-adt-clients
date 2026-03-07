/**
 * AdtUnitTestLegacy - Unit test operations for legacy SAP systems (BASIS < 7.50)
 *
 * Extends AdtUnitTest and overrides run/status/result to use legacy endpoints:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml content types instead of versioned vnd.sap.adt.api.abapunit.* types
 *
 * Key difference: Legacy systems return results synchronously (aunit:runResult)
 * from the POST to /testruns — no run ID, no async polling needed.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtUnitTest } from './AdtUnitTest';
import { startClassUnitTestRunLegacy } from './runLegacy';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestConfig,
  IUnitTestState,
} from './types';

/** Synthetic run ID for legacy synchronous results */
const LEGACY_SYNC_RUN_ID = 'legacy-sync';

export class AdtUnitTestLegacy extends AdtUnitTest {
  constructor(connection: IAbapConnection, logger?: ILogger) {
    super(connection, logger);
  }

  /**
   * Create unit test run using legacy endpoint.
   * Legacy returns results synchronously — no run ID or polling needed.
   */
  override async create(
    config: IUnitTestConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IUnitTestState> {
    if (!config.tests || config.tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    try {
      this.logger?.info?.('Starting unit test run (legacy)');
      const response = await startClassUnitTestRunLegacy(
        this.connection,
        config.tests,
        config.options,
      );

      this.logger?.debug?.('Unit test run response status:', response.status);

      // Legacy returns results synchronously — store as both status and result
      this.lastStatusResponse = response;
      this.lastResultResponse = response;

      this.lastRunId = LEGACY_SYNC_RUN_ID;
      this.logger?.info?.('Unit test run completed (legacy, synchronous)');

      return {
        createResult: response,
        runId: LEGACY_SYNC_RUN_ID,
        runResult: response.data,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Create failed (legacy):', error);
      throw error;
    }
  }

  /**
   * Run unit tests — legacy returns results synchronously.
   */
  override async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions,
  ): Promise<string> {
    await this.create({ tests, options });
    return LEGACY_SYNC_RUN_ID;
  }

  /**
   * Get unit test status — legacy returns results synchronously,
   * so this returns the cached response from create().
   */
  override async getStatus(
    _runId: string,
    _withLongPolling: boolean = true,
  ): Promise<AxiosResponse> {
    if (this.lastStatusResponse) {
      return this.lastStatusResponse;
    }
    throw new Error(
      'No status available. Legacy systems return results synchronously via create().',
    );
  }

  /**
   * Get unit test result — legacy returns results synchronously,
   * so this returns the cached response from create().
   */
  override async getResult(
    _runId: string,
    _options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
  ): Promise<AxiosResponse> {
    if (this.lastResultResponse) {
      return this.lastResultResponse;
    }
    throw new Error(
      'No result available. Legacy systems return results synchronously via create().',
    );
  }

  /**
   * Read unit test — legacy returns results synchronously,
   * so this returns the cached result from create().
   */
  override async read(
    _config: Partial<IUnitTestConfig>,
    _version: 'active' | 'inactive' = 'active',
  ): Promise<IUnitTestState | undefined> {
    if (!this.lastResultResponse) {
      return undefined;
    }
    return {
      runId: LEGACY_SYNC_RUN_ID,
      runStatus: this.lastStatusResponse?.data,
      runResult: this.lastResultResponse.data,
      errors: [],
    };
  }
}
