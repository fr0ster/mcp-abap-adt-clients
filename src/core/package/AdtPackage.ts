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
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { PackageBuilderConfig } from './types';
import { validatePackageBasic } from './validation';
import { createPackage } from './create';
import { checkPackage } from './check';
import { lockPackage } from './lock';
import { updatePackage } from './update';
import { unlockPackage } from './unlock';
import { checkPackageDeletion, deletePackage } from './delete';
import { getPackage } from './read';
import { getSystemInformation } from '../../utils/systemInfo';

export class AdtPackage implements IAdtObject<PackageBuilderConfig, PackageBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'Package';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate package configuration before creation
   */
  async validate(config: Partial<PackageBuilderConfig>): Promise<AxiosResponse> {
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }
    if (!config.superPackage) {
      throw new Error('Super package is required for validation');
    }

    return await validatePackageBasic(
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
  }

  /**
   * Create package with full operation chain
   * Note: Packages are containers, so no source code update after create
   */
  async create(
    config: PackageBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<PackageBuilderConfig> {
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
        packageName: config.packageName,
        superPackage: config.superPackage
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

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read package
   */
  async read(
    config: Partial<PackageBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<PackageBuilderConfig | undefined> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    try {
      const response = await getPackage(this.connection, config.packageName, version);
      return {
        packageName: config.packageName
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update package with full operation chain
   * Always starts with lock
   * Note: Packages only support metadata updates (description, superPackage, etc.)
   */
  async update(
    config: Partial<PackageBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<PackageBuilderConfig> {
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
        packageName: config.packageName
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

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete package
   */
  async delete(config: Partial<PackageBuilderConfig>): Promise<AxiosResponse> {
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

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate package
   * Note: Packages don't have activate operation - this is a stub
   */
  async activate(config: Partial<PackageBuilderConfig>): Promise<AxiosResponse> {
    throw new Error('Activate operation is not supported for Package objects in ADT');
  }

  /**
   * Check package
   */
  async check(
    config: Partial<PackageBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkPackage(this.connection, config.packageName, version);
  }
}
