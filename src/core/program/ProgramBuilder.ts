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

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IBuilder } from '../shared/IBuilder';
import { activateProgram } from './activation';
import { checkProgram } from './check';
import { create } from './create';
import { deleteProgram } from './delete';
import { lockProgram } from './lock';
import { getProgramSource } from './read';
import type {
  ICreateProgramParams,
  IProgramConfig,
  IProgramState,
} from './types';
import { unlockProgram } from './unlock';
import { validateProgramName } from './validation';

export class ProgramBuilder implements IBuilder<IProgramState> {
  private connection: IAbapConnection;
  private logger?: ILogger;
  private config: IProgramConfig;
  private sourceCode?: string;
  private lockHandle?: string;
  private state: IProgramState;

  constructor(
    connection: IAbapConnection,
    config: IProgramConfig,
    logger?: ILogger,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.sourceCode = config.sourceCode;
    this.state = {
      errors: [],
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

  setName(programName: string): this {
    this.config.programName = programName;
    this.logger?.debug('Program name set:', programName);
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

  setProgramType(programType: string): this {
    this.config.programType = programType;
    return this;
  }

  setApplication(application: string): this {
    this.config.application = application;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger?.info('Validating program:', this.config.programName);
      const response = await validateProgramName(
        this.connection,
        this.config.programName,
        this.config.description,
      );

      // Store raw response for backward compatibility
      this.state.validationResponse = response;
      this.logger?.info('Validation successful');
      return response;
    } catch (error: any) {
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
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
      this.logger?.info('Creating program:', this.config.programName);
      const params: ICreateProgramParams = {
        programName: this.config.programName,
        packageName: this.config.packageName,
        transportRequest: this.config.transportRequest,
        description: this.config.description,
        programType: this.config.programType,
        application: this.config.application,
        sourceCode: this.sourceCode,
        activate: false, // Don't activate in low-level function
      };
      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger?.info('Program created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Create failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger?.info('Locking program:', this.config.programName);
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

      this.logger?.info(`'Program locked  handle:' ${`lockHandle`}`);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async update(sourceCode?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error(
          'Program must be locked before update. Call lock() first.',
        );
      }
      const code = sourceCode || this.sourceCode;
      if (!code) {
        throw new Error(
          'Source code is required. Use setCode() or pass as parameter.',
        );
      }
      this.logger?.info('Updating program source:', this.config.programName);

      // Direct PUT with existing lockHandle (don't call updateProgramSource which does its own lock/unlock)
      const encodedName = this.config.programName.toLowerCase();
      let url = `/sap/bc/adt/programs/programs/${encodedName}/source/main?lockHandle=${this.lockHandle}`;
      if (this.config.transportRequest) {
        url += `&corrNr=${this.config.transportRequest}`;
      }

      const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        Accept: 'text/plain',
      };

      const { getTimeout } = await import('../../utils/timeouts');
      const result = await this.connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: getTimeout('default'),
        data: code,
        headers,
      });

      this.state.updateResult = result;
      this.logger?.info('Program updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  async check(
    version: 'active' | 'inactive' = 'inactive',
    sourceCode?: string,
  ): Promise<AxiosResponse> {
    try {
      this.logger?.info(
        `'Checking program:'  this.config.programName  'version:' ${`version, sourceCode ? 'with source code' : 'saved version'`}`,
      );
      const result = await checkProgram(
        this.connection,
        this.config.programName,
        version,
        sourceCode,
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger?.info('Program check successful:', result.status);
      return result;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Check failed:', error);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Program is not locked. Call lock() first.');
      }
      this.logger?.info('Unlocking program:', this.config.programName);
      const result = await unlockProgram(
        this.connection,
        this.config.programName,
        this.lockHandle,
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger?.info('Program unlocked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger?.info('Activating program:', this.config.programName);
      const result = await activateProgram(
        this.connection,
        this.config.programName,
      );
      this.state.activateResult = result;
      this.logger?.info('Program activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger?.info('Deleting program:', this.config.programName);
      const result = await deleteProgram(this.connection, {
        programName: this.config.programName,
        transportRequest: this.config.transportRequest,
      });
      this.state.deleteResult = result;
      this.logger?.info('Program deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      });
      this.logger?.error('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async read(
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean },
  ): Promise<IProgramConfig | undefined> {
    try {
      this.logger?.info('Reading program:', this.config.programName);
      const result = await getProgramSource(
        this.connection,
        this.config.programName,
        version,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger?.info('Program read successfully:', result.status);

      // Parse and return config directly
      const sourceCode =
        typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data);

      return {
        programName: this.config.programName,
        sourceCode,
      };
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
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
      await unlockProgram(
        this.connection,
        this.config.programName,
        this.lockHandle,
      );
      this.logger?.info('Force unlock successful for', this.config.programName);
    } catch (error: any) {
      this.logger?.warn('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<IProgramState> {
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

  getReadResult(): IProgramConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    // Program read() returns source code (plain text)
    const sourceCode =
      typeof this.state.readResult.data === 'string'
        ? this.state.readResult.data
        : JSON.stringify(this.state.readResult.data);

    return {
      programName: this.config.programName,
      sourceCode,
    };
  }

  getErrors(): ReadonlyArray<{
    method: string;
    error: Error;
    timestamp: Date;
  }> {
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
      errors: [...this.state.errors],
    };
  }
}
