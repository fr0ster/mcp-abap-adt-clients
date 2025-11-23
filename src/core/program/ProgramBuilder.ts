/**
 * ProgramBuilder - Fluent API for program operations with Promise chaining
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
import { IAdtLogger } from '../../utils/logger';
import { validateProgramName } from './validation';
import { create, CreateProgramParams } from './create';
import { lockProgram } from './lock';
import { ValidationResult } from '../shared/validation';
import { checkProgram } from './check';
import { unlockProgram } from './unlock';
import { activateProgram } from './activation';
import { getProgramSource } from './read';
import { deleteProgram } from './delete';

export interface ProgramBuilderConfig {
  programName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  programType?: string;
  application?: string;
  sourceCode?: string;
  sessionId?: string;
  // Optional callback to register lock in persistent storage
  // Called after successful lock() with: lockHandle, sessionId
  onLock?: (lockHandle: string) => void;
}

export interface ProgramBuilderState {
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

export class ProgramBuilder {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: ProgramBuilderConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private state: ProgramBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: ProgramBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sourceCode = config.sourceCode;
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

  setName(programName: string): this {
    this.config.programName = programName;
    this.logger.debug?.('Program name set:', programName);
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

  setProgramType(programType: string): this {
    this.config.programType = programType;
    return this;
  }

  setApplication(application: string): this {
    this.config.application = application;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating program:', this.config.programName);
      const result = await validateProgramName(
        this.connection,
        this.config.programName,
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
      this.logger.info?.('Creating program:', this.config.programName);
      const params: CreateProgramParams = {
        program_name: this.config.programName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        program_type: this.config.programType,
        application: this.config.application,
        source_code: this.sourceCode,
        activate: false // Don't activate in low-level function
      };
      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Program created successfully:', result.status);
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

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking program:', this.config.programName);
      const lockHandle = await lockProgram(
        this.connection,
        this.config.programName,
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger.info?.('Program locked, handle:', lockHandle);
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
        throw new Error('Program must be locked before update. Call lock() first.');
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error('Source code is required. Use setCode() or pass as parameter.');
      }
      this.logger.info?.('Updating program source:', this.config.programName);

      // Direct PUT with existing lockHandle (don't call updateProgramSource which does its own lock/unlock)
      const encodedName = this.config.programName.toLowerCase();
      let url = `/sap/bc/adt/programs/programs/${encodedName}/source/main?lockHandle=${this.lockHandle}`;
      if (this.config.transportRequest) {
        url += `&corrNr=${this.config.transportRequest}`;
      }

      const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'text/plain'
      };

      const { getTimeout } = await import('@mcp-abap-adt/connection');
      const result = await this.connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: getTimeout('default'),
        data: code,
        headers
      });

      this.state.updateResult = result;
      this.logger.info?.('Program updated successfully:', result.status);
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

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<this> {
    try {
      this.logger.info?.('Checking program:', this.config.programName, 'version:', version);
      const result = await checkProgram(
        this.connection,
        this.config.programName,
        version,
        sourceCode
      );
      this.state.checkResult = result;
      this.logger.info?.('Program check successful:', result.status);
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
        throw new Error('Program is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking program:', this.config.programName);
      const result = await unlockProgram(
        this.connection,
        this.config.programName,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Program unlocked successfully');
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
      this.logger.info?.('Activating program:', this.config.programName);
      const result = await activateProgram(
        this.connection,
        this.config.programName
      );
      this.state.activateResult = result;
      this.logger.info?.('Program activated successfully:', result.status);
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
      this.logger.info?.('Deleting program:', this.config.programName);
      const result = await deleteProgram(
        this.connection,
        {
          program_name: this.config.programName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Program deleted successfully:', result.status);
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
      this.logger.info?.('Reading program:', this.config.programName);
      const result = await getProgramSource(this.connection, this.config.programName);
      this.state.readResult = result;
      this.logger.info?.('Program read successfully:', result.status);
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
      await unlockProgram(
        this.connection,
        this.config.programName,
        this.lockHandle,
      );
      this.logger.info?.('Force unlock successful for', this.config.programName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<ProgramBuilderState> {
    return { ...this.state };
  }

  getProgramName(): string {
    return this.config.programName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
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

