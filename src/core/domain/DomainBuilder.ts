/**
 * DomainBuilder - Fluent API for domain operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.create().then(b => b.lock()).then(b => b.update())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * @example
 * ```typescript
 * const builder = new DomainBuilder(connection, logger, {
 *   domainName: 'Z_TEST_DOMAIN',
 *   packageName: 'ZOK_TEST_PKG_01'
 * });
 *
 * await builder
 *   .create()
 *   .then(b => b.lock())
 *   .then(b => b.update())
 *   .then(b => b.check())
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *   })
 *   .finally(() => {
 *     // Cleanup - always executes
 *   });
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { generateSessionId } from '../../utils/sessionUtils';
import { createDomain } from './create';
import { lockDomain } from './lock';
import { updateDomain } from './update';
import { CreateDomainParams, UpdateDomainParams } from './types';
import { checkDomainSyntax } from './check';
import { unlockDomain } from './unlock';
import { activateDomain } from './activation';
import { FixedValue } from './types';

export interface DomainBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface DomainBuilderConfig {
  domainName: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  datatype?: string;
  length?: number;
  decimals?: number;
  conversion_exit?: string;
  lowercase?: boolean;
  sign_exists?: boolean;
  value_table?: string;
  fixed_values?: FixedValue[];
}

export interface DomainBuilderState {
  createResult?: AxiosResponse;
  lockHandle?: string;
  updateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class DomainBuilder {
  private connection: AbapConnection;
  private logger: DomainBuilderLogger;
  private config: DomainBuilderConfig;
  private lockHandle?: string;
  private sessionId: string;
  private state: DomainBuilderState;

  constructor(
    connection: AbapConnection,
    logger: DomainBuilderLogger,
    config: DomainBuilderConfig
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

  setName(domainName: string): this {
    this.config.domainName = domainName;
    this.logger.debug?.('Domain name set:', domainName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setDatatype(datatype: string): this {
    this.config.datatype = datatype;
    return this;
  }

  setLength(length: number): this {
    this.config.length = length;
    return this;
  }

  setDecimals(decimals: number): this {
    this.config.decimals = decimals;
    return this;
  }

  setConversionExit(conversion_exit: string): this {
    this.config.conversion_exit = conversion_exit;
    return this;
  }

  setLowercase(lowercase: boolean): this {
    this.config.lowercase = lowercase;
    return this;
  }

  setSignExists(sign_exists: boolean): this {
    this.config.sign_exists = sign_exists;
    return this;
  }

  setValueTable(value_table: string): this {
    this.config.value_table = value_table;
    return this;
  }

  setFixedValues(fixed_values: FixedValue[]): this {
    this.config.fixed_values = fixed_values;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  // Chain is interrupted on error (standard Promise behavior)
  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Creating domain:', this.config.domainName);
      const params: CreateDomainParams = {
        domain_name: this.config.domainName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        datatype: this.config.datatype,
        length: this.config.length,
        decimals: this.config.decimals,
        conversion_exit: this.config.conversion_exit,
        lowercase: this.config.lowercase,
        sign_exists: this.config.sign_exists,
        value_table: this.config.value_table,
        fixed_values: this.config.fixed_values,
        activate: false // Don't activate in low-level function
      };
      const result = await createDomain(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Domain created successfully:', result.status);
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
      this.logger.info?.('Locking domain:', this.config.domainName);
      const lockHandle = await lockDomain(
        this.connection,
        this.config.domainName,
        this.sessionId
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;
      this.logger.info?.('Domain locked, handle:', lockHandle.substring(0, 10) + '...');
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

  async update(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Domain must be locked before update. Call lock() first.');
      }
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Updating domain:', this.config.domainName);
      const params: UpdateDomainParams = {
        domain_name: this.config.domainName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        datatype: this.config.datatype,
        length: this.config.length,
        decimals: this.config.decimals,
        conversion_exit: this.config.conversion_exit,
        lowercase: this.config.lowercase,
        sign_exists: this.config.sign_exists,
        value_table: this.config.value_table,
        fixed_values: this.config.fixed_values,
        activate: false // Don't activate in low-level function
      };
      const result = await updateDomain(this.connection, params);
      this.state.updateResult = result;
      this.logger.info?.('Domain updated successfully:', result.status);
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
      this.logger.info?.('Checking domain:', this.config.domainName, 'version:', version);
      const result = await checkDomainSyntax(
        this.connection,
        this.config.domainName,
        version,
        this.sessionId
      );
      this.state.checkResult = result;
      this.logger.info?.('Domain check successful:', result.status);
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
        throw new Error('Domain is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking domain:', this.config.domainName);
      const result = await unlockDomain(
        this.connection,
        this.config.domainName,
        this.lockHandle,
        this.sessionId
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Domain unlocked successfully');
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
      this.logger.info?.('Activating domain:', this.config.domainName);
      const result = await activateDomain(
        this.connection,
        this.config.domainName,
        this.sessionId
      );
      this.state.activateResult = result;
      this.logger.info?.('Domain activated successfully:', result.status);
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

  // Getters for accessing results
  getState(): Readonly<DomainBuilderState> {
    return { ...this.state };
  }

  getDomainName(): string {
    return this.config.domainName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string {
    return this.sessionId;
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

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  // Helper method to get all results
  getResults(): {
    create?: AxiosResponse;
    update?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      create: this.state.createResult,
      update: this.state.updateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}

