/**
 * PackageBuilder - Fluent API for package operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.validate().then(b => b.create()).then(b => b.check())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * Available operations: validate, create, read, check, lock, unlock, update
 *
 * @example
 * ```typescript
 * const builder = new PackageBuilder(connection, logger, {
 *   packageName: 'Z_TEST_PKG',
 *   superPackage: 'ZOK_TEST_PKG_01'
 * });
 *
 * await builder
 *   .validate()
 *   .then(b => b.create())
 *   .then(b => b.check())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *   });
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { IAdtLogger } from '../../utils/logger';
import { createPackage } from './create';
import { validatePackageBasic, validatePackageFull } from './validation';
import { checkPackage } from './check';
import { getPackage } from './read';
import { lockPackage } from './lock';
import { unlockPackage } from './unlock';
import { deletePackage, checkPackageDeletion, parsePackageDeletionCheck } from './delete';
import { updatePackageDescription } from './update';
import { CreatePackageParams, PackageBuilderConfig, PackageBuilderState } from './types';

export class PackageBuilder {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: PackageBuilderConfig;
  private state: PackageBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: PackageBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setSuperPackage(superPackage: string): this {
    this.config.superPackage = superPackage;
    this.logger.debug?.('Super package set:', superPackage);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    this.logger.debug?.('Description set:', description);
    return this;
  }

  setPackageType(packageType: string): this {
    this.config.packageType = packageType;
    this.logger.debug?.('Package type set:', packageType);
    return this;
  }

  setSoftwareComponent(softwareComponent: string): this {
    this.config.softwareComponent = softwareComponent;
    this.logger.debug?.('Software component set:', softwareComponent);
    return this;
  }

  setTransportLayer(transportLayer: string): this {
    this.config.transportLayer = transportLayer;
    this.logger.debug?.('Transport layer set:', transportLayer);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger.debug?.('Transport request set:', transportRequest);
    return this;
  }

  setApplicationComponent(applicationComponent: string): this {
    this.config.applicationComponent = applicationComponent;
    this.logger.debug?.('Application component set:', applicationComponent);
    return this;
  }

  setResponsible(responsible: string): this {
    this.config.responsible = responsible;
    this.logger.debug?.('Responsible set:', responsible);
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async validate(): Promise<this> {
    try {
      this.logger.info?.('Validating package:', this.config.packageName);
      const params: CreatePackageParams = {
        package_name: this.config.packageName,
        super_package: this.config.superPackage,
        description: this.config.description,
        package_type: this.config.packageType,
        software_component: this.config.softwareComponent,
        transport_layer: this.config.transportLayer,
        transport_request: this.config.transportRequest,
        application_component: this.config.applicationComponent,
        responsible: this.config.responsible
      };

      // Basic validation
      try {
        const response = await validatePackageBasic(this.connection, params);
        // Store raw response - consumer decides how to interpret it
        this.state.validationResponse = response;
        this.logger.info?.('Package basic validation successful');
      } catch (validationError: any) {
        // Store error response if available
        if (validationError.response) {
          this.state.validationResponse = validationError.response;
        }
        
        // Re-throw validation errors - consumer decides how to handle them
        throw validationError;
      }

      // Full validation only if both transport layer and software component are explicitly provided
      // SAP requires transport layer for full validation, so we skip it if not provided
      if (this.config.transportLayer && this.config.softwareComponent) {
        try {
          const fullResponse = await validatePackageFull(this.connection, params, this.config.softwareComponent, this.config.transportLayer);
          // Store full validation response (overwrites basic if both are done)
          this.state.validationResponse = fullResponse;
          this.logger.info?.('Package full validation successful');
        } catch (fullValidationError: any) {
          // Store error response if available
          if (fullValidationError.response) {
            this.state.validationResponse = fullValidationError.response;
          }
          throw fullValidationError;
        }
      } else {
        this.logger.info?.('Skipping full validation (transport layer or software component not provided)');
      }

      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Validation failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.superPackage) {
        throw new Error('Super package is required');
      }
      this.logger.info?.('Creating package:', this.config.packageName);
      const params: CreatePackageParams = {
        package_name: this.config.packageName,
        super_package: this.config.superPackage,
        description: this.config.description,
        package_type: this.config.packageType,
        software_component: this.config.softwareComponent,
        transport_layer: this.config.transportLayer,
        transport_request: this.config.transportRequest,
        application_component: this.config.applicationComponent,
        responsible: this.config.responsible
      };
      const result = await createPackage(this.connection, params);
      this.state.createResult = result;
      this.logger.info?.('Package created successfully:', result.status);
      return this;
    } catch (error: any) {
      const errorMsg = error.message || '';
      // If package already exists, try to read it instead of failing
      if (errorMsg.includes('already exists') || errorMsg.includes('PAK042')) {
        this.logger.warn?.(`Package ${this.config.packageName} already exists. Attempting to read existing package.`);
        try {
          const existingResult = await getPackage(this.connection, this.config.packageName);
          this.state.createResult = existingResult; // Store read result as create result
          this.logger.info?.('Package already exists, read successfully:', existingResult.status);
          return this;
        } catch (readError: any) {
          // If read also fails, throw original create error
          this.state.errors.push({
            method: 'create',
            error: error instanceof Error ? error : new Error(String(error)),
            timestamp: new Date()
          });
          this.logger.error?.('Create failed and read also failed:', error);
          throw error;
        }
      }
      // For other errors, throw as usual
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Create failed:', error);
      throw error;
    }
  }

  async read(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Reading package:', this.config.packageName, 'version:', version);
      const result = await getPackage(this.connection, this.config.packageName, version);
      this.state.readResult = result;
      this.logger.info?.('Package read successfully:', result.status);
      return this;
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

  async check(version: 'active' | 'inactive' = 'active'): Promise<this> {
    try {
      this.logger.info?.('Checking package:', this.config.packageName, 'version:', version);
      await checkPackage(this.connection, this.config.packageName, version);
      this.state.checkResult = undefined;
      this.logger.info?.('Package check successful');
      return this;
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

  async lock(): Promise<this> {
    try {
      // Enable stateful session mode for lock/update/unlock sequence
      this.connection.setSessionType("stateful");
      
      this.logger.info?.('Locking package:', this.config.packageName);
      const lockHandle = await lockPackage(
        this.connection,
        this.config.packageName
      );
      this.state.lockHandle = lockHandle;
      this.state.lockResult = lockHandle;

      // Register lock in persistent storage if callback provided
      if (this.config.onLock) {
        this.config.onLock(lockHandle);
      }

      this.logger.info?.('Package locked successfully, lock handle:', lockHandle);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock failed:', error);
      throw error;
    }
  }

  async unlock(): Promise<this> {
    try {
      if (!this.state.lockHandle) {
        throw new Error('Package must be locked before unlocking. Call lock() first.');
      }
      this.logger.info?.('Unlocking package:', this.config.packageName);
      const result = await unlockPackage(
        this.connection,
        this.config.packageName,
        this.state.lockHandle
      );
      this.state.unlockResult = result;
      this.state.lockHandle = undefined;
      
      // Switch back to stateless mode after unlock
      this.connection.setSessionType("stateless");
      
      this.logger.info?.('Package unlocked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock failed:', error);
      throw error;
    }
  }

  async update(): Promise<this> {
    try {
      if (!this.state.lockHandle) {
        throw new Error('Package must be locked before updating. Call lock() first.');
      }
      const descriptionToUpdate = this.config.updatedDescription || this.config.description;
      if (!descriptionToUpdate) {
        throw new Error('Description or updatedDescription is required for package update');
      }
      this.logger.info?.('Updating package description:', this.config.packageName);
      const result = await updatePackageDescription(
        this.connection,
        this.config.packageName,
        descriptionToUpdate,
        this.state.lockHandle
      );
      this.state.updateResult = result;
      this.logger.info?.('Package description updated successfully:', result.status);
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

  async delete(): Promise<this> {
    try {
      this.logger.info?.('Deleting package:', this.config.packageName);
      
      // Check if package can be deleted first (same as Eclipse ADT does)
      this.logger.debug?.('Checking if package can be deleted...');
      const checkResponse = await checkPackageDeletion(
        this.connection,
        {
          package_name: this.config.packageName
        }
      );
      
      const checkResult = parsePackageDeletionCheck(checkResponse);
      if (!checkResult.isDeletable) {
        throw new Error(`Package cannot be deleted: ${checkResult.message || 'Unknown reason'}`);
      }
      this.logger.debug?.('Package deletion check passed');
      
      // Proceed with deletion
      const result = await deletePackage(
        this.connection,
        {
          package_name: this.config.packageName,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger.info?.('Package deleted successfully:', result.status);
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
    if (!this.state.lockHandle) {
      return;
    }
    try {
      await unlockPackage(
        this.connection,
        this.config.packageName,
        this.state.lockHandle
      );
      // Switch back to stateless after force unlock
      this.connection.setSessionType("stateless");
      this.logger.info?.('Force unlock successful for', this.config.packageName);
    } catch (error: any) {
      this.logger.warn?.('Force unlock failed:', error);
    } finally {
      this.state.lockHandle = undefined;
    }
  }

  // Getters for accessing results
  getState(): Readonly<PackageBuilderState> {
    return { ...this.state };
  }

  getPackageName(): string {
    return this.config.packageName;
  }

  getValidationResponse(): AxiosResponse | undefined {
    return this.state.validationResponse;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getCheckResult(): AxiosResponse | undefined {
    return this.state.checkResult;
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  getLockHandle(): string | undefined {
    return this.state.lockHandle;
  }

  getLockResult(): string | undefined {
    return this.state.lockResult;
  }

  getUnlockResult(): AxiosResponse | undefined {
    return this.state.unlockResult;
  }

  getUpdateResult(): AxiosResponse | undefined {
    return this.state.updateResult;
  }

  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }

  getResults(): {
    validation?: AxiosResponse;
    create?: AxiosResponse;
    read?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validation: this.state.validationResponse,
      create: this.state.createResult,
      read: this.state.readResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      lockHandle: this.state.lockHandle,
      errors: [...this.state.errors]
    };
  }
}

