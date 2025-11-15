/**
 * DataElementBuilder - Fluent API for data element operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.create().then(b => b.lock()).then(b => b.update())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { generateSessionId } from '../../utils/sessionUtils';
import { createDataElement } from './create';
import { lockDataElement } from './lock';
import { updateDataElement } from './update';
import { CreateDataElementParams, UpdateDataElementParams } from './types';
import { checkDataElement } from './check';
import { unlockDataElement } from './unlock';
import { activateDataElement } from './activation';

export interface DataElementBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface DataElementBuilderConfig {
  dataElementName: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  domainName: string;
  dataType?: string;
  length?: number;
  decimals?: number;
  shortLabel?: string;
  mediumLabel?: string;
  longLabel?: string;
  headingLabel?: string;
  typeKind?: 'domain' | 'builtin';
  typeName?: string;
}

export interface DataElementBuilderState {
  createResult?: AxiosResponse;
  lockHandle?: string;
  updateResult?: AxiosResponse;
  checkResult?: AxiosResponse;
  unlockResult?: AxiosResponse;
  activateResult?: AxiosResponse;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class DataElementBuilder {
  private connection: AbapConnection;
  private logger: DataElementBuilderLogger;
  private config: DataElementBuilderConfig;
  private lockHandle?: string;
  private sessionId: string;
  private state: DataElementBuilderState;

  constructor(
    connection: AbapConnection,
    logger: DataElementBuilderLogger,
    config: DataElementBuilderConfig
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

  setName(dataElementName: string): this {
    this.config.dataElementName = dataElementName;
    this.logger.debug?.('Data element name set:', dataElementName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setDomainName(domainName: string): this {
    this.config.domainName = domainName;
    return this;
  }

  setDataType(dataType: string): this {
    this.config.dataType = dataType;
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

  setShortLabel(shortLabel: string): this {
    this.config.shortLabel = shortLabel;
    return this;
  }

  setMediumLabel(mediumLabel: string): this {
    this.config.mediumLabel = mediumLabel;
    return this;
  }

  setLongLabel(longLabel: string): this {
    this.config.longLabel = longLabel;
    return this;
  }

  setHeadingLabel(headingLabel: string): this {
    this.config.headingLabel = headingLabel;
    return this;
  }

  setTypeKind(typeKind: 'domain' | 'builtin'): this {
    this.config.typeKind = typeKind;
    return this;
  }

  setTypeName(typeName: string): this {
    this.config.typeName = typeName;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      if (!this.config.domainName) {
        throw new Error('Domain name is required');
      }
      this.logger.info?.('Creating data element:', this.config.dataElementName);
      const params: CreateDataElementParams = {
        data_element_name: this.config.dataElementName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        domain_name: this.config.domainName,
        data_type: this.config.dataType,
        length: this.config.length,
        decimals: this.config.decimals,
        short_label: this.config.shortLabel,
        medium_label: this.config.mediumLabel,
        long_label: this.config.longLabel,
        heading_label: this.config.headingLabel
      };
      const result = await createDataElement(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Data element created successfully:', result.status);
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
      this.logger.info?.('Locking data element:', this.config.dataElementName);
      const lockHandle = await lockDataElement(
        this.connection,
        this.config.dataElementName,
        this.sessionId
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;
      this.logger.info?.('Data element locked, handle:', lockHandle.substring(0, 10) + '...');
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
        throw new Error('Data element must be locked before update. Call lock() first.');
      }
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Updating data element:', this.config.dataElementName);
      const params: UpdateDataElementParams = {
        data_element_name: this.config.dataElementName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        domain_name: this.config.domainName,
        type_kind: this.config.typeKind,
        type_name: this.config.typeName,
        data_type: this.config.dataType,
        length: this.config.length,
        decimals: this.config.decimals,
        short_label: this.config.shortLabel,
        medium_label: this.config.mediumLabel,
        long_label: this.config.longLabel,
        heading_label: this.config.headingLabel,
        activate: false // Don't activate in low-level function
      };
      const result = await updateDataElement(this.connection, params);
      this.state.updateResult = result;
      this.logger.info?.('Data element updated successfully:', result.status);
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
      this.logger.info?.('Checking data element:', this.config.dataElementName, 'version:', version);
      const result = await checkDataElement(
        this.connection,
        this.config.dataElementName,
        version,
        this.sessionId
      );
      this.state.checkResult = result;
      this.logger.info?.('Data element check successful:', result.status);
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
        throw new Error('Data element is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking data element:', this.config.dataElementName);
      const result = await unlockDataElement(
        this.connection,
        this.config.dataElementName,
        this.lockHandle,
        this.sessionId
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Data element unlocked successfully');
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
      this.logger.info?.('Activating data element:', this.config.dataElementName);
      const result = await activateDataElement(
        this.connection,
        this.config.dataElementName,
        this.sessionId
      );
      this.state.activateResult = result;
      this.logger.info?.('Data element activated successfully:', result.status);
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
  getState(): Readonly<DataElementBuilderState> {
    return { ...this.state };
  }

  getDataElementName(): string {
    return this.config.dataElementName;
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

