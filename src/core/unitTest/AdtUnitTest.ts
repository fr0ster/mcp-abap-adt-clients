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

import { IAbapConnection, IAdtObject, IAdtOperationOptions, IUnitTestBuilderConfig, IClassUnitTestDefinition, IClassUnitTestRunOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { startClassUnitTestRun } from './run';
import { getClassUnitTestStatus, getClassUnitTestResult } from '../class/run';

export class AdtUnitTest implements IAdtObject<IUnitTestBuilderConfig, IUnitTestBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'UnitTest';

  // Internal state for convenience methods
  private lastRunId?: string;
  private lastStatusResponse?: AxiosResponse;
  private lastResultResponse?: AxiosResponse;

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate unit test configuration before creation
   * Note: ADT doesn't provide validation endpoint for unit tests
   */
  async validate(config: Partial<IUnitTestBuilderConfig>): Promise<IUnitTestBuilderConfig> {
    if (!config.tests || config.tests.length === 0) {
      throw new Error('At least one test definition is required for validation');
    }

    // ADT doesn't provide validation endpoint for unit tests
    // Return a mock success response
    return {
      tests: config.tests,
      options: config.options,
      runId: undefined,
      status: undefined,
      result: undefined
    };
  }

  /**
   * Create unit test run (start test execution)
   */
  async create(
    config: IUnitTestBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<IUnitTestBuilderConfig> {
    if (!config.tests || config.tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    try {
      this.logger?.info?.('Starting unit test run');
      const response = await startClassUnitTestRun(
        this.connection,
        config.tests,
        config.options
      );

      // Extract run ID from response
      // Response format: XML with aunit:run element containing uri attribute
      const runId = this.extractRunId(response);

      if (!runId) {
        throw new Error('Failed to start unit test run: run ID not returned');
      }

      this.logger?.info?.('Unit test run started, run ID:', runId);

      return {
        tests: config.tests,
        options: config.options,
        runId
      };
    } catch (error: any) {
      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read unit test run (get status or result)
   */
  async read(
    config: Partial<IUnitTestBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IUnitTestBuilderConfig | undefined> {
    if (!config.runId) {
      throw new Error('Test run ID is required');
    }

    try {
      // Read status
      const statusResponse = await getClassUnitTestStatus(
        this.connection,
        config.runId,
        true // withLongPolling
      );

      // Read result if available
      let resultResponse: AxiosResponse | undefined;
      try {
        resultResponse = await getClassUnitTestResult(this.connection, config.runId);
      } catch (error) {
        // Result might not be available yet
        this.logger?.info?.('Test result not available yet');
      }

      return {
        tests: config.tests || [],
        options: config.options,
        runId: config.runId,
        status: statusResponse.data,
        result: resultResponse?.data
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
  async readMetadata(config: Partial<IUnitTestBuilderConfig>): Promise<IUnitTestBuilderConfig> {
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
    config: Partial<IUnitTestBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<IUnitTestBuilderConfig> {
    throw new Error('Update operation is not supported for Unit Test objects in ADT');
  }

  /**
   * Delete unit test run
   * Note: Test runs cannot be deleted via ADT
   */
  async delete(config: Partial<IUnitTestBuilderConfig>): Promise<IUnitTestBuilderConfig> {
    throw new Error('Delete operation is not supported for Unit Test objects in ADT');
  }

  /**
   * Activate unit test run
   * Note: Test runs are not activated
   */
  async activate(config: Partial<IUnitTestBuilderConfig>): Promise<IUnitTestBuilderConfig> {
    throw new Error('Activate operation is not supported for Unit Test objects in ADT');
  }

  /**
   * Check unit test run
   * Note: Test runs don't have check operation
   */
  async check(
    config: Partial<IUnitTestBuilderConfig>,
    status?: string
  ): Promise<IUnitTestBuilderConfig> {
    throw new Error('Check operation is not supported for Unit Test objects in ADT');
  }

  /**
   * Run unit tests (convenience method that wraps create)
   */
  async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions
  ): Promise<string> {
    const result = await this.create({
      tests,
      options
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
    withLongPolling: boolean = true
  ): Promise<AxiosResponse> {
    const response = await getClassUnitTestStatus(
      this.connection,
      runId,
      withLongPolling
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
    options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' }
  ): Promise<AxiosResponse> {
    const response = await getClassUnitTestResult(
      this.connection,
      runId,
      options
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
  private extractRunId(response: AxiosResponse): string | undefined {
    // Response is XML with aunit:run element
    // URI format: /sap/bc/adt/abapunit/runs/{runId}
    const data = response.data;
    if (typeof data === 'string') {
      // Parse XML to extract URI
      const uriMatch = data.match(/uri="([^"]+)"/);
      if (uriMatch) {
        const uri = uriMatch[1];
        const runIdMatch = uri.match(/\/runs\/([^\/]+)/);
        if (runIdMatch) {
          return runIdMatch[1];
        }
      }
    } else if (data?.uri) {
      const uri = data.uri;
      const runIdMatch = uri.match(/\/runs\/([^\/]+)/);
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
  async readTransport(config: Partial<IUnitTestBuilderConfig>): Promise<IUnitTestBuilderConfig> {
    // Unit tests are test runs, not ADT objects, so they don't have transport requests
    // Return empty config with error indication
    return {
      tests: config.tests || [],
      options: config.options,
      runId: undefined,
      status: undefined,
      result: undefined
    };
  }
}
