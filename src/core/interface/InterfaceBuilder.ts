/**
 * InterfaceBuilder - Fluent API for interface operations with Promise chaining
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
import { getTimeout } from '../../utils/timeouts';
import { ILogger } from '@mcp-abap-adt/interfaces';
import { validateInterfaceName } from './validation';
import { create as createInterfaceObject, generateInterfaceTemplate } from './create';
import { lockInterface } from './lock';
import { checkInterface } from './check';
import { unlockInterface } from './unlock';
import { activateInterface } from './activation';
import { deleteInterface } from './delete';
import { getInterfaceSource } from './read';
import { get } from 'http';
import { ICreateInterfaceParams, IInterfaceConfig, IInterfaceState } from './types';
import { IBuilder } from '../shared/IBuilder';

export class InterfaceBuilder implements IBuilder<IInterfaceState> {
  private connection: IAbapConnection;
  private logger?: ILogger;
  private config: IInterfaceConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private state: IInterfaceState;

  constructor(
    connection: IAbapConnection,
    config: IInterfaceConfig,
    logger?: ILogger
  ) {
    this.connection = connection;
    this.logger = logger || (undefined as unknown as ILogger);
    this.config = { ...config };
    this.sourceCode = config.sourceCode;
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger?.debug('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger?.debug('Transport request set:', transportRequest);
    return this;
  }

  setName(interfaceName: string): this {
    this.config.interfaceName = interfaceName;
    this.logger?.debug('Interface name set:', interfaceName);
    return this;
  }

  setCode(sourceCode: string): this {
    this.sourceCode = sourceCode;
    this.logger?.debug(`'Source code set  length:' ${`sourceCode.length`}`);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger?.info('Validating interface:', this.config.interfaceName);
      const response = await validateInterfaceName(
        this.connection,
        this.config.interfaceName,
        this.config.packageName,
        this.config.description
      );
      
      // Store raw response for backward compatibility
      this.state.validationResponse = response;
      this.logger?.info('Validation successful');
      return response;
    } catch (error: any) {
      // For validation, HTTP 400 might indicate object exists - store response for analysis
      if (error.response && error.response.status === 400) {
        this.state.validationResponse = error.response;
        this.logger?.info('Interface validation returned 400 - object may already exist');
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
      this.logger?.error('Validation failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger?.info('Creating interface object:', this.config.interfaceName);
      
      const finalDescription = this.config.description || this.config.interfaceName;
      
      // Call low-level function
      const params: ICreateInterfaceParams = {
        interfaceName: this.config.interfaceName,
        description: finalDescription,
        packageName: this.config.packageName,
        transportRequest: this.config.transportRequest
      };
      const result = await createInterfaceObject(this.connection, params);
      
      this.state.createResult = result;
      this.logger?.info('Interface object created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger?.info('Locking interface:', this.config.interfaceName);
      
      // Enable stateful session mode
      this.connection.setSessionType("stateful");

      const lockData = await lockInterface(
        this.connection,
        this.config.interfaceName
      );
      this.lockHandle = lockData.lockHandle;
      this.state.lockHandle = lockData.lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockData.lockHandle);
      }

      this.logger?.info(`'Interface locked  handle:' ${`lockData.lockHandle`}`);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async update(sourceCode?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Interface must be locked before update. Call lock() first.');
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error('Source code is required. Use setCode() or pass as parameter.');
      }
      this.logger?.info('Updating interface source:', this.config.interfaceName);
      
      const encodedName = this.config.interfaceName.toLowerCase();
      let url = `/sap/bc/adt/oo/interfaces/${encodedName}/source/main?lockHandle=${this.lockHandle}`;
      if (this.config.transportRequest) {
        url += `&corrNr=${this.config.transportRequest}`;
      }

      const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'text/plain'
      };

      const result = await this.connection.makeAdtRequest({url, method: 'PUT', timeout: getTimeout(), data: code, headers});
      
      this.state.updateResult = result;
      this.logger?.info('Interface updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    try {
      const codeToCheck = sourceCode || this.config.sourceCode;
      this.logger?.info(`'Checking interface:'  this.config.interfaceName  'version:' ${`version, codeToCheck ? 'with source code' : 'saved version'`}`);
      const result = await checkInterface(
        this.connection,
        this.config.interfaceName,
        version,
        codeToCheck
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger?.info('Interface check successful:', result.status);
      return result;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Check failed:', error);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Interface is not locked. Call lock() first.');
      }
      this.logger?.info('Unlocking interface:', this.config.interfaceName);
      const result = await unlockInterface(
        this.connection,
        this.config.interfaceName,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger?.info('Interface unlocked successfully');
      
      // Enable stateless session mode
      this.connection.setSessionType("stateless");

      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger?.info('Activating interface:', this.config.interfaceName);
      const result = await activateInterface(
        this.connection,
        this.config.interfaceName
      );
      this.state.activateResult = result;
      this.logger?.info('Interface activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }


  async delete(): Promise<this> {
    try {
      this.logger?.info('Deleting interface:', this.config.interfaceName);
      const result = await deleteInterface(
        this.connection,
        {
          interface_name: this.config.interfaceName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger?.info('Interface deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(version: 'active' | 'inactive' = 'active'): Promise<IInterfaceConfig | undefined> {
    try {
      this.logger?.info('Reading interface:', this.config.interfaceName);
      const result = await getInterfaceSource(this.connection, this.config.interfaceName);
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger?.info('Interface read successfully:', result.status);
      
      // Parse and return config directly
      const sourceCode = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      
      return {
        interfaceName: this.config.interfaceName,
        sourceCode
      };
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Read failed:', error);
      throw error;
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockInterface(
        this.connection,
        this.config.interfaceName,
        this.lockHandle
      );
      this.logger?.info('Force unlock successful for', this.config.interfaceName);
    } catch (error: any) {
      this.logger?.warn('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<IInterfaceState> {
    return { ...this.state };
  }

  getInterfaceName(): string {
    return this.config.interfaceName;
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

  getUpdateResult(): AxiosResponse | undefined {
    return this.state.updateResult;
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

  getReadResult(): IInterfaceConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    // Interface read() returns source code (plain text)
    const sourceCode = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return {
      interfaceName: this.config.interfaceName,
      sourceCode
    };
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    validation?: AxiosResponse;
    create?: AxiosResponse;
    update?: AxiosResponse;
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
      update: this.state.updateResult,
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

