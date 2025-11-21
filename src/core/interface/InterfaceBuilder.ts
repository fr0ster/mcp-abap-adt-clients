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

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { validateInterfaceName } from './validation';
import { create as createInterfaceObject, generateInterfaceTemplate } from './create';
import { lockInterface } from './lock';
import { ValidationResult } from '../shared/validation';
import { checkInterface } from './check';
import { unlockInterface } from './unlock';
import { activateInterface } from './activation';
import { deleteInterface } from './delete';
import { getInterfaceSource } from './read';

export interface InterfaceBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface InterfaceBuilderConfig {
  interfaceName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  sourceCode?: string;
  sessionId?: string;
  // Optional callback to register lock in persistent storage
  // Called after successful lock() with: lockHandle, sessionId
  onLock?: (lockHandle: string, sessionId: string) => void;
}

export interface InterfaceBuilderState {
  validationResult?: ValidationResult;
  createResult?: AxiosResponse;
  lockHandle?: string;
  updateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  deleteResult?: AxiosResponse;
  readResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class InterfaceBuilder {
  private connection: AbapConnection;
  private logger: InterfaceBuilderLogger;
  private config: InterfaceBuilderConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private sessionId: string;
  private state: InterfaceBuilderState;

  constructor(
    connection: AbapConnection,
    logger: InterfaceBuilderLogger,
    config: InterfaceBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sourceCode = config.sourceCode;
    this.sessionId = config.sessionId || generateSessionId();
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

  setName(interfaceName: string): this {
    this.config.interfaceName = interfaceName;
    this.logger.debug?.('Interface name set:', interfaceName);
    return this;
  }

  setCode(sourceCode: string): this {
    this.sourceCode = sourceCode;
    this.logger.debug?.('Source code set, length:', sourceCode.length);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating interface:', this.config.interfaceName);
      const result = await validateInterfaceName(
        this.connection,
        this.config.interfaceName,
        this.config.description
      );
      this.state.validationResult = result;
      this.logger.info?.('Validation successful:', result.valid);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error);
      throw error; // Interrupts chain
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Creating interface object:', this.config.interfaceName);
      
      const finalDescription = this.config.description || this.config.interfaceName;
      
      // Call low-level function
      const result = await createInterfaceObject(
        this.connection,
        this.config.interfaceName,
        finalDescription,
        this.config.packageName,
        this.config.transportRequest,
        this.sessionId
      );
      
      this.state.createResult = result;
      this.logger.info?.('Interface object created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Create failed:', error);
      throw error;
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking interface:', this.config.interfaceName);
      const lockData = await lockInterface(
        this.connection,
        this.config.interfaceName,
        this.sessionId
      );
      this.lockHandle = lockData.lockHandle;
      this.state.lockHandle = lockData.lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockData.lockHandle, this.sessionId);
      }

      this.logger.info?.('Interface locked, handle:', lockData.lockHandle.substring(0, 10) + '...');
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

  async update(sourceCode?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Interface must be locked before update. Call lock() first.');
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error('Source code is required. Use setCode() or pass as parameter.');
      }
      this.logger.info?.('Updating interface source:', this.config.interfaceName);
      
      const encodedName = this.config.interfaceName.toLowerCase();
      let url = `/sap/bc/adt/oo/interfaces/${encodedName}/source/main?lockHandle=${this.lockHandle}`;
      if (this.config.transportRequest) {
        url += `&corrNr=${this.config.transportRequest}`;
      }

      const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'text/plain'
      };

      const result = await makeAdtRequestWithSession(this.connection, url, 'PUT', this.sessionId, code, headers);
      
      this.state.updateResult = result;
      this.logger.info?.('Interface updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update failed:', error);
      throw error;
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    try {
      this.logger.info?.('Checking interface:', this.config.interfaceName, 'version:', version);
      const result = await checkInterface(
        this.connection,
        this.config.interfaceName,
        version,
        this.sessionId
      );
      this.state.checkResult = result;
      this.logger.info?.('Interface check successful:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Check failed:', error);
      throw error; // Interrupts chain
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Interface is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking interface:', this.config.interfaceName);
      const result = await unlockInterface(
        this.connection,
        this.config.interfaceName,
        this.lockHandle,
        this.sessionId
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Interface unlocked successfully');
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
      this.logger.info?.('Activating interface:', this.config.interfaceName);
      const result = await activateInterface(
        this.connection,
        this.config.interfaceName,
        this.sessionId
      );
      this.state.activateResult = result;
      this.logger.info?.('Interface activated successfully:', result.status);
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
      this.logger.info?.('Deleting interface:', this.config.interfaceName);
      const result = await deleteInterface(
        this.connection,
        {
          interface_name: this.config.interfaceName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Interface deleted successfully:', result.status);
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

  async read(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Reading interface:', this.config.interfaceName);
      const result = await getInterfaceSource(this.connection, this.config.interfaceName);
      this.state.readResult = result;
      this.logger.info?.('Interface read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error);
      throw error; // Interrupts chain
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
        this.lockHandle,
        this.sessionId
      );
      this.logger.info?.('Force unlock successful for', this.config.interfaceName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<InterfaceBuilderState> {
    return { ...this.state };
  }

  getInterfaceName(): string {
    return this.config.interfaceName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getValidationResult(): ValidationResult | undefined {
    return this.state.validationResult;
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

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    validation?: ValidationResult;
    create?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validation: this.state.validationResult,
      create: this.state.createResult,
      update: this.state.updateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}

