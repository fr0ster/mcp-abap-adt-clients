/**
 * AdtLocalMacros - High-level CRUD operations for Local Macros
 * 
 * Local macros are defined in the macros include of an ABAP class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { checkClassMacros } from './check';
import { updateClassMacros } from './includes';
import { AdtClass } from './AdtClass';
import { IClassState } from './types';

export interface ILocalMacrosConfig {
  className: string;
  macrosCode?: string;
  transportRequest?: string;
}

export class AdtLocalMacros extends AdtClass {
  public readonly objectType: string = 'LocalMacros';

  constructor(connection: IAbapConnection, logger?: IAdtLogger) {
    super(connection, logger);
  }

  /**
   * Validate local macros code
   */
  async validate(config: Partial<ILocalMacrosConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required for validation');
    }

    const checkResponse = await checkClassMacros(
      this.connection,
      config.className,
      config.macrosCode,
      'inactive'
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }

  /**
   * Create local macros with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<ILocalMacrosConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required');
    }

    let lockHandle: string | undefined;
    const state: IClassState = {
      errors: []
    };

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await super.lock({ className: config.className });
      state.lockHandle = lockHandle;
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local macros code
      const codeToCheck = options?.sourceCode || config.macrosCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local macros code');
        const checkResponse = await checkClassMacros(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Local macros check passed');
      }

      // 3. Update local macros
      this.logger?.info?.('Step 3: Creating local macros');
      const updateResponse = await updateClassMacros(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Local macros created');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      const unlockResponse = await super.unlock({ className: config.className }, lockHandle);
      state.unlockResult = unlockResponse;
      lockHandle = undefined;

      return state;
    } catch (error: any) {
      // Cleanup on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await super.unlock({ className: config.className }, lockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock parent class after error:', unlockError);
        }
      }

      logErrorSafely(this.logger, 'Create LocalMacros', error);
      throw error;
    }
  }

  /**
   * Read local macros code
   */
  async read(
    config: Partial<ILocalMacrosConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IClassState | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const { getClassMacrosInclude } = await import('./read');
      const response = await getClassMacrosInclude(this.connection, config.className, version);
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      logErrorSafely(this.logger, 'Read LocalMacros', error);
      throw error;
    }
  }
  async update(
    config: Partial<ILocalMacrosConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required');
    }

    let lockHandle: string | undefined;
    const state: IClassState = {
      errors: []
    };

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await super.lock({ className: config.className });
      state.lockHandle = lockHandle;
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local macros code
      const codeToCheck = options?.sourceCode || config.macrosCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local macros code');
        const checkResponse = await checkClassMacros(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Local macros check passed');
      }

      // 3. Update local macros
      this.logger?.info?.('Step 3: Updating local macros');
      const updateResponse = await updateClassMacros(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Local macros updated');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      const unlockResponse = await super.unlock({ className: config.className }, lockHandle);
      state.unlockResult = unlockResponse;
      lockHandle = undefined;

      return state;
    } catch (error: any) {
      // Cleanup on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await super.unlock({ className: config.className }, lockHandle);
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock parent class after error:', unlockError);
        }
      }

      logErrorSafely(this.logger, 'Update LocalMacros', error);
      throw error;
    }
  }

  /**
   * Delete local macros
   * Performs update with empty code to remove the local macros
   */
  async delete(config: Partial<ILocalMacrosConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    return await this.update({
      ...config,
      macrosCode: ''
    });
  }

  /**
   * Activate parent class (local macros are activated with parent class)
   */
  async activate(config: Partial<ILocalMacrosConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await super.activate({ className: config.className });
  }

  /**
   * Check local macros code
   */
  async check(
    config: Partial<ILocalMacrosConfig>,
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required');
    }

    const checkResponse = await checkClassMacros(
      this.connection,
      config.className,
      config.macrosCode,
      version
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }
}
