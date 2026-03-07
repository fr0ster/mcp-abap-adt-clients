/**
 * AdtUnitTestLegacy - Unit test operations for legacy SAP systems (BASIS < 7.50)
 *
 * Extends AdtUnitTest and overrides run/status/result to use legacy endpoints:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml content types instead of versioned vnd.sap.adt.api.abapunit.* types
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { headerValueToString } from '../../utils/internalUtils';
import { AdtUnitTest } from './AdtUnitTest';
import {
  getClassUnitTestResultLegacy,
  getClassUnitTestStatusLegacy,
  startClassUnitTestRunLegacy,
} from './runLegacy';
import type { IUnitTestConfig, IUnitTestState } from './types';

export class AdtUnitTestLegacy extends AdtUnitTest {
  constructor(connection: IAbapConnection, logger?: ILogger) {
    super(connection, logger);
  }

  /**
   * Create unit test run using legacy endpoint
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

      const runId = this.extractRunId(response);

      if (!runId) {
        this.logger?.error?.(
          'Failed to extract run ID from response. Response data:',
          response.data,
        );
        throw new Error('Failed to start unit test run: run ID not returned');
      }

      this.logger?.info?.('Unit test run started (legacy), run ID:', runId);
      this.lastRunId = runId;

      return {
        createResult: response,
        runId,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Create failed (legacy):', error);
      throw error;
    }
  }

  /**
   * Get unit test status using legacy endpoint
   */
  override async getStatus(
    runId: string,
    withLongPolling: boolean = true,
  ): Promise<AxiosResponse> {
    const response = await getClassUnitTestStatusLegacy(
      this.connection,
      runId,
      withLongPolling,
    );
    this.lastStatusResponse = response;
    return response;
  }

  /**
   * Get unit test result using legacy endpoint
   */
  override async getResult(
    runId: string,
    options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
  ): Promise<AxiosResponse> {
    const response = await getClassUnitTestResultLegacy(
      this.connection,
      runId,
      options,
    );
    this.lastResultResponse = response;
    return response;
  }

  /**
   * Extract run ID from legacy response
   * Legacy uses /testruns/ in URIs instead of /runs/
   */
  protected override extractRunId(response: AxiosResponse): string | undefined {
    // Try headers first
    const locationHeader =
      headerValueToString(response.headers?.location) ||
      headerValueToString(response.headers?.['content-location']) ||
      headerValueToString(response.headers?.['sap-adt-location']);
    if (locationHeader) {
      const match =
        locationHeader.match(/\/testruns\/([^/]+)/) ||
        locationHeader.match(/\/runs\/([^/]+)/);
      if (match) {
        return match[1];
      }
    }

    // Fallback: parse from response body (XML)
    const data = response.data;
    if (typeof data === 'string') {
      const uriMatch = data.match(/uri="([^"]+)"/);
      if (uriMatch) {
        const uri = uriMatch[1];
        const match =
          uri.match(/\/testruns\/([^/]+)/) || uri.match(/\/runs\/([^/]+)/);
        if (match) {
          return match[1];
        }
      }
    } else if (data?.uri) {
      const match =
        data.uri.match(/\/testruns\/([^/]+)/) ||
        data.uri.match(/\/runs\/([^/]+)/);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }
}
