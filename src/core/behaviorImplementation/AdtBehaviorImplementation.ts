/**
 * AdtBehaviorImplementation - High-level CRUD operations for Behavior Implementation objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Behavior Implementation is a special form of class (CLAS/OC) with:
 * - Empty main class source
 * - Special implementations include (local handler class)
 * 
 * Uses composition with AdtClass for most operations, overriding only
 * methods that work with implementations include (update, read).
 * 
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 * 
 * Operation chains:
 * - Create: validate → create (via AdtClass) → check → lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Update: lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Delete: check(deletion) → delete (via AdtClass)
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { BehaviorImplementationBuilderConfig } from './types';
import { validateBehaviorImplementationName } from './validation';
import { updateBehaviorImplementation } from './update';
import { getBehaviorImplementationSource } from './read';
import { getSystemInformation } from '../../utils/systemInfo';
import { AdtClass } from '../class';

export class AdtBehaviorImplementation implements IAdtObject<BehaviorImplementationBuilderConfig, BehaviorImplementationBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  private readonly class: AdtClass;
  public readonly objectType: string = 'BehaviorImplementation';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
    this.class = new AdtClass(connection, logger);
  }

  /**
   * Validate behavior implementation configuration before creation
   */
  async validate(config: Partial<BehaviorImplementationBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.behaviorDefinition) {
      throw new Error('Behavior definition is required for validation');
    }

    return await validateBehaviorImplementationName(
      this.connection,
      config.className,
      config.packageName,
      config.description,
      config.behaviorDefinition
    );
  }

  /**
   * Create behavior implementation with full operation chain
   */
  async create(
    config: BehaviorImplementationBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<BehaviorImplementationBuilderConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.behaviorDefinition) {
      throw new Error('Behavior definition is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const systemInfo = await getSystemInformation(this.connection);
    const username = systemInfo?.userName || '';
    const masterSystem = systemInfo?.systemID;

    try {
      // 1. Validate (no stateful needed)
      this.logger.info?.('Step 1: Validating behavior implementation configuration');
      await validateBehaviorImplementationName(
        this.connection,
        config.className,
        config.packageName,
        config.description,
        config.behaviorDefinition
      );
      this.logger.info?.('Validation passed');

      // 2. Create class via AdtClass (creates empty class, sets stateful internally, then stateless after unlock)
      // We pass empty sourceCode to skip the update step in AdtClass.create(), since we need to update implementations include separately
      this.logger.info?.('Step 2: Creating behavior implementation class');
      await this.class.create(
        {
          className: config.className,
          packageName: config.packageName,
          transportRequest: config.transportRequest,
          description: config.description,
          masterSystem: masterSystem,
          responsible: username,
          sourceCode: '' // Empty to skip update in AdtClass.create(), we'll update implementations include separately
        },
        { activateOnCreate: false } // Don't activate yet, we need to update implementations include first
      );
      objectCreated = true;
      this.logger.info?.('Behavior implementation class created');

      // 3. Check after create (no stateful needed - AdtClass.create() sets stateless after unlock)
      this.logger.info?.('Step 3: Checking created behavior implementation class');
      await this.class.check({ className: config.className }, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock for updating implementations include (stateful set inside lock method)
      this.logger.info?.('Step 4: Locking behavior implementation class');
      lockHandle = await this.class.lock({ className: config.className });
      this.logger.info?.('Behavior implementation class locked, handle:', lockHandle);

      // 5. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.implementationCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await this.class.check({ className: config.className, sourceCode: codeToCheck }, 'inactive');
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update implementations include
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating behavior implementation implementations include');
        await updateBehaviorImplementation(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('Behavior implementation updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking behavior implementation class');
        await this.class.unlock({ className: config.className }, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Behavior implementation class unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await this.class.check({ className: config.className }, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating behavior implementation class');
        const activateResponse = await this.class.activate({ className: config.className });
        this.logger.info?.('Behavior implementation class activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          className: config.className,
          packageName: config.packageName,
          behaviorDefinition: config.behaviorDefinition
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getBehaviorImplementationSource(this.connection, config.className);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        className: config.className,
        packageName: config.packageName,
        behaviorDefinition: config.behaviorDefinition,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking behavior implementation class during error cleanup');
          await this.class.unlock({ className: config.className }, lockHandle);
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
          this.logger.warn?.('Deleting behavior implementation class after failure');
          await this.class.delete({
            className: config.className,
            transportRequest: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete behavior implementation class after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read behavior implementation
   */
  async read(
    config: Partial<BehaviorImplementationBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<BehaviorImplementationBuilderConfig | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const response = await getBehaviorImplementationSource(this.connection, config.className, version);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        className: config.className,
        behaviorDefinition: config.behaviorDefinition || '',
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
   * Update behavior implementation with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<BehaviorImplementationBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<BehaviorImplementationBuilderConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (update always starts with lock, stateful set inside lock method)
      this.logger.info?.('Step 1: Locking behavior implementation class');
      lockHandle = await this.class.lock({ className: config.className });
      this.logger.info?.('Behavior implementation class locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.implementationCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await this.class.check({ className: config.className, sourceCode: codeToCheck }, 'inactive');
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update implementations include
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 3: Updating behavior implementation');
        await updateBehaviorImplementation(
          this.connection,
          config.className,
          codeToCheck,
          lockHandle,
          config.transportRequest
        );
        this.logger.info?.('Behavior implementation updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking behavior implementation class');
        await this.class.unlock({ className: config.className }, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Behavior implementation class unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await this.class.check({ className: config.className }, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating behavior implementation class');
        const activateResponse = await this.class.activate({ className: config.className });
        this.logger.info?.('Behavior implementation class activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info (activation returns 201)
        return {
          className: config.className,
          behaviorDefinition: config.behaviorDefinition || ''
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getBehaviorImplementationSource(this.connection, config.className);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        className: config.className,
        behaviorDefinition: config.behaviorDefinition || '',
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking behavior implementation class during error cleanup');
          await this.class.unlock({ className: config.className }, lockHandle);
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
          this.logger.warn?.('Deleting behavior implementation class after failure');
          await this.class.delete({
            className: config.className,
            transportRequest: config.transportRequest
          });
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete behavior implementation class after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete behavior implementation
   */
  async delete(config: Partial<BehaviorImplementationBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      // Delete via AdtClass (handles check and delete)
      this.logger.info?.('Deleting behavior implementation class');
      const result = await this.class.delete({
        className: config.className,
        transportRequest: config.transportRequest
      });
      this.logger.info?.('Behavior implementation class deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    }
  }

  /**
   * Activate behavior implementation
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<BehaviorImplementationBuilderConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      return await this.class.activate({ className: config.className });
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check behavior implementation
   */
  async check(
    config: Partial<BehaviorImplementationBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.class.check({ className: config.className }, status);
  }
}
