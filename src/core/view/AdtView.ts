/**
 * AdtView - High-level CRUD operations for View (DDLS) objects
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
import { ViewBuilderConfig } from './types';
import { validateViewName } from './validation';
import { createView } from './create';
import { checkView } from './check';
import { lockDDLS } from './lock';
import { updateView } from './update';
import { unlockDDLS } from './unlock';
import { activateDDLS } from './activation';
import { checkDeletion, deleteView } from './delete';
import { getViewSource } from './read';

export class AdtView implements IAdtObject<ViewBuilderConfig, ViewBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'View';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate view configuration before creation
   */
  async validate(config: Partial<ViewBuilderConfig>): Promise<AxiosResponse> {
    if (!config.viewName) {
      throw new Error('View name is required for validation');
    }

    return await validateViewName(
      this.connection,
      config.viewName,
      config.packageName,
      config.description
    );
  }

  /**
   * Create view with full operation chain
   */
  async create(
    config: ViewBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<ViewBuilderConfig> {
    if (!config.viewName) {
      throw new Error('View name is required');
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
      this.logger.info?.('Step 1: Validating view configuration');
      await validateViewName(
        this.connection,
        config.viewName,
        config.packageName,
        config.description
      );
      this.logger.info?.('Validation passed');

      // 2. Create (no stateful needed)
      this.logger.info?.('Step 2: Creating view');
      await createView(this.connection, {
        view_name: config.viewName,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        ddl_source: options?.sourceCode || config.ddlSource
      });
      objectCreated = true;
      this.logger.info?.('View created');

      // 3. Check after create (no stateful needed)
      this.logger.info?.('Step 3: Checking created view');
      await checkView(this.connection, config.viewName, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock (stateful ONLY before lock)
      this.logger.info?.('Step 4: Locking view');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDDLS(this.connection, config.viewName);
      this.logger.info?.('View locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.ddlSource;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkView(this.connection, config.viewName, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating view with DDL source');
        await updateView(
          this.connection,
          config.viewName,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('View updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking view');
        await unlockDDLS(this.connection, config.viewName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('View unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await checkView(this.connection, config.viewName, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating view');
        const activateResponse = await activateDDLS(this.connection, config.viewName);
        this.logger.info?.('View activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          viewName: config.viewName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getViewSource(this.connection, config.viewName);
      const ddlSource = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        viewName: config.viewName,
        packageName: config.packageName,
        ddlSource
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking view during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDDLS(this.connection, config.viewName, lockHandle);
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
          this.logger.warn?.('Deleting view after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteView(this.connection, {
            view_name: config.viewName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete view after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read view
   */
  async read(
    config: Partial<ViewBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<ViewBuilderConfig | undefined> {
    if (!config.viewName) {
      throw new Error('View name is required');
    }

    try {
      const response = await getViewSource(this.connection, config.viewName);
      const ddlSource = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        viewName: config.viewName,
        ddlSource
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Update view with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<ViewBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<ViewBuilderConfig> {
    if (!config.viewName) {
      throw new Error('View name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful ONLY before lock)
      this.logger.info?.('Step 1: Locking view');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDDLS(this.connection, config.viewName);
      this.logger.info?.('View locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.ddlSource;
      if (codeToCheck) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkView(this.connection, config.viewName, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 3: Updating view');
        await updateView(
          this.connection,
          config.viewName,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('View updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking view');
        await unlockDDLS(this.connection, config.viewName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('View unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await checkView(this.connection, config.viewName, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating view');
        const activateResponse = await activateDDLS(this.connection, config.viewName);
        this.logger.info?.('View activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          viewName: config.viewName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getViewSource(this.connection, config.viewName);
      const ddlSource = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        viewName: config.viewName,
        ddlSource
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking view during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockDDLS(this.connection, config.viewName, lockHandle);
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
          this.logger.warn?.('Deleting view after failure');
          // No stateful needed - delete doesn't use lock/unlock
          await deleteView(this.connection, {
            view_name: config.viewName,
            transport_request: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete view after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete view
   */
  async delete(config: Partial<ViewBuilderConfig>): Promise<AxiosResponse> {
    if (!config.viewName) {
      throw new Error('View name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger.info?.('Checking view for deletion');
      await checkDeletion(this.connection, {
        view_name: config.viewName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('Deletion check passed');

      // Delete (no stateful needed - no lock/unlock)
      this.logger.info?.('Deleting view');
      const result = await deleteView(this.connection, {
        view_name: config.viewName,
        transport_request: config.transportRequest
      });
      this.logger.info?.('View deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate view
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<ViewBuilderConfig>): Promise<AxiosResponse> {
    if (!config.viewName) {
      throw new Error('View name is required');
    }

    try {
      const result = await activateDDLS(this.connection, config.viewName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check view
   */
  async check(
    config: Partial<ViewBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.viewName) {
      throw new Error('View name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkView(this.connection, config.viewName, version);
  }
}
