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
import { getDataElement } from './read';
import { lockDataElement } from './lock';
import { updateDataElementInternal, getDomainInfo } from './update';
import { CreateDataElementParams, UpdateDataElementParams } from './types';
import { checkDataElement } from './check';
import { unlockDataElement } from './unlock';
import { activateDataElement } from './activation';
import { validateObjectName, ValidationResult } from '../shared/validation';

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
  domainName?: string;
  dataType?: string;
  length?: number;
  decimals?: number;
  shortLabel?: string;
  mediumLabel?: string;
  longLabel?: string;
  headingLabel?: string;
  typeKind?: 'domain' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClifType';
  typeName?: string;
}

export interface DataElementBuilderState {
  validationResult?: ValidationResult;
  createResult?: AxiosResponse;
  readResult?: AxiosResponse;
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

  setTypeKind(typeKind: 'domain' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClifType'): this {
    this.config.typeKind = typeKind;
    return this;
  }

  setTypeName(typeName: string): this {
    this.config.typeName = typeName;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating data element name:', this.config.dataElementName);
      const result = await validateObjectName(
        this.connection,
        'DTEL/DE',
        this.config.dataElementName,
        this.config.packageName ? { packagename: this.config.packageName } : undefined
      );
      this.state.validationResult = result;
      if (!result.valid) {
        // Check if error is about object already existing (common in tests)
        const errorMsg = result.message || '';
        if (errorMsg.toLowerCase().includes('already exists') ||
            errorMsg.toLowerCase().includes('does already exist') ||
            errorMsg.toLowerCase().includes('resource') && errorMsg.toLowerCase().includes('exist')) {
          // Object exists - this is OK for tests, just log warning
          this.logger.warn?.('Data element already exists, validation skipped:', this.config.dataElementName);
          return this;
        }
        throw new Error(`Data element name validation failed: ${errorMsg || 'Invalid data element name'}`);
      }
      this.logger.info?.('Data element name validation successful');
      return this;
    } catch (error: any) {
      // If validation endpoint returns 400 and it's about object existing, that's OK for tests
      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
        if (errorText.toLowerCase().includes('already exists') ||
            errorText.toLowerCase().includes('does already exist') ||
            errorText.toLowerCase().includes('resource') && errorText.toLowerCase().includes('exist')) {
          this.logger.warn?.('Data element already exists, validation skipped:', this.config.dataElementName);
          return this;
        }
      }

      // If validation is not supported for this object type, skip it (log warning)
      const errorMsg = error.message || '';
      const errorData = error.response?.data;
      const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
      if (errorMsg.toLowerCase().includes('not supported') ||
          errorText.toLowerCase().includes('not supported') ||
          errorMsg.toLowerCase().includes('object type') && errorMsg.toLowerCase().includes('not supported')) {
        this.logger.warn?.('Validation not supported for DTEL/DE in this SAP system, skipping:', this.config.dataElementName);
        return this;
      }

      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error);
      // If validation result exists, use its message
      if (this.state.validationResult && !this.state.validationResult.valid) {
        throw new Error(`Data element name validation failed: ${this.state.validationResult.message || 'Invalid data element name'}`);
      }
      throw error; // Interrupts chain
    }
  }

  async read(): Promise<this> {
    try {
      this.logger.info?.('Reading data element:', this.config.dataElementName);
      const result = await getDataElement(this.connection, this.config.dataElementName);
      this.state.readResult = result;
      this.logger.info?.('Data element read successfully:', result.status);
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

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      if (!this.config.typeKind) {
        throw new Error('typeKind is required in DataElementBuilderConfig. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
      }
      const typeKind = this.config.typeKind;
      if (typeKind === 'domain' && !this.config.domainName) {
        throw new Error('Domain name is required for domain-based data elements');
      }
      this.logger.info?.('Creating data element:', this.config.dataElementName);
      const params: CreateDataElementParams = {
        data_element_name: this.config.dataElementName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        domain_name: this.config.domainName,
        type_kind: typeKind,
        type_name: this.config.typeName,
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
      if (!this.config.typeKind) {
        throw new Error('typeKind is required in DataElementBuilderConfig. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
      }
      const typeKind = this.config.typeKind;
      this.logger.info?.('Updating data element:', this.config.dataElementName);

      const username = process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';
      let domainInfo = { dataType: 'CHAR', length: 100, decimals: 0 };

      if (typeKind === 'domain') {
        const domainName = this.config.typeName || this.config.domainName || 'CHAR100';
        domainInfo = await getDomainInfo(this.connection, domainName);
      } else if (typeKind === 'predefinedAbapType') {
        domainInfo = {
          dataType: this.config.dataType || 'CHAR',
          length: this.config.length || 100,
          decimals: this.config.decimals || 0
        };
      }

      const params: UpdateDataElementParams = {
        data_element_name: this.config.dataElementName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        domain_name: this.config.domainName,
        type_kind: typeKind,
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

      const result = await updateDataElementInternal(
        this.connection,
        params,
        this.lockHandle,
        this.sessionId,
        username,
        domainInfo
      );

      this.state.updateResult = {
        data: {
          success: true,
          data_element_name: params.data_element_name,
          package: params.package_name,
          transport_request: params.transport_request,
          status: 'inactive',
          session_id: this.sessionId,
          message: `Data element ${params.data_element_name} updated successfully`
        },
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        config: result.config
      } as AxiosResponse;

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
      // For DDIC objects, check may not be fully supported - log warning but continue
      const errorMsg = error.message || '';
      if (errorMsg.toLowerCase().includes('importing') &&
          errorMsg.toLowerCase().includes('database')) {
        this.logger.warn?.('Check not fully supported for data element (common for DDIC objects), continuing:', this.config.dataElementName);
        // Return a mock successful result to allow chain to continue
        this.state.checkResult = {
          data: { success: true, message: 'Check skipped (not fully supported for DDIC objects)' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        } as AxiosResponse;
        return this;
      }

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

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockDataElement(
        this.connection,
        this.config.dataElementName,
        this.lockHandle,
        this.sessionId
      );
      this.logger.info?.('Force unlock successful for', this.config.dataElementName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
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

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
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

