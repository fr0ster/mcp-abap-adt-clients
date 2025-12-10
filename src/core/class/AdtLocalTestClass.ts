/**
 * AdtLocalTestClass - High-level CRUD operations for Local Test Classes
 * 
 * Local test classes are defined in the testclasses include of an ABAP class.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { checkClassLocalTestClass } from './check';
import { lockClassTestClasses, unlockClassTestClasses, updateClassTestInclude } from './testclasses';
import { AdtClass } from './AdtClass';
import { IClassState, IClassConfig } from './types';

export interface ILocalTestClassConfig {
  className: string;
  testClassCode?: string;
  testClassName?: string;
  transportRequest?: string;
}

export class AdtLocalTestClass extends AdtClass {
  public readonly objectType: string = 'LocalTestClass';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    super(connection, logger);
  }

  /**
   * Validate local test class code
   */
  async validate(config: Partial<ILocalTestClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required for validation');
    }

    const checkResponse = await checkClassLocalTestClass(
      this.connection,
      config.className,
      config.testClassCode,
      'inactive'
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }

  /**
   * Create local test class with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<ILocalTestClassConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let parentLockHandle: string | undefined;
    let testLockHandle: string | undefined;
    const state: IClassState = {
      errors: []
    };

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      parentLockHandle = await this.lock({ className: config.className });
      state.lockHandle = parentLockHandle;
      this.logger?.info?.('Parent class locked, handle:', parentLockHandle);

      // 2. Lock test classes
      this.logger?.info?.('Step 2: Locking test classes');
      testLockHandle = await lockClassTestClasses(this.connection, config.className);
      this.logger?.info?.('Test classes locked, handle:', testLockHandle);

      // 3. Check test class code
      if (config.testClassCode) {
        this.logger?.info?.('Step 3: Checking test class code');
        const checkResponse = await checkClassLocalTestClass(
          this.connection,
          config.className,
          config.testClassCode,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Test class check passed');
      }

      // 4. Update test classes
      this.logger?.info?.('Step 4: Creating test class');
      const updateResponse = await updateClassTestInclude(
        this.connection,
        config.className,
        config.testClassCode!,
        testLockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Test class created');

      // 5. Unlock test classes
      this.logger?.info?.('Step 5: Unlocking test classes');
      await unlockClassTestClasses(this.connection, config.className, testLockHandle);
      testLockHandle = undefined;

      // 6. Unlock parent class (obligatory stateless after unlock)
      if (parentLockHandle) {
        this.logger?.info?.('Step 6: Unlocking parent class');
        const unlockResponse = await super.unlock({ className: config.className }, parentLockHandle);
        state.unlockResult = unlockResponse;
        parentLockHandle = undefined;
      }

      // 7. Activate parent class (if requested)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 7: Activating parent class');
        const activateState = await this.activate({ className: config.className });
        state.activateResult = activateState.activateResult;
        this.logger?.info?.('Parent class activated');
      }

      return state;
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
          await super.unlock({ className: config.className }, parentLockHandle);
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
    config: Partial<ILocalTestClassConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IClassState | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const { getClassTestClassesInclude } = await import('./read');
      const response = await getClassTestClassesInclude(this.connection, config.className, version);
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      logErrorSafely(this.logger, 'Read LocalTestClass', error);
      throw error;
    }
  }

  /**
   * Update local test class with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<ILocalTestClassConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let parentLockHandle: string | undefined;
    let testLockHandle: string | undefined;
    const state: IClassState = {
      errors: []
    };

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      parentLockHandle = await this.lock({ className: config.className });
      state.lockHandle = parentLockHandle;
      this.logger?.info?.('Parent class locked, handle:', parentLockHandle);

      // 2. Lock test classes
      this.logger?.info?.('Step 2: Locking test classes');
      testLockHandle = await lockClassTestClasses(this.connection, config.className);
      this.logger?.info?.('Test classes locked, handle:', testLockHandle);

      // 3. Check test class code
      const codeToCheck = options?.sourceCode || config.testClassCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 3: Checking test class code');
        const checkResponse = await checkClassLocalTestClass(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Test class check passed');
      }

      // 4. Update test classes
      this.logger?.info?.('Step 4: Updating test class');
      const updateResponse = await updateClassTestInclude(
        this.connection,
        config.className,
        codeToCheck!,
        testLockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Test class updated');

      // 5. Unlock test classes
      this.logger?.info?.('Step 5: Unlocking test classes');
      await unlockClassTestClasses(this.connection, config.className, testLockHandle);
      testLockHandle = undefined;

      // 6. Unlock parent class (obligatory stateless after unlock)
      if (parentLockHandle) {
        this.logger?.info?.('Step 6: Unlocking parent class');
        const unlockResponse = await super.unlock({ className: config.className }, parentLockHandle);
        state.unlockResult = unlockResponse;
        parentLockHandle = undefined;
      }

      // 7. Activate parent class (if requested)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 7: Activating parent class');
        const activateState = await this.activate({ className: config.className });
        state.activateResult = activateState.activateResult;
        this.logger?.info?.('Parent class activated');
      }

      return state;
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
          await super.unlock({ className: config.className }, parentLockHandle);
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
  async delete(config: Partial<ILocalTestClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    return await this.update({
      ...config,
      testClassCode: ''
    });
  }

  /**
   * Check local test class code
   * Override to use local test class specific check function
   */
  async check(
    config: Partial<ILocalTestClassConfig>,
    status: string = 'inactive'
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    const checkResponse = await checkClassLocalTestClass(
      this.connection,
      config.className,
      config.testClassCode,
      status as 'active' | 'inactive'
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }
}
