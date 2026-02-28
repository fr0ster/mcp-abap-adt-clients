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

import type { IAdtResponse as AxiosResponse } from '@mcp-abap-adt/interfaces';
import {
  AdtObjectErrorCodes,
  type IAbapConnection,
  type IAdtObject,
  type IAdtOperationOptions,
  type ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IReadOptions } from '../shared/types';
import { activateClass } from './activation';
import { checkClass, checkClassLocalTestClass } from './check';
import { create as createClass } from './create';
import { checkDeletion, deleteClass } from './delete';
import { lockClass } from './lock';
import { getClassMetadata, getClassSource, getClassTransport } from './read';
import {
  activateClassTestClasses,
  updateClassTestInclude,
} from './testclasses';
import type { IClassConfig, IClassState } from './types';
import { unlockClass } from './unlock';
import { updateClass } from './update';
import { validateClassName } from './validation';

export class AdtClass implements IAdtObject<IClassConfig, IClassState> {
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'Class';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  /**
   * Validate class configuration before creation
   */
  async validate(config: Partial<IClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }

    try {
      const validationResponse = await validateClassName(
        this.connection,
        config.className,
        config.packageName,
        config.description,
        config.superclass,
      );

      return {
        validationResponse: validationResponse,
        errors: [],
      };
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : JSON.stringify(error.response.data).substring(0, 500)
        : error.message || 'Unknown error';

      this.logger?.error?.(
        `Validate failed: HTTP ${status || '?'} ${statusText || ''}`,
        { status, statusText, message: errorMessage },
      );

      if (status && status >= 400 && status < 500) {
        const customError = new Error(
          `Validation failed for object '${config.className}': ${errorMessage}`,
        ) as any;
        customError.code = AdtObjectErrorCodes.VALIDATION_FAILED;
        customError.status = status;
        customError.statusText = statusText;
        customError.originalError = error;
        throw customError;
      }

      throw error;
    }
  }

  /**
   * Create class with full operation chain
   */
  async create(
    config: IClassConfig,
    options?: IAdtOperationOptions,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    const state: IClassState = {
      errors: [],
    };

    try {
      // Create class (requires stateful)
      this.logger?.info?.('Creating class');
      this.connection.setSessionType('stateful');
      state.createResult = await createClass(
        this.connection,
        {
          class_name: config.className,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description,
          superclass: config.superclass,
          final: config.final,
          abstract: config.abstract,
          create_protected: config.createProtected,
          master_system: config.masterSystem ?? this.systemContext.masterSystem,
          responsible: config.responsible ?? this.systemContext.responsible,
          template_xml: config.classTemplate,
        },
        this.logger,
      );
      objectCreated = true;
      this.connection.setSessionType('stateless');
      this.logger?.info?.('Class created');

      return state;
    } catch (error: any) {
      // Cleanup on error - ensure stateless
      this.connection.setSessionType('stateless');

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting class after failure');
          this.connection.setSessionType('stateful');
          await deleteClass(this.connection, {
            class_name: config.className,
            transport_request: config.transportRequest,
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete class after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read class
   */
  async read(
    config: Partial<IClassConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IClassState | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const response = await getClassSource(
        this.connection,
        config.className,
        version,
        options,
      );
      return {
        readResult: response,
        errors: [],
      };
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : JSON.stringify(error.response.data).substring(0, 500)
        : error.message || 'Unknown error';

      // Log error details
      this.logger?.error?.(
        `Read failed: HTTP ${status || '?'} ${statusText || ''}`,
        { status, statusText, message: errorMessage },
      );

      // 404 - object doesn't exist
      if (status === 404) {
        return undefined;
      }

      // 4** errors - throw with error code
      if (status && status >= 400 && status < 500) {
        const customError = new Error(
          `Failed to read object '${config.className}': ${errorMessage}`,
        ) as any;
        customError.code = AdtObjectErrorCodes.OBJECT_NOT_FOUND;
        customError.status = status;
        customError.statusText = statusText;
        customError.originalError = error;
        throw customError;
      }

      throw error;
    }
  }

  /**
   * Read class metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(
    config: Partial<IClassConfig>,
    options?: IReadOptions,
  ): Promise<IClassState> {
    const state: IClassState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getClassMetadata(
        this.connection,
        config.className,
        options,
      );
      state.metadataResult = response;
      this.logger?.info?.('Class metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readMetadata',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Read metadata failed:', err);
      throw err;
    }
  }

  /**
   * Update class with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) {
        throw new Error('Source code is required for update');
      }

      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      const updateResponse = await updateClass(
        this.connection,
        config.className,
        codeToUpdate,
        options.lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Class updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;
    const state: IClassState = {
      errors: [],
    };

    try {
      // 1. Lock (update always starts with lock, stateful only for lock)
      this.logger?.info?.('Step 1: Locking class');
      this.connection.setSessionType('stateful');
      lockHandle = await lockClass(this.connection, config.className);
      state.lockHandle = lockHandle;
      this.logger?.info?.('Class locked, handle:', lockHandle);

      // 2. Check inactive with code/xml for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        state.checkResult = await checkClass(
          this.connection,
          config.className,
          'inactive',
          codeToCheck,
        );
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating class');
        state.updateResult = await updateClass(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest,
        );
        this.logger?.info?.('Class updated');

        // 3.5. Read with long polling to ensure object is ready after update
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read({ className: config.className }, 'active', {
            withLongPolling: true,
          });
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            readError,
          );
          // Continue anyway - unlock might still work
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking class');
        state.unlockResult = await unlockClass(
          this.connection,
          config.className,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Class unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      state.checkResult = await checkClass(
        this.connection,
        config.className,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating class');
        const activateResult = await activateClass(
          this.connection,
          config.className,
        );
        state.activateResult = activateResult;
        this.logger?.info?.('Class activated, status:', activateResult.status);

        // 6.5. Read with long polling to ensure object is ready after activation
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          const readState = await this.read(
            { className: config.className },
            'active',
            { withLongPolling: true },
          );
          if (readState) {
            state.readResult = readState.readResult;
          }
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            readError,
          );
          // Continue anyway - activation was successful
        }
      }

      return state;
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
            transport_request: config.transportRequest,
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete class after failure:',
            deleteError,
          );
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete class
   */
  async delete(config: Partial<IClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const state: IClassState = {
      errors: [],
    };

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking class for deletion');
      const checkResult = await checkDeletion(this.connection, {
        class_name: config.className,
        transport_request: config.transportRequest,
      });
      state.checkResult = checkResult;
      this.logger?.info?.('Deletion check passed');

      // Delete (requires stateful, but no lock)
      this.logger?.info?.('Deleting class');
      this.connection.setSessionType('stateful');
      const deleteResult = await deleteClass(this.connection, {
        class_name: config.className,
        transport_request: config.transportRequest,
      });
      state.deleteResult = deleteResult;
      this.logger?.info?.('Class deleted');

      return state;
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : JSON.stringify(error.response.data).substring(0, 500)
        : error.message || 'Unknown error';

      this.logger?.error?.(
        `Delete failed: HTTP ${status || '?'} ${statusText || ''}`,
        { status, statusText, message: errorMessage },
      );

      if (status && status >= 400 && status < 500) {
        const customError = new Error(
          `Deletion failed for object '${config.className}': ${errorMessage}`,
        ) as any;
        customError.code = AdtObjectErrorCodes.DELETE_FAILED;
        customError.status = status;
        customError.statusText = statusText;
        customError.originalError = error;
        throw customError;
      }

      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Activate class
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const state: IClassState = {
      errors: [],
    };

    try {
      const activateResult = await activateClass(
        this.connection,
        config.className,
      );
      state.activateResult = activateResult;
      return state;
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : JSON.stringify(error.response.data).substring(0, 500)
        : error.message || 'Unknown error';

      this.logger?.error?.(
        `Activate failed: HTTP ${status || '?'} ${statusText || ''}`,
        { status, statusText, message: errorMessage },
      );

      if (status && status >= 400 && status < 500) {
        const customError = new Error(
          `Activation failed for object '${config.className}': ${errorMessage}`,
        ) as any;
        customError.code = AdtObjectErrorCodes.ACTIVATE_FAILED;
        customError.status = status;
        customError.statusText = statusText;
        customError.originalError = error;
        throw customError;
      }

      throw error;
    }
  }

  /**
   * Check class
   */
  async check(
    config: Partial<IClassConfig>,
    status?: string,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      // Map status to version
      const version: 'active' | 'inactive' =
        status === 'active' ? 'active' : 'inactive';
      const response = await checkClass(
        this.connection,
        config.className,
        version,
        config.sourceCode,
      );

      // Parse response to check for type E errors
      const { parseCheckRunResponse } = await import('../../utils/checkRun');
      const checkResult = parseCheckRunResponse(response);

      // If there are errors (type E), throw error
      if (checkResult.has_errors) {
        const errorMessages = checkResult.errors
          .map((e: any) => e.text || '')
          .join('; ');
        const customError = new Error(
          `Check failed for object '${config.className}': ${errorMessages || checkResult.message}`,
        ) as any;
        customError.code = AdtObjectErrorCodes.CHECK_FAILED;
        customError.status = response.status;
        customError.statusText = response.statusText;
        customError.checkResult = checkResult;
        throw customError;
      }

      const state: IClassState = {
        checkResult: response,
        errors: [],
      };
      return state;
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : JSON.stringify(error.response.data).substring(0, 500)
        : error.message || 'Unknown error';

      this.logger?.error?.(
        `Check failed: HTTP ${status || '?'} ${statusText || ''}`,
        { status, statusText, message: errorMessage },
      );

      // If error already has code (from checkResult parsing), rethrow
      if (error.code) {
        throw error;
      }

      // 4** errors - throw with error code
      if (status && status >= 400 && status < 500) {
        const customError = new Error(
          `Check failed for object '${config.className}': ${errorMessage}`,
        ) as any;
        customError.code = AdtObjectErrorCodes.CHECK_FAILED;
        customError.status = status;
        customError.statusText = statusText;
        customError.originalError = error;
        throw customError;
      }

      throw error;
    }
  }

  /**
   * Lock class
   */
  async lock(config: Partial<IClassConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    this.connection.setSessionType('stateful');
    return await lockClass(this.connection, config.className);
  }

  /**
   * Unlock class
   */
  async unlock(
    config: Partial<IClassConfig>,
    lockHandle: string,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const result = await unlockClass(
      this.connection,
      config.className,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }

  /**
   * Lock test classes (local classes) for modification
   * Uses parent class lock - sufficient for updating testclasses include
   */
  async lockTestClasses(config: Partial<IClassConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    this.connection.setSessionType('stateful');
    return await lockClass(this.connection, config.className);
  }

  /**
   * Unlock test classes (local classes)
   * Uses parent class unlock
   */
  async unlockTestClasses(
    config: Partial<IClassConfig>,
    lockHandle: string,
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const result = await unlockClass(
      this.connection,
      config.className,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return result;
  }

  /**
   * Check test class code (local class)
   */
  async checkTestClass(
    config: Partial<IClassConfig> & { testClassCode: string },
    version: 'active' | 'inactive' = 'inactive',
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
      version,
    );
  }

  /**
   * Update test classes (local classes) with full operation chain
   * Always starts with lock of parent class
   */
  async updateTestClasses(
    config: Partial<IClassConfig> & { testClassCode: string },
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      // Lock handle from parent class is sufficient for updating testclasses include
      this.logger?.info?.('Step 1: Locking parent class');
      this.connection.setSessionType('stateful');
      lockHandle = await lockClass(this.connection, config.className);
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Update test classes (uses parent class lock handle)
      this.logger?.info?.('Step 2: Updating test classes');
      const response = await updateClassTestInclude(
        this.connection,
        config.className,
        config.testClassCode,
        lockHandle,
        config.transportRequest,
      );

      // 3. Unlock parent class (switch to stateless after unlock)
      this.logger?.info?.('Step 3: Unlocking parent class');
      await unlockClass(this.connection, config.className, lockHandle);
      this.connection.setSessionType('stateless');
      lockHandle = undefined;

      return response;
    } catch (error) {
      // Cleanup: unlock on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class after error');
          await unlockClass(this.connection, config.className, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock parent class after error:',
            unlockError,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Activate test classes (local classes)
   */
  async activateTestClasses(
    config: Partial<IClassConfig> & { testClassName: string },
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
      config.testClassName,
    );
  }

  /**
   * Read transport request information for the class
   */
  async readTransport(
    config: Partial<IClassConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IClassState> {
    const state: IClassState = {
      errors: [],
    };

    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }

    try {
      const response = await getClassTransport(
        this.connection,
        config.className,
        options,
      );
      state.transportResult = response;
      this.logger?.info?.('Transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Read transport failed:', err);
      throw err;
    }
  }
}
