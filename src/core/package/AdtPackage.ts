/**
 * AdtPackage - High-level CRUD operations for Package objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Uses low-level functions directly (not Builder classes).
 * 
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * 
 * Operation chains:
 * - Create: validate → create → check
 * - Update: lock → check(inactive) → update → unlock → check
 * - Delete: check(deletion) → delete
 * 
 * Note: Packages are containers and don't have source code.
 * Update only changes metadata (description, superPackage, etc.).
 * Packages don't have activate operation (they are not activated).
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { IPackageConfig, IPackageState } from './types';
import { validatePackageBasic } from './validation';
import { createPackage } from './create';
import { checkPackage } from './check';
import { lockPackage } from './lock';
import { updatePackage } from './update';
import { unlockPackage } from './unlock';
import { checkPackageDeletion, deletePackage } from './delete';
import { getPackage, getPackageTransport } from './read';
import { getSystemInformation } from '../../utils/systemInfo';

export class AdtPackage implements IAdtObject<IPackageConfig, IPackageState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'Package';

    constructor(connection: IAbapConnection, logger?: ILogger) {
      this.connection = connection;
      this.logger = logger;
    }

  /**
   * Validate package configuration before creation
   */
  async validate(config: Partial<IPackageConfig>): Promise<IPackageState> {
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }
    if (!config.superPackage) {
      throw new Error('Super package is required for validation');
    }

    const response = await validatePackageBasic(
      this.connection,
      {
        package_name: config.packageName,
        super_package: config.superPackage,
        description: config.description,
        package_type: config.packageType,
        software_component: config.softwareComponent,
        transport_layer: config.transportLayer,
        transport_request: config.transportRequest,
        application_component: config.applicationComponent,
        responsible: config.responsible
      }
    );
    
    return {
      validationResponse: response,
      errors: []
    };
  }

  /**
   * Create package with full operation chain
   * Note: Packages are containers, so no source code update after create
   */
  async create(
    config: IPackageConfig,
    options?: IAdtOperationOptions
  ): Promise<IPackageState> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.superPackage) {
      throw new Error('Super package is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.softwareComponent) {
      throw new Error('Software component is required');
    }

    let objectCreated = false;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating package configuration');
      await validatePackageBasic(
        this.connection,
        {
          package_name: config.packageName,
          super_package: config.superPackage,
          description: config.description,
          package_type: config.packageType,
          software_component: config.softwareComponent,
          transport_layer: config.transportLayer,
          transport_request: config.transportRequest,
          application_component: config.applicationComponent,
          responsible: config.responsible
        }
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating package');
      await createPackage(this.connection, {
        package_name: config.packageName,
        super_package: config.superPackage,
        description: config.description,
        package_type: config.packageType,
        software_component: config.softwareComponent,
        transport_layer: config.transportLayer,
        transport_request: config.transportRequest,
        application_component: config.applicationComponent,
        responsible: config.responsible
      });
      objectCreated = true;
      this.logger?.info?.('Package created');

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created package');
      await checkPackage(this.connection, config.packageName, 'inactive');
      this.logger?.info?.('Check after create passed');

      // Note: Packages are containers - no source code to update after create
      // Note: Packages don't have activate operation

      // Read and return result (no stateful needed)
      const readResponse = await getPackage(this.connection, config.packageName);
      return {
        createResult: readResponse,
        errors: []
      };
    } catch (error: any) {
      // Ensure stateless if needed
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting package after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deletePackage(this.connection, {
            package_name: config.packageName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete package after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read package
   */
  async read(
    config: Partial<IPackageConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IPackageState | undefined> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    try {
      const response = await getPackage(this.connection, config.packageName, version);
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read package metadata (object characteristics: package, responsible, description, etc.)
   * For packages, read() already returns metadata since there's no source code.
   */
  async readMetadata(config: Partial<IPackageConfig>): Promise<IPackageState> {
    const state: IPackageState = { errors: [] };
    if (!config.packageName) {
      const error = new Error('Package name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      // For objects without source code, read() already returns metadata
      const response = await getPackage(this.connection, config.packageName);
      state.metadataResult = response;
      state.readResult = response;
      this.logger?.info?.('Package metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Read transport request information for the package
   */
  async readTransport(config: Partial<IPackageConfig>): Promise<IPackageState> {
    const state: IPackageState = { errors: [] };
    if (!config.packageName) {
      const error = new Error('Package name is required');
      state.errors.push({ method: 'readTransport', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getPackageTransport(this.connection, config.packageName);
      state.transportResult = response;
      this.logger?.info?.('Package transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readTransport', error: err, timestamp: new Date() });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }

  /**
   * Update package with full operation chain
   * Always starts with lock
   * Note: Packages only support metadata updates (description, superPackage, etc.)
   */
  async update(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions
  ): Promise<IPackageState> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.superPackage) {
      throw new Error('Super package is required for update');
    }
    if (!config.softwareComponent) {
      throw new Error('Software component is required for update');
    }

    let lockHandle: string | undefined;
    const systemInfo = await getSystemInformation(this.connection);

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking package');
      this.connection.setSessionType('stateful');
      lockHandle = await lockPackage(this.connection, config.packageName);
      this.logger?.info?.('Package locked, handle:', lockHandle);

      // 2. Check inactive with XML for update (if provided)
      const xmlToCheck = options?.xmlContent;
      if (xmlToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await checkPackage(this.connection, config.packageName, 'inactive', xmlToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update metadata
      if (lockHandle) {
        this.logger?.info?.('Step 3: Updating package metadata');
        await updatePackage(
          this.connection,
          {
            package_name: config.packageName,
            super_package: config.superPackage,
            description: config.updatedDescription || config.description || config.packageName,
            package_type: config.packageType,
            software_component: config.softwareComponent,
            transport_layer: config.transportLayer,
            transport_request: config.transportRequest,
            application_component: config.applicationComponent,
            responsible: config.responsible || systemInfo?.userName
          },
          lockHandle
        );
        this.logger?.info?.('Package updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking package');
        await unlockPackage(this.connection, config.packageName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Package unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkPackage(this.connection, config.packageName, 'inactive');
      this.logger?.info?.('Final check passed');

      // Note: Packages don't have activate operation

      // Read and return result (no stateful needed)
      const readResponse = await getPackage(this.connection, config.packageName);
      return {
        updateResult: readResponse,
        errors: []
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking package during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockPackage(this.connection, config.packageName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting package after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deletePackage(this.connection, {
            package_name: config.packageName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete package after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete package
   */
  async delete(config: Partial<IPackageConfig>): Promise<IPackageState> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking package for deletion');
      await checkPackageDeletion(this.connection, {
        package_name: config.packageName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting package');
      const result = await deletePackage(this.connection, {
        package_name: config.packageName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Package deleted');

      return { deleteResult: result, errors: [] };
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    }
  }

  /**
   * Activate package
   * Note: Packages don't have activate operation - this is a stub
   */
  async activate(config: Partial<IPackageConfig>): Promise<IPackageState> {
    throw new Error('Activate operation is not supported for Package objects in ADT');
  }

  /**
   * Check package
   */
  async check(
    config: Partial<IPackageConfig>,
    status?: string
  ): Promise<IPackageState> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return {
      checkResult: await checkPackage(this.connection, config.packageName, version),
      errors: []
    };
  }
}
