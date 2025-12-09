/**
 * AdtClass - High-level CRUD operations for Class objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Uses low-level functions directly (not Builder classes).
 * 
 * Session management:
 * - stateful: only when doing lock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * 
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { ClassBuilderConfig } from './types';
import { validateClassName } from './validation';
import { create as createClass } from './create';
import { checkClass, checkClassLocalTestClass } from './check';
import { lockClass } from './lock';
import { updateClass } from './update';
import { unlockClass } from './unlock';
import { activateClass } from './activation';
import { checkDeletion, deleteClass } from './delete';
import { getClassSource } from './read';
import { lockClassTestClasses, unlockClassTestClasses, updateClassTestInclude, activateClassTestClasses } from './testclasses';

export class AdtClass implements IAdtObject<ClassBuilderConfig, ClassBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  public readonly objectType: string = 'Class';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
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
    options?: IAdtOperationOptions
  ): Promise<ClassBuilderConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating class configuration');
      await validateClassName(
        this.connection,
        config.className,
        config.packageName,
        config.description,
        config.superclass
      );
      this.logger?.info?.('Validation passed');

      // 2. Create (requires stateful)
      this.logger?.info?.('Step 2: Creating class');
      this.connection.setSessionType('stateful');
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
      this.logger?.info?.('Class created');

      // 3. Check after create (stateful still set from create)
      this.logger?.info?.('Step 3: Checking created class');
      await checkClass(this.connection, config.className, 'inactive');
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful already set, keep it)
      this.logger?.info?.('Step 4: Locking class');
      lockHandle = await lockClass(this.connection, config.className);
      this.logger?.info?.('Class locked, handle:', lockHandle);

      // 5. Check inactive with code/xml for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        await checkClass(this.connection, config.className, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating class with source code');
        await updateClass(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger?.info?.('Class updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking class');
        await unlockClass(this.connection, config.className, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Class unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      await checkClass(this.connection, config.className, 'inactive');
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating class');
        const activateResponse = await activateClass(this.connection, config.className);
        this.logger?.info?.('Class activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info without sourceCode (activation returns 201)
        return {
          className: config.className,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
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
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking class during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockClass(this.connection, config.className, lockHandle);
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
          this.logger?.warn?.('Deleting class after failure');
          this.connection.setSessionType('stateful');
          await deleteClass(this.connection, {
            class_name: config.className,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete class after failure:', deleteError);
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
   * Always starts with lock
   */
  async update(
    config: Partial<ClassBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<ClassBuilderConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful only for lock)
      this.logger?.info?.('Step 1: Locking class');
      this.connection.setSessionType('stateful');
      lockHandle = await lockClass(this.connection, config.className);
      this.logger?.info?.('Class locked, handle:', lockHandle);

      // 2. Check inactive with code/xml for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        await checkClass(this.connection, config.className, 'inactive', codeToCheck);
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating class');
        await updateClass(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger?.info?.('Class updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking class');
        await unlockClass(this.connection, config.className, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Class unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkClass(this.connection, config.className, 'inactive');
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating class');
        const activateResponse = await activateClass(this.connection, config.className);
        this.logger?.info?.('Class activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info without sourceCode (activation returns 201)
        return {
          className: config.className
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getClassSource(this.connection, config.className, 'active');
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        className: config.className,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking class during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockClass(this.connection, config.className, lockHandle);
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
          this.logger?.warn?.('Deleting class after failure');
          this.connection.setSessionType('stateful');
          await deleteClass(this.connection, {
            class_name: config.className,
            transport_request: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete class after failure:', deleteError);
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

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking class for deletion');
      await checkDeletion(this.connection, {
        class_name: config.className,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Deletion check passed');

      // Delete (requires stateful, but no lock)
      this.logger?.info?.('Deleting class');
      this.connection.setSessionType('stateful');
      const result = await deleteClass(this.connection, {
        class_name: config.className,
        transport_request: config.transportRequest
      });
      this.logger?.info?.('Class deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Activate class
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<ClassBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const result = await activateClass(this.connection, config.className);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
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


  /**
   * Lock class
   */
  async lock(config: Partial<ClassBuilderConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockClass(this.connection, config.className);
  }

  /**
   * Unlock class
   */
  async unlock(config: Partial<ClassBuilderConfig>, lockHandle: string): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    return await unlockClass(this.connection, config.className, lockHandle);
  }

  /**
   * Lock test classes (local classes) for modification
   */
  async lockTestClasses(config: Partial<ClassBuilderConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    this.connection.setSessionType('stateful');
    return await lockClassTestClasses(this.connection, config.className);
  }

  /**
   * Unlock test classes (local classes)
   */
  async unlockTestClasses(config: Partial<ClassBuilderConfig>, lockHandle: string): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const result = await unlockClassTestClasses(this.connection, config.className, lockHandle);
    this.connection.setSessionType('stateless');
    return result;
  }

  /**
   * Check test class code (local class)
   */
  async checkTestClass(
    config: Partial<ClassBuilderConfig> & { testClassCode: string },
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }
    return await checkClassLocalTestClass(
      this.connection,
      config.className,
      config.testClassCode,
      version
    );
  }

  /**
   * Update test classes (local classes) with full operation chain
   * Always starts with lock
   */
  async updateTestClasses(
    config: Partial<ClassBuilderConfig> & { testClassCode: string }
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock test classes (stateful only for lock)
      this.logger?.info?.('Step 1: Locking test classes');
      this.connection.setSessionType('stateful');
      lockHandle = await lockClassTestClasses(this.connection, config.className);
      this.logger?.info?.('Test classes locked, handle:', lockHandle);

      // 2. Update test classes
      this.logger?.info?.('Step 2: Updating test classes');
      const response = await updateClassTestInclude(
        this.connection,
        config.className,
        config.testClassCode,
        lockHandle,
        config.transportRequest
      );

      // 3. Unlock test classes (switch to stateless after unlock)
      this.logger?.info?.('Step 3: Unlocking test classes');
      await unlockClassTestClasses(this.connection, config.className, lockHandle);
      this.connection.setSessionType('stateless');

      return response;
    } catch (error) {
      // Cleanup: unlock on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking test classes after error');
          await unlockClassTestClasses(this.connection, config.className, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock test classes after error:', unlockError);
        }
      }
      throw error;
    }
  }

  /**
   * Activate test classes (local classes)
   */
  async activateTestClasses(
    config: Partial<ClassBuilderConfig> & { testClassName: string }
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassName) {
      throw new Error('Test class name is required');
    }
    return await activateClassTestClasses(
      this.connection,
      config.className,
      config.testClassName
    );
  }
}
