/**
 * ClassBuilder - Fluent API for class operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.validate().then(b => b.create()).then(b => b.lock())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * @example
 * ```typescript
 * const builder = new ClassBuilder(connection, logger, {
 *   className: 'ZCL_TEST',
 *   packageName: 'ZOK_TEST_PKG_01'
 * })
 *   .setCode('CLASS ZCL_TEST DEFINITION...');
 *
 * await builder
 *   .validate()
 *   .then(b => b.create())
 *   .then(b => b.lock())
 *   .then(b => b.update())
 *   .then(b => b.check())
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *     // Handle error
 *   })
 *   .finally(() => {
 *     // Cleanup - always executes
 *   });
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { generateSessionId } from '../../utils/sessionUtils';
import { validateClassName, ValidationResult } from './validation';
import { createClass, CreateClassParams } from './create';
import { getClassSource, getClassMetadata } from './read';
import { lockClass } from './lock';
import { updateClass } from './update';
import { checkClass } from './check';
import { unlockClass } from './unlock';
import { activateClass } from './activation';

export interface ClassBuilderConfig {
  className: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  createProtected?: boolean;
  masterSystem?: string;
  responsible?: string;
}

export interface ClassBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface ClassBuilderState {
  validationResult?: ValidationResult;
  createResult?: AxiosResponse;
  readResult?: AxiosResponse;
  metadataResult?: AxiosResponse;
  lockHandle?: string;
  updateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class ClassBuilder {
  private connection: AbapConnection;
  private logger: ClassBuilderLogger;
  private config: ClassBuilderConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private sessionId: string;
  private state: ClassBuilderState;

  constructor(
    connection: AbapConnection,
    logger: ClassBuilderLogger,
    config: ClassBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sessionId = generateSessionId();
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

  setName(className: string): this {
    this.config.className = className;
    this.logger.debug?.('Class name set:', className);
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

  setSuperclass(superclass: string): this {
    this.config.superclass = superclass;
    return this;
  }

  setFinal(final: boolean): this {
    this.config.final = final;
    return this;
  }

  setAbstract(abstract: boolean): this {
    this.config.abstract = abstract;
    return this;
  }

  setCreateProtected(createProtected: boolean): this {
    this.config.createProtected = createProtected;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  // Chain is interrupted on error (standard Promise behavior)
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating class:', this.config.className);
      const result = await validateClassName(
        this.connection,
        this.config.className,
        this.config.packageName,
        this.config.description,
        this.config.superclass
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
      this.logger.info?.('Creating class:', this.config.className);
      const result = await createClass(this.connection, {
        class_name: this.config.className,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        superclass: this.config.superclass,
        final: this.config.final,
        abstract: this.config.abstract,
        create_protected: this.config.createProtected,
        master_system: this.config.masterSystem,
        responsible: this.config.responsible,
      });
      this.state.createResult = result;
      this.logger.info?.('Class created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Create failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Reading class source:', this.config.className, 'version:', version);
      const result = await getClassSource(this.connection, this.config.className, version);
      this.state.readResult = result;
      this.logger.info?.('Class source read successfully:', result.status, 'bytes:', result.data?.length || 0);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', {
        className: this.config.className,
        version,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error; // Interrupts chain
    }
  }

  async readMetadata(): Promise<this> {
    try {
      this.logger.info?.('Reading class metadata:', this.config.className);
      const result = await getClassMetadata(this.connection, this.config.className);
      this.state.metadataResult = result;
      this.logger.info?.('Class metadata read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readMetadata',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read metadata failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking class:', this.config.className);
      const lockHandle = await lockClass(
        this.connection,
        this.config.className,
        this.sessionId
      );
      this.lockHandle = lockHandle;
      this.logger.info?.('Class locked, handle:', lockHandle.substring(0, 10) + '...');
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
        throw new Error('Class must be locked before update. Call lock() first.');
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error('Source code is required. Use setCode() or pass as parameter.');
      }
      this.logger.info?.('Updating class source:', this.config.className);
      const result = await updateClass(
        this.connection,
        this.config.className,
        code,
        this.lockHandle,
        this.sessionId,
        this.config.transportRequest
      );
      this.state.updateResult = result;
      this.logger.info?.('Class updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive'): Promise<this> {
    try {
      this.logger.info?.('Checking class:', this.config.className, 'version:', version);
      const result = await checkClass(
        this.connection,
        this.config.className,
        version,
        this.sourceCode,
        this.sessionId
      );
      this.state.checkResult = result;
      this.logger.info?.('Class check successful:', result.status);
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
        throw new Error('Class is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking class:', this.config.className);
      const result = await unlockClass(
        this.connection,
        this.config.className,
        this.lockHandle,
        this.sessionId
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.logger.info?.('Class unlocked successfully:', result.status);
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
      this.logger.info?.('Activating class:', this.config.className);
      const result = await activateClass(
        this.connection,
        this.config.className,
        this.sessionId
      );
      this.state.activateResult = result;
      this.logger.info?.('Class activated successfully:', result.status);
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

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockClass(
        this.connection,
        this.config.className,
        this.lockHandle,
        this.sessionId
      );
      this.logger.info?.('Force unlock successful for', this.config.className);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<ClassBuilderState> {
    return { ...this.state };
  }

  getValidationResult(): ValidationResult | undefined {
    return this.state.validationResult;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getMetadataResult(): AxiosResponse | undefined {
    return this.state.metadataResult;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
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

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  getClassName(): string {
    return this.config.className;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // Helper method to get all results
  getResults(): {
    validation?: ValidationResult;
    create?: AxiosResponse;
    read?: AxiosResponse;
    metadata?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validation: this.state.validationResult,
      create: this.state.createResult,
      read: this.state.readResult,
      metadata: this.state.metadataResult,
      update: this.state.updateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}

