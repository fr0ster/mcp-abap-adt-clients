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
 * Note: Packages don't support lock/unlock/update/activate operations.
 * Available operations: validate, create, read, check
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
import { createPackage } from './create';
import { validatePackageBasic, validatePackageFull } from './validation';
import { checkPackage } from './check';
import { getPackage } from './read';
import { CreatePackageParams } from './types';

export interface PackageBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface PackageBuilderConfig {
  packageName: string;
  superPackage: string;
  description?: string;
  packageType?: string;
  softwareComponent?: string;
  transportLayer?: string;
  transportRequest?: string;
  applicationComponent?: string;
  responsible?: string;
}

export interface PackageBuilderState {
  validationResult?: { basic?: void; full?: void };
  createResult?: AxiosResponse;
  readResult?: AxiosResponse;
  checkResult?: void;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class PackageBuilder {
  private connection: AbapConnection;
  private logger: PackageBuilderLogger;
  private config: PackageBuilderConfig;
  private state: PackageBuilderState;

  constructor(
    connection: AbapConnection,
    logger: PackageBuilderLogger,
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
      await validatePackageBasic(this.connection, params);
      this.state.validationResult = { basic: undefined };
      this.logger.info?.('Package basic validation successful');

      // Full validation if transport layer is provided
      if (this.config.transportLayer || this.config.softwareComponent) {
        const swcomp = this.config.softwareComponent || 'HOME';
        const transportLayer = this.config.transportLayer || process.env.SAP_TRANSPORT_LAYER || 'ZE19';
        await validatePackageFull(this.connection, params, swcomp, transportLayer);
        this.state.validationResult.full = undefined;
        this.logger.info?.('Package full validation successful');
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
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Create failed:', error);
      throw error;
    }
  }

  async read(): Promise<this> {
    try {
      this.logger.info?.('Reading package:', this.config.packageName);
      const result = await getPackage(this.connection, this.config.packageName);
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

  async check(): Promise<this> {
    try {
      this.logger.info?.('Checking package:', this.config.packageName);
      await checkPackage(this.connection, this.config.packageName);
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

  // Getters for accessing results
  getState(): Readonly<PackageBuilderState> {
    return { ...this.state };
  }

  getPackageName(): string {
    return this.config.packageName;
  }

  getValidationResult(): { basic?: void; full?: void } | undefined {
    return this.state.validationResult;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getCheckResult(): void | undefined {
    return this.state.checkResult;
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  getResults(): {
    validate?: { basic?: void; full?: void };
    create?: AxiosResponse;
    read?: AxiosResponse;
    check?: void;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validate: this.state.validationResult,
      create: this.state.createResult,
      read: this.state.readResult,
      check: this.state.checkResult,
      errors: [...this.state.errors]
    };
  }
}

