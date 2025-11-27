/**
 * MetadataExtensionBuilder - Fluent API for metadata extension operations
 * 
 * Supports method chaining with Promise-based operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { IAdtLogger } from '../../utils/logger';
import { validateMetadataExtension } from './validation';
import { createMetadataExtension } from './create';
import { lockMetadataExtension } from './lock';
import { unlockMetadataExtension } from './unlock';
import { readMetadataExtension, readMetadataExtensionSource } from './read';
import { updateMetadataExtension } from './update';
import { checkMetadataExtension } from './check';
import { activateMetadataExtension } from './activate';
import { deleteMetadataExtension } from './delete';
import { MetadataExtensionBuilderConfig, MetadataExtensionBuilderState } from './types';

export class MetadataExtensionBuilder {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: MetadataExtensionBuilderConfig;
  private lockHandle?: string;
  private state: MetadataExtensionBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: MetadataExtensionBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Setters - return this for chaining
  setName(name: string): this {
    this.config.name = name;
    this.logger.debug?.('Metadata extension name set:', name);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    this.logger.debug?.('Description set:', description);
    return this;
  }

  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger.debug?.('Package set:', packageName);
    return this;
  }

  setTransportRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger.debug?.('Transport request set:', transportRequest);
    return this;
  }

  setSourceCode(sourceCode: string): this {
    this.config.sourceCode = sourceCode;
    this.logger.debug?.('Source code set, length:', sourceCode.length);
    return this;
  }

  setMasterLanguage(masterLanguage: string): this {
    this.config.masterLanguage = masterLanguage;
    return this;
  }

  setMasterSystem(masterSystem: string): this {
    this.config.masterSystem = masterSystem;
    return this;
  }

  setResponsible(responsible: string): this {
    this.config.responsible = responsible;
    return this;
  }

  // Operation methods - return Promise<this> for chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating metadata extension parameters');
      const response = await validateMetadataExtension(this.connection, {
        name: this.config.name,
        description: this.config.description || '',
        packageName: this.config.packageName || ''
      });
      
      // Store raw response - consumer decides how to interpret it
      this.state.validationResponse = response;
      this.logger.info?.('Validation successful');
      return this;
    } catch (error: any) {
      // Store error response if available
      if (error.response) {
        this.state.validationResponse = error.response;
      }
      
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error.message);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      this.logger.info?.('Creating metadata extension:', this.config.name);
      
      if (!this.config.packageName) {
        throw new Error('Package name is required for creation');
      }

      const result = await createMetadataExtension(
        this.connection,
        {
          name: this.config.name,
          description: this.config.description || '',
          packageName: this.config.packageName,
          transportRequest: this.config.transportRequest,
          masterLanguage: this.config.masterLanguage,
          masterSystem: this.config.masterSystem,
          responsible: this.config.responsible
        }
      );
      
      this.state.createResult = result;
      this.logger.info?.('Metadata extension created successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Creation failed:', error.message);
      throw error;
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger.info?.('Locking metadata extension:', this.config.name);
      
      // Enable stateful session mode
      this.connection.setSessionType("stateful");
      const lockHandle = await lockMetadataExtension(
        this.connection,
        this.config.name
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;
      this.logger.info?.('Metadata extension locked, handle:', lockHandle);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock failed:', error.message);
      throw error;
    }
  }

  async read(): Promise<this> {
    try {
      this.logger.info?.('Reading metadata extension metadata:', this.config.name);
      const result = await readMetadataExtension(
        this.connection,
        this.config.name
      );
      this.state.readResult = result;
      this.logger.info?.('Metadata extension metadata read successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error.message);
      throw error;
    }
  }

  async readSource(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Reading metadata extension source code:', this.config.name, 'version:', version);
      const result = await readMetadataExtensionSource(
        this.connection,
        this.config.name,
        version
      );
      this.state.sourceCode = result.data;
      this.logger.info?.('Source code read successfully, length:', result.data.length);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readSource',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read source failed:', error.message);
      throw error;
    }
  }

  async update(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Lock handle is required for update. Call lock() first.');
      }

      if (!this.config.sourceCode) {
        throw new Error('Source code is required for update. Call setSourceCode() first.');
      }

      this.logger.info?.('Updating metadata extension source code:', this.config.name);
      const result = await updateMetadataExtension(
        this.connection,
        this.config.name,
        this.config.sourceCode,
        this.lockHandle
      );
      
      this.state.updateResult = result;
      this.logger.info?.('Metadata extension updated successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update failed:', error.message);
      throw error;
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<this> {
    try {
      this.logger.info?.('Checking metadata extension:', this.config.name, 'version:', version);
      const result = await checkMetadataExtension(
        this.connection,
        this.config.name,
        version,
        sourceCode || this.config.sourceCode
      );
      this.state.checkResult = result;
      this.logger.info?.('Check completed');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Check failed:', error.message);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Lock handle is required for unlock. Call lock() first.');
      }

      this.logger.info?.('Unlocking metadata extension:', this.config.name);
      const result = await unlockMetadataExtension(
        this.connection,
        this.config.name,
        this.lockHandle
      );
      
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      this.logger.info?.('Metadata extension unlocked');
      
      // Enable stateless session mode
      this.connection.setSessionType("stateless");
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock failed:', error.message);
      throw error;
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger.info?.('Activating metadata extension:', this.config.name);
      const result = await activateMetadataExtension(
        this.connection,
        this.config.name
      );
      this.state.activateResult = result;
      this.logger.info?.('Metadata extension activated successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activation failed:', error.message);
      throw error;
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting metadata extension:', this.config.name);
      const result = await deleteMetadataExtension(
        this.connection,
        this.config.name,
        this.config.transportRequest
      );
      this.state.deleteResult = result;
      this.logger.info?.('Metadata extension deleted successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete failed:', error.message);
      throw error;
    }
  }

  // Getters
  getName(): string {
    return this.config.name;
  }

  getSourceCode(): string | undefined {
    return this.state.sourceCode || this.config.sourceCode;
  }

  getState(): MetadataExtensionBuilderState {
    return this.state;
  }

  getErrors(): Array<{ method: string; error: Error; timestamp: Date }> {
    return this.state.errors;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }
}
