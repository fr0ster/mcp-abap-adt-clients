/**
 * AdtUnitTest - High-level CRUD operations for Unit Test objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - No stateful needed for unit test operations
 * - Unit tests don't use lock/unlock
 *
 * Operation chains:
 * - Create: create (start test run)
 * - Read: read (get test run status/result)
 * - Update: not supported (test runs cannot be updated)
 * - Delete: not supported (test runs cannot be deleted)
 * - Activate: not supported (test runs are not activated)
 * - Check: not supported (test runs don't have check operation)
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { headerValueToString } from '../../utils/internalUtils';
import { AdtClass, AdtLocalTestClass } from '../class';
import { getClassUnitTestResult, getClassUnitTestStatus } from '../class/run';
import { startClassUnitTestRun } from './run';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestConfig,
  IUnitTestState,
} from './types';

export class AdtUnitTest
  implements IAdtObject<IUnitTestConfig, IUnitTestState>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  public readonly objectType: string = 'UnitTest';

  // Internal state for convenience methods
  protected lastRunId?: string;
  protected lastStatusResponse?: AxiosResponse;
  protected lastResultResponse?: AxiosResponse;
  protected state: IUnitTestState = { errors: [] };

  // AdtClass and AdtLocalTestClass for working with test classes
  protected adtClass: AdtClass;
  protected adtLocalTestClass: AdtLocalTestClass;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = new AdtClass(connection, logger);
    this.adtLocalTestClass = new AdtLocalTestClass(connection, logger);
  }

  /**
   * Validate unit test configuration before creation
   * Note: ADT doesn't provide validation endpoint for unit tests
   */
  async validate(config: Partial<IUnitTestConfig>): Promise<IUnitTestState> {
    if (!config.tests || config.tests.length === 0) {
      throw new Error(
        'At least one test definition is required for validation',
      );
    }

    // ADT doesn't provide validation endpoint for unit tests
    // Return a mock success response
    return {
      errors: [],
    };
  }

  /**
   * Create unit test run (start test execution)
   */
  async create(
    config: IUnitTestConfig,
    _options?: IAdtOperationOptions,
  ): Promise<IUnitTestState> {
    if (!config.tests || config.tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    try {
      this.logger?.info?.('Starting unit test run');
      const response = await startClassUnitTestRun(
        this.connection,
        config.tests,
        config.options,
      );

      // Log response for debugging
      this.logger?.debug?.('Unit test run response status:', response.status);
      this.logger?.debug?.(
        'Unit test run response data type:',
        typeof response.data,
      );
      if (typeof response.data === 'string') {
        this.logger?.debug?.(
          'Unit test run response data (first 500 chars):',
          response.data.substring(0, 500),
        );
      } else {
        this.logger?.debug?.(
          'Unit test run response data:',
          JSON.stringify(response.data),
        );
      }

      // Extract run ID from response
      // Response format: XML with aunit:run element containing uri attribute
      const runId = this.extractRunId(response);

      if (!runId) {
        this.logger?.error?.(
          'Failed to extract run ID from response. Response data:',
          response.data,
        );
        throw new Error('Failed to start unit test run: run ID not returned');
      }

      this.logger?.info?.('Unit test run started, run ID:', runId);
      this.lastRunId = runId;
      this.state.runId = runId;

      return {
        runId,
        errors: [],
      };
    } catch (error: any) {
      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read unit test run (get status or result)
   */
  async read(
    config: Partial<IUnitTestConfig>,
    _version: 'active' | 'inactive' = 'active',
  ): Promise<IUnitTestState | undefined> {
    if (!config.runId) {
      throw new Error('Test run ID is required');
    }

    try {
      // Read status
      const statusResponse = await getClassUnitTestStatus(
        this.connection,
        config.runId,
        true, // withLongPolling
      );

      // Read result if available
      let resultResponse: AxiosResponse | undefined;
      try {
        resultResponse = await getClassUnitTestResult(
          this.connection,
          config.runId,
        );
        this.lastResultResponse = resultResponse;
      } catch (_error) {
        // Result might not be available yet
        this.logger?.info?.('Test result not available yet');
      }

      this.lastStatusResponse = statusResponse;
      this.state.runId = config.runId;
      this.state.runStatus = statusResponse.data;
      this.state.runResult = resultResponse?.data;

      return {
        runId: config.runId,
        runStatus: statusResponse.data,
        runResult: resultResponse?.data,
        errors: [],
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read unit test metadata
   * For unit tests, metadata is the same as read() result (status/result information)
   */
  async readMetadata(
    config: Partial<IUnitTestConfig>,
  ): Promise<IUnitTestState> {
    // For unit tests, metadata is the same as read() result
    const readResult = await this.read(config);
    if (!readResult) {
      throw new Error('Unit test run not found');
    }
    return readResult;
  }

  /**
   * Update unit test run
   * Note: Test runs cannot be updated
   */
  async update(
    _config: Partial<IUnitTestConfig>,
    _options?: IAdtOperationOptions,
  ): Promise<IUnitTestState> {
    throw new Error(
      'Update operation is not supported for Unit Test objects in ADT',
    );
  }

  /**
   * Delete unit test run
   * Note: Test runs cannot be deleted via ADT
   */
  async delete(_config: Partial<IUnitTestConfig>): Promise<IUnitTestState> {
    throw new Error(
      'Delete operation is not supported for Unit Test objects in ADT',
    );
  }

  /**
   * Activate unit test run
   * Note: Test runs are not activated
   */
  async activate(_config: Partial<IUnitTestConfig>): Promise<IUnitTestState> {
    throw new Error(
      'Activate operation is not supported for Unit Test objects in ADT',
    );
  }

  /**
   * Check unit test run
   * Note: Test runs don't have check operation
   */
  async check(
    _config: Partial<IUnitTestConfig>,
    _status?: string,
  ): Promise<IUnitTestState> {
    throw new Error(
      'Check operation is not supported for Unit Test objects in ADT',
    );
  }

  /**
   * Run unit tests (convenience method that wraps create)
   */
  async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions,
  ): Promise<string> {
    const result = await this.create({
      tests,
      options,
    });
    this.lastRunId = result.runId;
    return result.runId!;
  }

  /**
   * Get run ID from last operation
   */
  getRunId(): string | undefined {
    return this.lastRunId;
  }

  /**
   * Get unit test status (convenience method)
   */
  async getStatus(
    runId: string,
    withLongPolling: boolean = true,
  ): Promise<AxiosResponse> {
    const response = await getClassUnitTestStatus(
      this.connection,
      runId,
      withLongPolling,
    );
    this.lastStatusResponse = response;
    return response;
  }

  /**
   * Get status response from last getStatus call
   */
  getStatusResponse(): AxiosResponse | undefined {
    return this.lastStatusResponse;
  }

  /**
   * Get unit test result (convenience method)
   */
  async getResult(
    runId: string,
    options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
  ): Promise<AxiosResponse> {
    const response = await getClassUnitTestResult(
      this.connection,
      runId,
      options,
    );
    this.lastResultResponse = response;
    return response;
  }

  /**
   * Get result response from last getResult call
   */
  getResultResponse(): AxiosResponse | undefined {
    return this.lastResultResponse;
  }

  /**
   * Extract run ID from unit test run response
   */
  protected extractRunId(response: AxiosResponse): string | undefined {
    // First, try to extract from response headers (most reliable)
    const locationHeader =
      headerValueToString(response.headers?.location) ||
      headerValueToString(response.headers?.['content-location']) ||
      headerValueToString(response.headers?.['sap-adt-location']);
    if (locationHeader) {
      const runIdMatch = locationHeader.match(/\/runs\/([^/]+)/);
      if (runIdMatch) {
        return runIdMatch[1];
      }
    }

    // Fallback: parse from response body (XML)
    // Response is XML with aunit:run element
    // URI format: /sap/bc/adt/abapunit/runs/{runId}
    const data = response.data;
    if (typeof data === 'string') {
      // Parse XML to extract URI
      const uriMatch = data.match(/uri="([^"]+)"/);
      if (uriMatch) {
        const uri = uriMatch[1];
        const runIdMatch = uri.match(/\/runs\/([^/]+)/);
        if (runIdMatch) {
          return runIdMatch[1];
        }
      }
      // Try alternative XML format
      const runMatch = data.match(/<aunit:run[^>]*uri="([^"]+)"/);
      if (runMatch) {
        const uri = runMatch[1];
        const runIdMatch = uri.match(/\/runs\/([^/]+)/);
        if (runIdMatch) {
          return runIdMatch[1];
        }
      }
    } else if (data?.uri) {
      const uri = data.uri;
      const runIdMatch = uri.match(/\/runs\/([^/]+)/);
      if (runIdMatch) {
        return runIdMatch[1];
      }
    }
    return undefined;
  }

  /**
   * Read transport request information for unit test
   * Note: Unit tests are test runs, not ADT objects, so they don't have transport requests
   */
  async readTransport(
    _config: Partial<IUnitTestConfig>,
  ): Promise<IUnitTestState> {
    // Unit tests are test runs, not ADT objects, so they don't have transport requests
    // Return empty state
    return {
      errors: [],
    };
  }

  /**
   * Lock unit test (not supported)
   */
  async lock(_config: Partial<IUnitTestConfig>): Promise<string> {
    throw new Error('Lock operation is not supported for unit tests');
  }

  /**
   * Unlock unit test (not supported)
   */
  async unlock(
    _config: Partial<IUnitTestConfig>,
    _lockHandle: string,
  ): Promise<IUnitTestState> {
    throw new Error('Unlock operation is not supported for unit tests');
  }
}
