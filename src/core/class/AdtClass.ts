/**
 * AdtClass - High-level CRUD operations for Class objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Uses low-level functions directly (not Builder classes).
 * 
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import { IAbapConnection, IAdtObject, CreateOptions, UpdateOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { ClassBuilderConfig } from './types';
import { validateClassName } from './validation';
import { create as createClass } from './create';
import { checkClass } from './check';
import { lockClass } from './lock';
import { updateClass } from './update';
import { unlockClass } from './unlock';
import { activateClass } from './activation';
import { checkDeletion, deleteClass } from './delete';
import { getClassSource } from './read';

export class AdtClass implements IAdtObject<ClassBuilderConfig, ClassBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'Class';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate class configuration before creation
   */
  async validate(config: Partial<ClassBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }

    return await validateClassName(
      this.connection,
      config.className,
      config.packageName,
      config.description,
      config.superclass
    );
  }

  /**
   * Create class with full operation chain
   */
  async create(
    config: ClassBuilderConfig,
    options?: CreateOptions
  ): Promise<ClassBuilderConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const originalSessionType = this.connection.getSessionType?.() || 'stateless';

    try {
      // Enable stateful session for operations
      this.connection.setSessionType('stateful');

      // 1. Validate
      this.logger.info?.('Step 1: Validating class configuration');
      await validateClassName(
        this.connection,
        config.className,
        config.packageName,
        config.description,
        config.superclass
      );
      this.logger.info?.('Validation passed');

      // 2. Create
      this.logger.info?.('Step 2: Creating class');
      await createClass(this.connection, {
        class_name: config.className,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        superclass: config.superclass,
        final: config.final,
        abstract: config.abstract,
        create_protected: config.createProtected,
        master_system: config.masterSystem,
        responsible: config.responsible,
        template_xml: config.classTemplate
      });
      objectCreated = true;
      this.logger.info?.('Class created');

      // 3. Check after create
      this.logger.info?.('Step 3: Checking created class');
      await checkClass(this.connection, config.className, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock
      this.logger.info?.('Step 4: Locking class');
      lockHandle = await lockClass(this.connection, config.className);
      this.logger.info?.('Class locked, handle:', lockHandle);

      // 5. Check inactive with code/xml for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkClass(this.connection, config.className, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating class with source code');
        await updateClass(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('Class updated');
      }

      // 7. Unlock
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking class');
        await unlockClass(this.connection, config.className, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Class unlocked');
      }

      // 8. Final check
      this.logger.info?.('Step 8: Final check');
      await checkClass(this.connection, config.className, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating class');
        this.connection.setSessionType('stateful');
        await activateClass(this.connection, config.className);
        this.connection.setSessionType('stateless');
        this.logger.info?.('Class activated');
      }

      // Read and return result
      const readResponse = await getClassSource(this.connection, config.className, 'active');
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        className: config.className,
        packageName: config.packageName,
        sourceCode
      };
    } catch (error: any) {
      // Restore session type
      this.connection.setSessionType(originalSessionType);

      // Cleanup on error
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking class during error cleanup');
          this.connection.setSessionType('stateful');
          await unlockClass(this.connection, config.className, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting class after failure');
          this.connection.setSessionType('stateful');
          await deleteClass(this.connection, {
            class_name: config.className,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete class after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read class
   */
  async read(
    config: Partial<ClassBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<ClassBuilderConfig | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const response = await getClassSource(this.connection, config.className, version);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        className: config.className,
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
   * Update class with full operation chain
   */
  async update(
    config: Partial<ClassBuilderConfig>,
    options?: UpdateOptions
  ): Promise<ClassBuilderConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    let lockHandle: string | undefined;
    let wasLocked = false;
    const originalSessionType = this.connection.getSessionType?.() || 'stateless';

    try {
      // Enable stateful session for operations
      this.connection.setSessionType('stateful');

      // 1. Lock (or use provided lock handle)
      if (options?.lockHandle) {
        this.logger.info?.('Using provided lock handle');
        lockHandle = options.lockHandle;
        // Note: If lock handle is provided, we assume object is already locked
        // We'll skip unlock in cleanup if lock handle was provided
      } else {
        this.logger.info?.('Step 1: Locking class');
        lockHandle = await lockClass(this.connection, config.className);
        wasLocked = true;
        this.logger.info?.('Class locked, handle:', lockHandle);
      }

      // 2. Check inactive with code/xml for update
      if (config.sourceCode) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkClass(this.connection, config.className, 'inactive', config.sourceCode);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (config.sourceCode && lockHandle) {
        this.logger.info?.('Step 3: Updating class');
        await updateClass(
          this.connection,
          config.className,
          config.sourceCode,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('Class updated');
      }

      // 4. Unlock (only if we locked it)
      if (wasLocked && lockHandle) {
        this.logger.info?.('Step 4: Unlocking class');
        await unlockClass(this.connection, config.className, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Class unlocked');
      }

      // 5. Final check
      this.logger.info?.('Step 5: Final check');
      await checkClass(this.connection, config.className, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating class');
        this.connection.setSessionType('stateful');
        await activateClass(this.connection, config.className);
        this.connection.setSessionType('stateless');
        this.logger.info?.('Class activated');
      }

      // Read and return result
      const readResponse = await getClassSource(this.connection, config.className, 'active');
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        className: config.className,
        sourceCode
      };
    } catch (error: any) {
      // Restore session type
      this.connection.setSessionType(originalSessionType);

      // Cleanup on error (only if we locked it, not if lock handle was provided)
      if (wasLocked && lockHandle) {
        try {
          this.logger.warn?.('Unlocking class during error cleanup');
          this.connection.setSessionType('stateful');
          await unlockClass(this.connection, config.className, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger.warn?.('Deleting class after failure');
          this.connection.setSessionType('stateful');
          await deleteClass(this.connection, {
            class_name: config.className,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete class after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete class
   */
  async delete(config: Partial<ClassBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const originalSessionType = this.connection.getSessionType?.() || 'stateless';

    try {
      // Enable stateful session for operations
      this.connection.setSessionType('stateful');

      // Check for deletion
      this.logger.info?.('Checking class for deletion');
      await checkDeletion(this.connection, {
        class_name: config.className,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Deletion check passed');

      // Delete
      this.logger.info?.('Deleting class');
      const result = await deleteClass(this.connection, {
        class_name: config.className,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Class deleted');

      return result;
    } catch (error: any) {
      this.connection.setSessionType(originalSessionType);
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    } finally {
      this.connection.setSessionType(originalSessionType);
    }
  }

  /**
   * Activate class
   */
  async activate(config: Partial<ClassBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const originalSessionType = this.connection.getSessionType?.() || 'stateless';

    try {
      this.connection.setSessionType('stateful');
      const result = await activateClass(this.connection, config.className);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    } finally {
      this.connection.setSessionType(originalSessionType);
    }
  }

  /**
   * Check class
   */
  async check(
    config: Partial<ClassBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkClass(this.connection, config.className, version, config.sourceCode);
  }
}
