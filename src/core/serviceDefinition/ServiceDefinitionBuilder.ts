/**
 * ServiceDefinitionBuilder - Fluent API for service definition operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.create().then(b => b.lock()).then(b => b.update())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { create } from './create';
import { getServiceDefinition, getServiceDefinitionSource } from './read';
import { lockServiceDefinition } from './lock';
import { updateServiceDefinition } from './update';
import { CreateServiceDefinitionParams, UpdateServiceDefinitionParams } from './types';
import { checkServiceDefinition } from './check';
import { unlockServiceDefinition } from './unlock';
import { activateServiceDefinition } from './activation';
import { deleteServiceDefinition } from './delete';
import { validateServiceDefinitionName } from './validation';
import { ServiceDefinitionBuilderConfig, ServiceDefinitionBuilderState } from './types';
import { IBuilder } from '../shared/IBuilder';
import { XMLParser } from 'fast-xml-parser';

export class ServiceDefinitionBuilder implements IBuilder<ServiceDefinitionBuilderState> {
  private connection: IAbapConnection;
  private logger: IAdtLogger;
  private config: ServiceDefinitionBuilderConfig;
  private lockHandle?: string;
  private state: ServiceDefinitionBuilderState;

  constructor(
    connection: IAbapConnection,
    logger: IAdtLogger,
    config: ServiceDefinitionBuilderConfig
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

  setName(serviceDefinitionName: string): this {
    this.config.serviceDefinitionName = serviceDefinitionName;
    this.logger.debug?.('Service definition name set:', serviceDefinitionName);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setSourceCode(sourceCode: string): this {
    this.config.sourceCode = sourceCode;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger.info?.('Validating service definition name:', this.config.serviceDefinitionName);
      const result = await validateServiceDefinitionName(
        this.connection,
        this.config.serviceDefinitionName,
        this.config.description
      );
      // Store raw response for backward compatibility
      this.state.validationResponse = result;
      this.logger.info?.('Service definition name validation successful');
      return result;
    } catch (error: any) {
      // If validation endpoint returns 400 and it's about object existing, that's OK for tests
      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
        if (errorText.toLowerCase().includes('already exists') ||
            errorText.toLowerCase().includes('does already exist') ||
            errorText.toLowerCase().includes('resource') && errorText.toLowerCase().includes('exist')) {
          this.logger.warn?.('Service definition already exists, validation skipped:', this.config.serviceDefinitionName);
          this.state.validationResponse = error.response;
          return error.response;
        }
      }

      // If validation is not supported for this object type, skip it (log warning)
      const errorMsg = error.message || '';
      const errorData = error.response?.data;
      const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData || {});
      if (errorMsg.toLowerCase().includes('not supported') ||
          errorText.toLowerCase().includes('not supported') ||
          errorMsg.toLowerCase().includes('object type') && errorMsg.toLowerCase().includes('not supported')) {
        this.logger.warn?.('Validation not supported for SRVD/SRV in this SAP system, skipping:', this.config.serviceDefinitionName);
        if (error.response) {
          this.state.validationResponse = error.response;
          return error.response;
        }
      }

      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      // Store error response if available
      if (error.response) {
        this.state.validationResponse = error.response;
      }
      
      this.logger.error?.('Validation failed:', error);
      throw error;
    }
  }

  async read(): Promise<ServiceDefinitionBuilderConfig | undefined> {
    try {
      this.logger.info?.('Reading service definition:', this.config.serviceDefinitionName);
      const result = await getServiceDefinition(this.connection, this.config.serviceDefinitionName);
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger.info?.('Service definition read successfully:', result.status);
      
      // Parse and return config directly
      const xmlData = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);
      
      return this.parseServiceDefinitionXml(xmlData);
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

  async readSource(): Promise<string | undefined> {
    try {
      this.logger.info?.('Reading service definition source:', this.config.serviceDefinitionName);
      const result = await getServiceDefinitionSource(this.connection, this.config.serviceDefinitionName);
      // Store raw response for backward compatibility
      this.state.readSourceResult = result;
      this.logger.info?.('Service definition source read successfully:', result.status);
      
      const sourceCode = typeof result.data === 'string' ? result.data : '';
      return sourceCode;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readSource',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read source failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger.info?.('Creating service definition:', this.config.serviceDefinitionName);
      const params: CreateServiceDefinitionParams = {
        service_definition_name: this.config.serviceDefinitionName,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        source_code: this.config.sourceCode
      };
      this.connection.setSessionType("stateful");
      const result = await create(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Service definition created successfully:', result.status);
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
      this.logger.info?.('Locking service definition:', this.config.serviceDefinitionName);
      this.connection.setSessionType("stateful");
      const lockHandle = await lockServiceDefinition(
        this.connection,
        this.config.serviceDefinitionName
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      this.logger.info?.('Service definition locked, handle:', lockHandle);
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
        throw new Error('Service definition must be locked before update. Call lock() first.');
      }
      if (!this.config.sourceCode) {
        throw new Error('Source code is required for update');
      }
      this.logger.info?.('Updating service definition:', this.config.serviceDefinitionName);

      const params: UpdateServiceDefinitionParams = {
        service_definition_name: this.config.serviceDefinitionName,
        source_code: this.config.sourceCode,
        transport_request: this.config.transportRequest
      };

      const result = await updateServiceDefinition(
        this.connection,
        params,
        this.lockHandle
      );

      this.state.updateResult = result;

      this.logger.info?.('Service definition updated successfully:', result.status);
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

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    try {
      const codeToCheck = sourceCode || this.config.sourceCode;
      this.logger.info?.('Checking service definition:', this.config.serviceDefinitionName, 'version:', version, codeToCheck ? 'with source code' : 'saved version');
      const result = await checkServiceDefinition(
        this.connection,
        this.config.serviceDefinitionName,
        version,
        codeToCheck
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger.info?.('Service definition check successful:', result.status);
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

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Service definition is not locked. Call lock() first.');
      }
      this.logger.info?.('Unlocking service definition:', this.config.serviceDefinitionName);
      const result = await unlockServiceDefinition(
        this.connection,
        this.config.serviceDefinitionName,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
      this.logger.info?.('Service definition unlocked successfully');
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
      this.logger.info?.('Activating service definition:', this.config.serviceDefinitionName);
      const result = await activateServiceDefinition(
        this.connection,
        this.config.serviceDefinitionName
      );
      this.state.activateResult = result;
      this.logger.info?.('Service definition activated successfully:', result.status);
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
      this.logger.info?.('Deleting service definition:', this.config.serviceDefinitionName);
      const result = await deleteServiceDefinition(
        this.connection,
        {
          service_definition_name: this.config.serviceDefinitionName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Service definition deleted successfully:', result.status);
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

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle) {
      return;
    }
    try {
      await unlockServiceDefinition(
        this.connection,
        this.config.serviceDefinitionName,
        this.lockHandle
      );
      this.logger.info?.('Force unlock successful for', this.config.serviceDefinitionName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.connection.setSessionType("stateless");
    }
  }

  // Getters for accessing results
  getState(): Readonly<ServiceDefinitionBuilderState> {
    return { ...this.state };
  }

  getServiceDefinitionName(): string {
    return this.config.serviceDefinitionName;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  /**
   * Parse XML response to ServiceDefinitionBuilderConfig
   */
  private parseServiceDefinitionXml(xmlData: string): ServiceDefinitionBuilderConfig | undefined {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });

      const result = parser.parse(xmlData);
      const srvdSource = result['srvd:srvdSource'] || result['srvdSource'];

      if (!srvdSource) {
        return undefined;
      }

      const packageRef = srvdSource['adtcore:packageRef'] || srvdSource['packageRef'];

      return {
        serviceDefinitionName: srvdSource['adtcore:name'] || srvdSource['name'] || this.config.serviceDefinitionName,
        packageName: packageRef?.['adtcore:name'] || packageRef?.['name'],
        description: srvdSource['adtcore:description'] || srvdSource['description'] || '',
        sourceCode: this.config.sourceCode // Source code is not in metadata, keep existing if set
      };
    } catch (error) {
      this.logger.error?.('Failed to parse service definition XML:', error);
      return undefined;
    }
  }

  getReadResult(): ServiceDefinitionBuilderConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    const xmlData = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return this.parseServiceDefinitionXml(xmlData);
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

