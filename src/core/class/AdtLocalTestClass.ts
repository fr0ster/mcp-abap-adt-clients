/**
 * AdtLocalTestClass - High-level CRUD operations for Local Test Classes
 * 
 * Local test classes are defined in the testclasses include of an ABAP class.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { checkClassLocalTestClass } from './check';
import { lockClassTestClasses, unlockClassTestClasses, updateClassTestInclude } from './testclasses';
import { AdtClass } from './AdtClass';

export interface LocalTestClassConfig {
  className: string;
  testClassCode?: string;
  testClassName?: string;
  transportRequest?: string;
}

export class AdtLocalTestClass implements IAdtObject<LocalTestClassConfig, LocalTestClassConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  private readonly adtClass: AdtClass;
  public readonly objectType: string = 'LocalTestClass';

  constructor(connection: IAbapConnection, adtClass?: AdtClass, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = adtClass || new AdtClass(connection, logger);
  }

  /**
   * Validate local test class code
   */
  async validate(config: Partial<LocalTestClassConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required for validation');
    }

    return await checkClassLocalTestClass(
      this.connection,
      config.className,
      config.testClassCode,
      'inactive'
    );
  }

  /**
   * Create local test class with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<LocalTestClassConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalTestClassConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let parentLockHandle: string | undefined;
    let testLockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      this.connection.setSessionType('stateful');
      parentLockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', parentLockHandle);

      // 2. Lock test classes
      this.logger?.info?.('Step 2: Locking test classes');
      testLockHandle = await lockClassTestClasses(this.connection, config.className);
      this.logger?.info?.('Test classes locked, handle:', testLockHandle);

      // 3. Check test class code
      if (config.testClassCode) {
        this.logger?.info?.('Step 3: Checking test class code');
        await checkClassLocalTestClass(
          this.connection,
          config.className,
          config.testClassCode,
          'inactive'
        );
        this.logger?.info?.('Test class check passed');
      }

      // 4. Update test classes
      this.logger?.info?.('Step 4: Creating test class');
      await updateClassTestInclude(
        this.connection,
        config.className,
        config.testClassCode!,
        testLockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Test class created');

      // 5. Unlock test classes
      this.logger?.info?.('Step 5: Unlocking test classes');
      await unlockClassTestClasses(this.connection, config.className, testLockHandle);
      testLockHandle = undefined;

      // 6. Unlock parent class (obligatory stateless after unlock)
      if (parentLockHandle) {
        this.logger?.info?.('Step 6: Unlocking parent class');
        await this.adtClass.unlock({ className: config.className }, parentLockHandle);
        parentLockHandle = undefined;
      }

      // 7. Activate parent class (if requested)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 7: Activating parent class');
        await this.adtClass.activate({ className: config.className });
        this.logger?.info?.('Parent class activated');
      }

      return {
        className: config.className,
        testClassCode: config.testClassCode,
        testClassName: config.testClassName,
        transportRequest: config.transportRequest
      };
    } catch (error: any) {
      // Cleanup on error
      if (testLockHandle) {
        try {
          this.logger?.warn?.('Unlocking test classes during error cleanup');
          await unlockClassTestClasses(this.connection, config.className, testLockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock test classes after error:', unlockError);
        }
      }
      if (parentLockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await this.adtClass.unlock({ className: config.className }, parentLockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock parent class after error:', unlockError);
        }
      }

      logErrorSafely(this.logger, 'Create LocalTestClass', error);
      throw error;
    }
  }

  /**
   * Read local test class code
   */
  async read(
    config: Partial<LocalTestClassConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<LocalTestClassConfig | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Reading test classes requires reading the parent class and extracting test classes
    // This is a simplified implementation - in practice, you'd need to parse the class source
    // For now, return basic config
    return {
      className: config.className,
      testClassName: config.testClassName
    };
  }

  /**
   * Update local test class with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<LocalTestClassConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalTestClassConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let parentLockHandle: string | undefined;
    let testLockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      parentLockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', parentLockHandle);

      // 2. Lock test classes
      this.logger?.info?.('Step 2: Locking test classes');
      testLockHandle = await lockClassTestClasses(this.connection, config.className);
      this.logger?.info?.('Test classes locked, handle:', testLockHandle);

      // 3. Check test class code
      const codeToCheck = options?.sourceCode || config.testClassCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 3: Checking test class code');
        await checkClassLocalTestClass(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Test class check passed');
      }

      // 4. Update test classes
      this.logger?.info?.('Step 4: Updating test class');
      await updateClassTestInclude(
        this.connection,
        config.className,
        codeToCheck!,
        testLockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Test class updated');

      // 5. Unlock test classes
      this.logger?.info?.('Step 5: Unlocking test classes');
      await unlockClassTestClasses(this.connection, config.className, testLockHandle);
      testLockHandle = undefined;

      // 6. Unlock parent class (obligatory stateless after unlock)
      if (parentLockHandle) {
        this.logger?.info?.('Step 6: Unlocking parent class');
        await this.adtClass.unlock({ className: config.className }, parentLockHandle);
        parentLockHandle = undefined;
      }

      // 7. Activate parent class (if requested)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 7: Activating parent class');
        await this.adtClass.activate({ className: config.className });
        this.logger?.info?.('Parent class activated');
      }

      return {
        className: config.className,
        testClassCode: config.testClassCode,
        testClassName: config.testClassName,
        transportRequest: config.transportRequest
      };
    } catch (error: any) {
      // Cleanup on error
      if (testLockHandle) {
        try {
          this.logger?.warn?.('Unlocking test classes during error cleanup');
          await unlockClassTestClasses(this.connection, config.className, testLockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock test classes after error:', unlockError);
        }
      }
      if (parentLockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await this.adtClass.unlock({ className: config.className }, parentLockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock parent class after error:', unlockError);
        }
      }

      logErrorSafely(this.logger, 'Update LocalTestClass', error);
      throw error;
    }
  }

  /**
   * Delete local test class
   * Performs update with empty code to remove the test class
   */
  async delete(config: Partial<LocalTestClassConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    await this.update({
      ...config,
      testClassCode: ''
    });
    
    // Return empty response (update already completed)
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config: {} } as AxiosResponse;
  }

  /**
   * Activate parent class (local test classes are activated with parent class)
   */
  async activate(config: Partial<LocalTestClassConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.activate({ className: config.className });
  }

  /**
   * Check local test class code
   */
  async check(
    config: Partial<LocalTestClassConfig>,
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
   * Lock parent class (required for local test classes operations)
   */
  async lock(config: Partial<LocalTestClassConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.lock({ className: config.className });
  }

  /**
   * Unlock parent class
   */
  async unlock(config: Partial<LocalTestClassConfig>, lockHandle: string): Promise<void> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!lockHandle) {
      throw new Error('Lock handle is required');
    }

    await this.adtClass.unlock({ className: config.className }, lockHandle);
  }
}
