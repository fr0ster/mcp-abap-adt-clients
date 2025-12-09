/**
 * AdtBehaviorDefinition - High-level CRUD operations for Behavior Definition objects
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
import { BehaviorDefinitionBuilderConfig } from './types';
import { validate } from './validation';
import { create as createBehaviorDefinition } from './create';
import { check as checkBehaviorDefinition } from './check';
import { lock } from './lock';
import { update } from './update';
import { unlock } from './unlock';
import { activate } from './activation';
import { checkDeletion, deleteBehaviorDefinition } from './delete';
import { readSource } from './read';

export class AdtBehaviorDefinition implements IAdtObject<BehaviorDefinitionBuilderConfig, BehaviorDefinitionBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'BehaviorDefinition';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate behavior definition configuration before creation
   */
  async validate(config: Partial<BehaviorDefinitionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Behavior definition name is required for validation');
    }
    if (!config.rootEntity) {
      throw new Error('Root entity is required for validation');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }
    if (!config.implementationType) {
      throw new Error('Implementation type is required for validation');
    }

    return await validate(
      this.connection,
      {
        objname: config.name,
        rootEntity: config.rootEntity,
        description: config.description || config.name,
        package: config.packageName,
        implementationType: config.implementationType
      }
    );
  }

  /**
   * Create behavior definition with full operation chain
   */
  async create(
    config: BehaviorDefinitionBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<BehaviorDefinitionBuilderConfig> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.rootEntity) {
      throw new Error('Root entity is required');
    }
    if (!config.implementationType) {
      throw new Error('Implementation type is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;

    try {
      // 1. Validate (no stateful needed)
      this.logger.info?.('Step 1: Validating behavior definition configuration');
      await validate(
        this.connection,
        {
          objname: config.name,
          rootEntity: config.rootEntity,
          description: config.description,
          package: config.packageName,
          implementationType: config.implementationType
        }
      );
      this.logger.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger.info?.('Step 2: Creating behavior definition');
      await createBehaviorDefinition(this.connection, {
        name: config.name,
        package: config.packageName,
        description: config.description,
        implementationType: config.implementationType,
      });
      objectCreated = true;
      this.logger.info?.('Behavior definition created');

      // 3. Check after create (no stateful needed)
      this.logger.info?.('Step 3: Checking created behavior definition');
      await checkBehaviorDefinition(this.connection, config.name, 'bdefImplementationCheck', '', 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger.info?.('Step 4: Locking behavior definition');
      this.connection.setSessionType('stateful');
      lockHandle = await lock(this.connection, config.name);
      this.logger.info?.('Behavior definition locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkBehaviorDefinition(this.connection, config.name, 'abapCheckRun', '', 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating behavior definition with source code');
        await update(
          this.connection,
          {
            name: config.name,
            sourceCode: codeToCheck,
            lockHandle,
            transportRequest: config.transportRequest
          }
        );
        this.logger.info?.('Behavior definition updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking behavior definition');
        await unlock(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Behavior definition unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await checkBehaviorDefinition(this.connection, config.name, 'bdefImplementationCheck', '', 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating behavior definition');
        const activateResponse = await activate(this.connection, config.name);
        this.logger.info?.('Behavior definition activated, status:', activateResponse.status);

        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          name: config.name,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await readSource(this.connection, config.name);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        name: config.name,
        packageName: config.packageName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking behavior definition during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlock(this.connection, config.name, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting behavior definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteBehaviorDefinition(this.connection, config.name, config.transportRequest);
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete behavior definition after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read behavior definition
   */
  async read(
    config: Partial<BehaviorDefinitionBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<BehaviorDefinitionBuilderConfig | undefined> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    try {
      const response = await readSource(this.connection, config.name, version);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        name: config.name,
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
   * Update behavior definition with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<BehaviorDefinitionBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<BehaviorDefinitionBuilderConfig> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger.info?.('Step 1: Locking behavior definition');
      this.connection.setSessionType('stateful');
      lockHandle = await lock(this.connection, config.name);
      this.logger.info?.('Behavior definition locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkBehaviorDefinition(this.connection, config.name, 'abapCheckRun', '', 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 3: Updating behavior definition');
        await update(
          this.connection,
          {
            name: config.name,
            sourceCode: codeToCheck,
            lockHandle,
            transportRequest: config.transportRequest
          }
        );
        this.logger.info?.('Behavior definition updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking behavior definition');
        await unlock(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Behavior definition unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await checkBehaviorDefinition(this.connection, config.name, 'bdefImplementationCheck', '', 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating behavior definition');
        const activateResponse = await activate(this.connection, config.name);
        this.logger.info?.('Behavior definition activated, status:', activateResponse.status);

        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          name: config.name
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await readSource(this.connection, config.name);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        name: config.name,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking behavior definition during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlock(this.connection, config.name, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting behavior definition after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteBehaviorDefinition(this.connection, config.name, config.transportRequest);
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete behavior definition after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete behavior definition
   */
  async delete(config: Partial<BehaviorDefinitionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger.info?.('Checking behavior definition for deletion');
      await checkDeletion(this.connection, config.name);
      this.logger.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger.info?.('Deleting behavior definition');
      const result = await deleteBehaviorDefinition(this.connection, config.name, config.transportRequest);
      this.logger.info?.('Behavior definition deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate behavior definition
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<BehaviorDefinitionBuilderConfig>): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    try {
      const result = await activate(this.connection, config.name);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check behavior definition
   */
  async check(
    config: Partial<BehaviorDefinitionBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }

    // Map status to version
    const version: string = status === 'active' ? 'active' : 'inactive';
    return await checkBehaviorDefinition(this.connection, config.name, 'bdefImplementationCheck', '', version);
  }
}
