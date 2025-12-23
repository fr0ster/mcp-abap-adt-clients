/**
 * AdtLocalTestClass - High-level CRUD operations for Local Test Classes
 *
 * Local test classes are defined in the testclasses include of an ABAP class.
 * All operations require the parent class to be locked.
 */

import type { IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AdtClass } from './AdtClass';
import { checkClassLocalTestClass } from './check';
import { updateClassTestInclude } from './testclasses';
import type { IClassState } from './types';

export interface ILocalTestClassConfig {
  className: string;
  testClassCode?: string;
  testClassName?: string;
  transportRequest?: string;
}

export class AdtLocalTestClass extends AdtClass {
  public readonly objectType: string = 'LocalTestClass';

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
      'inactive',
    );

    return {
      validationResponse: checkResponse,
      errors: [],
    };
  }

  /**
   * Create local test class with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<ILocalTestClassConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let parentLockHandle: string | undefined;
    const state: IClassState = {
      errors: [],
    };

    try {
      // 1. Lock parent class (stateful only for lock)
      // Lock handle from parent class is sufficient for updating testclasses include
      this.logger?.info?.('Step 1: Locking parent class');
      parentLockHandle = await this.lock({ className: config.className });
      state.lockHandle = parentLockHandle;
      this.logger?.info?.('Parent class locked, handle:', parentLockHandle);

      // 2. Check test class code
      if (config.testClassCode) {
        this.logger?.info?.('Step 2: Checking test class code');
        const checkResponse = await checkClassLocalTestClass(
          this.connection,
          config.className,
          config.testClassCode,
          'inactive',
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Test class check passed');
      }

      // 3. Update test classes (uses parent class lock handle)
      this.logger?.info?.('Step 3: Creating test class');
      const updateResponse = await updateClassTestInclude(
        this.connection,
        config.className,
        config.testClassCode!,
        parentLockHandle,
        config.transportRequest,
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Test class created');

      // 4. Unlock parent class (obligatory stateless after unlock)
      if (parentLockHandle) {
        this.logger?.info?.('Step 4: Unlocking parent class');
        const unlockState = await super.unlock(
          { className: config.className },
          parentLockHandle,
        );
        state.unlockResult = unlockState.unlockResult;
        parentLockHandle = undefined;
      }

      // 5. Activate parent class (if requested)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 5: Activating parent class');
        const activateState = await this.activate({
          className: config.className,
        });
        state.activateResult = activateState.activateResult;
        this.logger?.info?.('Parent class activated');
      }

      return state;
    } catch (error: any) {
      // Cleanup on error
      if (parentLockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await super.unlock({ className: config.className }, parentLockHandle);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock parent class after error:',
            unlockError,
          );
        }
      }

      this.logger?.error('Create LocalTestClass failed:', error);
      throw error;
    }
  }

  /**
   * Read local test class code
   */
  async read(
    config: Partial<ILocalTestClassConfig>,
    version: 'active' | 'inactive' = 'active',
  ): Promise<IClassState | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const { getClassTestClassesInclude } = await import('./read');
      const response = await getClassTestClassesInclude(
        this.connection,
        config.className,
        version,
      );
      return {
        readResult: response,
        errors: [],
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      this.logger?.error('Read LocalTestClass failed:', error);
      throw error;
    }
  }

  /**
   * Update local test class with full operation chain
   * Requires parent class to be locked
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<ILocalTestClassConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.testClassCode;
      if (!codeToUpdate) {
        throw new Error('Test class code is required for update');
      }

      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      const updateResponse = await updateClassTestInclude(
        this.connection,
        config.className,
        codeToUpdate,
        options.lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Test class updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let parentLockHandle: string | undefined;
    const state: IClassState = {
      errors: [],
    };

    try {
      // 1. Lock parent class (stateful only for lock)
      // Lock handle from parent class is sufficient for updating testclasses include
      this.logger?.info?.('Step 1: Locking parent class');
      parentLockHandle = await this.lock({ className: config.className });
      state.lockHandle = parentLockHandle;
      this.logger?.info?.('Parent class locked, handle:', parentLockHandle);

      // 2. Check test class code
      const codeToCheck = options?.sourceCode || config.testClassCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking test class code');
        const checkResponse = await checkClassLocalTestClass(
          this.connection,
          config.className,
          codeToCheck,
          'inactive',
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Test class check passed');
      }

      // 3. Update test classes (uses parent class lock handle)
      this.logger?.info?.('Step 3: Updating test class');
      const updateResponse = await updateClassTestInclude(
        this.connection,
        config.className,
        codeToCheck!,
        parentLockHandle,
        config.transportRequest,
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Test class updated');

      // 4. Unlock parent class (obligatory stateless after unlock)
      if (parentLockHandle) {
        this.logger?.info?.('Step 4: Unlocking parent class');
        const unlockState = await super.unlock(
          { className: config.className },
          parentLockHandle,
        );
        state.unlockResult = unlockState.unlockResult;
        parentLockHandle = undefined;
      }

      // 5. Activate parent class (if requested)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 5: Activating parent class');
        const activateState = await this.activate({
          className: config.className,
        });
        state.activateResult = activateState.activateResult;
        this.logger?.info?.('Parent class activated');
      }

      return state;
    } catch (error: any) {
      // Cleanup on error
      if (parentLockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await super.unlock({ className: config.className }, parentLockHandle);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock parent class after error:',
            unlockError,
          );
        }
      }

      this.logger?.error('Update LocalTestClass failed:', error);
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
      testClassCode: '',
    });
  }

  /**
   * Check local test class code
   * Override to use local test class specific check function
   */
  async check(
    config: Partial<ILocalTestClassConfig>,
    status: string = 'inactive',
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
      status as 'active' | 'inactive',
    );

    return {
      checkResult: checkResponse,
      errors: [],
    };
  }

  // TODO: Investigate lock/unlock/delete operations for local test classes
  // - Currently uses parent class lock (lockClass) for update operations
  // - There is a separate lockClassTestClasses() function that locks /includes/testclasses endpoint
  // - Eclipse ADT logs show parent class lock is used before updating local includes
  // - Need to verify if /includes/testclasses?_action=LOCK endpoint exists in ADT discovery
  // - Delete operation currently uses update() with empty code, but validation prevents empty strings
  // - Consider: Should delete() bypass validation or use a different approach?
}
