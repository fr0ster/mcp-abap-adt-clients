/**
 * AdtServiceDefinition - High-level CRUD operations for Service Definition (DDLS) objects
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
 * - activate uses same session/cookies (no stateful needed)
 * 
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { ServiceDefinitionBuilderConfig } from './types';
import { validateServiceDefinitionName } from './validation';
import { create as createServiceDefinition } from './create';
import { checkServiceDefinition } from './check';
import { lockServiceDefinition } from './lock';
import { updateServiceDefinition } from './update';
import { unlockServiceDefinition } from './unlock';
import { activateServiceDefinition } from './activation';
import { checkDeletion, deleteServiceDefinition } from './delete';
import { getServiceDefinitionSource } from './read';

export class AdtServiceDefinition implements IAdtObject<ServiceDefinitionBuilderConfig, ServiceDefinitionBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'ServiceDefinition';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate service definition configuration before creation
   */
  async validate(config: Partial<ServiceDefinitionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required for validation');
    }

    return await validateServiceDefinitionName(
      this.connection,
      config.serviceDefinitionName,
      config.description
    );
  }

  /**
   * Create service definition with full operation chain
   */
  async create(
    config: ServiceDefinitionBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<ServiceDefinitionBuilderConfig> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating service definition configuration');
      await validateServiceDefinitionName(
        this.connection,
        config.serviceDefinitionName,
        config.description
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger?.info?.('Step 2: Creating service definition');
      await createServiceDefinition(this.connection, {
        service_definition_name: config.serviceDefinitionName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        source_code: options?.sourceCode || config.sourceCode
      });
      objectCreated = true;
      this.logger?.info?.('Service definition created');

      // 3. Check after create (no stateful needed)
      this.logger?.info?.('Step 3: Checking created service definition');
      await checkServiceDefinition(this.connection, config.serviceDefinitionName, 'inactive');
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger?.info?.('Step 4: Locking service definition');
      this.connection.setSessionType('stateful');
      lockHandle = await lockServiceDefinition(this.connection, config.serviceDefinitionName);
      this.logger?.info?.('Service definition locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        await checkServiceDefinition(this.connection, config.serviceDefinitionName, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating service definition with source code');
        await updateServiceDefinition(
          this.connection,
          {
            service_definition_name: config.serviceDefinitionName,
            source_code: codeToCheck,
            transport_request: config.transportRequest
          },
          lockHandle
        );
        this.logger?.info?.('Service definition updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking service definition');
        await unlockServiceDefinition(this.connection, config.serviceDefinitionName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Service definition unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      await checkServiceDefinition(this.connection, config.serviceDefinitionName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating service definition');
        const activateResponse = await activateServiceDefinition(this.connection, config.serviceDefinitionName);
        this.logger?.info?.('Service definition activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          serviceDefinitionName: config.serviceDefinitionName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getServiceDefinitionSource(this.connection, config.serviceDefinitionName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        serviceDefinitionName: config.serviceDefinitionName,
        packageName: config.packageName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking service definition during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockServiceDefinition(this.connection, config.serviceDefinitionName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting service definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteServiceDefinition(this.connection, {
            service_definition_name: config.serviceDefinitionName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete service definition after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read service definition
   */
  async read(
    config: Partial<ServiceDefinitionBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<ServiceDefinitionBuilderConfig | undefined> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    try {
      const response = await getServiceDefinitionSource(this.connection, config.serviceDefinitionName, version);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        serviceDefinitionName: config.serviceDefinitionName,
        sourceCode
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update service definition with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<ServiceDefinitionBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<ServiceDefinitionBuilderConfig> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking service definition');
      this.connection.setSessionType('stateful');
      lockHandle = await lockServiceDefinition(this.connection, config.serviceDefinitionName);
      this.logger?.info?.('Service definition locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await checkServiceDefinition(this.connection, config.serviceDefinitionName, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating service definition');
        await updateServiceDefinition(
          this.connection,
          {
            service_definition_name: config.serviceDefinitionName,
            source_code: codeToCheck,
            transport_request: config.transportRequest
          },
          lockHandle
        );
        this.logger?.info?.('Service definition updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking service definition');
        await unlockServiceDefinition(this.connection, config.serviceDefinitionName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Service definition unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkServiceDefinition(this.connection, config.serviceDefinitionName, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating service definition');
        const activateResponse = await activateServiceDefinition(this.connection, config.serviceDefinitionName);
        this.logger?.info?.('Service definition activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          serviceDefinitionName: config.serviceDefinitionName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getServiceDefinitionSource(this.connection, config.serviceDefinitionName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        serviceDefinitionName: config.serviceDefinitionName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking service definition during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockServiceDefinition(this.connection, config.serviceDefinitionName, lockHandle);
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
          this.logger?.warn?.('Deleting service definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteServiceDefinition(this.connection, {
            service_definition_name: config.serviceDefinitionName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete service definition after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete service definition
   */
  async delete(config: Partial<ServiceDefinitionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking service definition for deletion');
      await checkDeletion(this.connection, {
        service_definition_name: config.serviceDefinitionName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger?.info?.('Deleting service definition');
      const result = await deleteServiceDefinition(this.connection, {
        service_definition_name: config.serviceDefinitionName,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Service definition deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate service definition
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<ServiceDefinitionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    try {
      const result = await activateServiceDefinition(this.connection, config.serviceDefinitionName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check service definition
   */
  async check(
    config: Partial<ServiceDefinitionBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.serviceDefinitionName) {
      throw new Error('Service definition name is required');
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    return await checkServiceDefinition(this.connection, config.serviceDefinitionName, version);
  }
}
