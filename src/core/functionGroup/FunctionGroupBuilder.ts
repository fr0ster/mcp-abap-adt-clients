/**
 * FunctionGroupBuilder - Fluent API for function group operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.validate().then(b => b.create()).then(b => b.lock())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { validateFunctionGroupName } from './validation';
import { create } from './create';
import { CreateFunctionGroupParams, FunctionGroupBuilderConfig, FunctionGroupBuilderState } from './types';
import { lockFunctionGroup } from './lock';
import { unlockFunctionGroup } from './unlock';
import { activateFunctionGroup } from './activation';
import { deleteFunctionGroup } from './delete';
import { checkFunctionGroup } from './check';
import { getFunctionGroup } from './read';
import { IBuilder } from '../shared/IBuilder';
import { XMLParser } from 'fast-xml-parser';

export class FunctionGroupBuilder implements IBuilder<FunctionGroupBuilderState> {
  private connection: IAbapConnection;
  private logger: IAdtLogger;
  private config: FunctionGroupBuilderConfig;
  private lockHandle?: string;
  private state: FunctionGroupBuilderState;

  constructor(
    connection: IAbapConnection,
    logger: IAdtLogger,
    config: FunctionGroupBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger.debug?.('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger.debug?.('Transport request set:', transportRequest);
    return this;
  }

  setName(functionGroupName: string): this {
    this.config.functionGroupName = functionGroupName;
    this.logger.debug?.('Function group name set:', functionGroupName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger.info?.('Validating function group:', this.config.functionGroupName);
      const result = await validateFunctionGroupName(
        this.connection,
        this.config.functionGroupName,
        this.config.packageName,
        this.config.description
      );
      // Store raw response for backward compatibility
      this.state.validationResponse = result;
      this.logger.info?.('Validation successful');
      return result;
    } catch (error: any) {
      // For validation, HTTP 400 might indicate object exists or validation error - store response for analysis
      if (error.response && error.response.status === 400) {
        this.state.validationResponse = error.response;
        this.logger.info?.('Function group validation returned 400 - object may already exist or validation error');
        return error.response;
      }
      // Store error response if available
      if (error.response) {
        this.state.validationResponse = error.response;
      }
      
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Creating function group:', this.config.functionGroupName);
      
      // Call low-level create function
      const params: CreateFunctionGroupParams = {
        functionGroupName: this.config.functionGroupName,
        description: this.config.description || '',
        packageName: this.config.packageName,
        transportRequest: this.config.transportRequest
      };
      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Function group created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      logErrorSafely(this.logger, 'Create', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking function group:', this.config.functionGroupName);
      const lockHandle = await lockFunctionGroup(
        this.connection,
        this.config.functionGroupName,
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger.info?.('Function group locked, handle:', lockHandle);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    try {
      this.logger.info?.('Checking function group:', this.config.functionGroupName, 'version:', version);
      const result = await checkFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        version,
        sourceCode,
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger.info?.('Function group check successful:', result.status);
      return result;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Check failed:', error);
      throw error;
    }
  }

  async update(): Promise<this> {
    // Function groups don't have a direct update endpoint
    // Updates are done through function modules within the group
    this.logger.warn?.('Update not supported for function groups. Use function module builders instead.');
    return this;
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Function group is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking function group:', this.config.functionGroupName);
      const result = await unlockFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Function group unlocked successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger.info?.('Activating function group:', this.config.functionGroupName);
      const result = await activateFunctionGroup(
        this.connection,
        this.config.functionGroupName
      );
      this.state.activateResult = result;
      this.logger.info?.('Function group activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting function group:', this.config.functionGroupName);
      const result = await deleteFunctionGroup(
        this.connection,
        {
          function_group_name: this.config.functionGroupName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Function group deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(): Promise<FunctionGroupBuilderConfig | undefined> {
    try {
      this.logger.info?.('Reading function group:', this.config.functionGroupName);
      const result = await getFunctionGroup(this.connection, this.config.functionGroupName);
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger.info?.('Function group read successfully:', result.status);
      
      // Parse and return config directly
      const xmlData = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      
      return this.parseFunctionGroupXml(xmlData);
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error);
      throw error;
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockFunctionGroup(
        this.connection,
        this.config.functionGroupName,
        this.lockHandle
      );
      this.logger.info?.('Force unlock successful for', this.config.functionGroupName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<FunctionGroupBuilderState> {
    return { ...this.state };
  }

  getFunctionGroupName(): string {
    return this.config.functionGroupName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  getValidationResponse(): AxiosResponse | undefined {
    return this.state.validationResponse;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getCheckResult(): AxiosResponse | undefined {
    return this.state.checkResult;
  }

  getUnlockResult(): AxiosResponse | undefined {
    return this.state.unlockResult;
  }

  getActivateResult(): AxiosResponse | undefined {
    return this.state.activateResult;
  }

  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }

  /**
   * Parse XML response to FunctionGroupBuilderConfig
   */
  private parseFunctionGroupXml(xmlData: string): FunctionGroupBuilderConfig | undefined {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });

      const result = parser.parse(xmlData);
      // Try both possible XML structures
      const functionGroup = result['fu:functionGroup'] || result['group:abapFunctionGroup'];

      if (!functionGroup) {
        return undefined;
      }

      const packageRef = functionGroup['adtcore:packageRef'] || functionGroup['packageRef'];

      return {
        functionGroupName: functionGroup['adtcore:name'] || this.config.functionGroupName,
        packageName: packageRef?.['adtcore:name'] || packageRef?.['name'],
        description: functionGroup['adtcore:description'] || ''
      };
    } catch (error) {
      this.logger.error?.('Failed to parse function group XML:', error);
      return undefined;
    }
  }

  getReadResult(): FunctionGroupBuilderConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    const xmlData = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return this.parseFunctionGroupXml(xmlData);
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    validation?: AxiosResponse;
    create?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    read?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validation: this.state.validationResponse,
      create: this.state.createResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      read: this.state.readResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}

