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
import { IAdtLogger } from '../../utils/logger';
import { create, upload } from './create';
import { lockDomain, acquireLockHandle } from './lock';
import { updateDomain } from './update';
import { CreateDomainParams, UpdateDomainParams } from './types';
import { checkDomainSyntax } from './check';
import { unlockDomain } from './unlock';
import { activateDomain } from './activation';
import { deleteDomain } from './delete';
import { FixedValue } from './types';
import { validateObjectName, ValidationResult } from '../../utils/validation';
import { getSystemInformation } from '../../utils/systemInfo';
import { getDomain, getDomainTransport } from './read';

export interface DomainBuilderConfig {
  domainName: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
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
  validationResult?: ValidationResult;
  createResult?: AxiosResponse;
  lockHandle?: string;
  updateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  deleteResult?: AxiosResponse;
  readResult?: AxiosResponse;
  transportResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class DomainBuilder {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: DomainBuilderConfig;
  private lockHandle?: string;
  private state: DomainBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: DomainBuilderConfig
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
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating domain name:', this.config.domainName);
      const result = await validateObjectName(
        this.connection,
        'DOMA/DD',
        this.config.domainName,
        this.config.packageName ? { packagename: this.config.packageName } : undefined
      );
      this.state.validationResult = result;
      if (!result.valid) {
        throw new Error(`Domain name validation failed: ${result.message || 'Invalid domain name'}`);
      }
      this.logger.info?.('Domain name validation successful');
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
      this.logger.info?.('Creating empty domain:', this.config.domainName);

      // Get masterSystem and responsible (only for cloud systems)
      const systemInfo = await getSystemInformation(this.connection);
      const masterSystem = systemInfo?.systemID;
      const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

      // Enable stateful session mode
      this.connection.setSessionType("stateful");

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
        fixed_values: this.config.fixed_values
      };

      // Create empty domain only (initial POST to register the name)
      const result = await create(
        this.connection,
        params,
        username,
        masterSystem
      );
      this.state.createResult = result;
      this.logger.info?.('Empty domain created successfully:', result.status);
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
      
      // Enable stateful session mode
      this.connection.setSessionType("stateful");
      
      const lockHandle = await lockDomain(
        this.connection,
        this.config.domainName
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      this.logger.info?.('Domain locked, handle:', lockHandle);
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

      // Get masterSystem and responsible (only for cloud systems)
      const systemInfo = await getSystemInformation(this.connection);
      const masterSystem = systemInfo?.systemID;
      const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

      // Check if this is a CREATE workflow (createResult exists) or UPDATE workflow
      const isCreateWorkflow = !!this.state.createResult;

      if (isCreateWorkflow) {
        // For CREATE workflow: use upload to fill empty domain with data
        this.logger.info?.('Filling domain with data (CREATE workflow):', this.config.domainName);
        const createParams: CreateDomainParams = {
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
          fixed_values: this.config.fixed_values
        };
        const result = await upload(
          this.connection,
          createParams,
          this.lockHandle,
          username,
          masterSystem
        );
        this.state.updateResult = result;
        this.logger.info?.('Domain filled with data successfully:', result.status);
      } else {
        // For UPDATE workflow: use updateDomain to update existing domain
        this.logger.info?.('Updating domain (UPDATE workflow):', this.config.domainName);
        const updateParams: UpdateDomainParams = {
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
        const result = await updateDomain(this.connection, updateParams);
        this.state.updateResult = result;
        this.logger.info?.('Domain updated successfully:', result.status);
      }
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
        version
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
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
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
        this.config.domainName
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


  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting domain:', this.config.domainName);
      const result = await deleteDomain(
        this.connection,
        {
          domain_name: this.config.domainName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Domain deleted successfully:', result.status);
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

  async read(): Promise<this> {
    try {
      this.logger.info?.('Reading domain:', this.config.domainName);
      const result = await getDomain(this.connection, this.config.domainName);
      this.state.readResult = result;
      this.logger.info?.('Domain read successfully:', result.status);
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

  async readTransport(): Promise<this> {
    try {
      this.logger.info?.('Reading transport request for domain:', this.config.domainName);
      const result = await getDomainTransport(this.connection, this.config.domainName);
      this.state.transportResult = result;
      this.logger.info?.('Transport request read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readTransport',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read transport failed:', error);
      throw error; // Interrupts chain
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockDomain(
        this.connection,
        this.config.domainName,
        this.lockHandle
      );
      this.logger.info?.('Force unlock successful for', this.config.domainName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
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

  getSessionId(): string | null {
    return this.connection.getSessionId();
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

  getTransportResult(): AxiosResponse | undefined {
    return this.state.transportResult;
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
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
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

