/**
 * AdtLocalTypes - High-level CRUD operations for Local Types (implementations include)
 * 
 * Local types are defined in the implementations include of an ABAP class.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { checkClassLocalTypes } from './check';
import { updateClassLocalTypes } from './includes';
import { AdtClass } from './AdtClass';
import { IClassState } from './types';

export interface ILocalTypesConfig {
  className: string;
  localTypesCode?: string;
  transportRequest?: string;
}

export class AdtLocalTypes extends AdtClass {
  public readonly objectType: string = 'LocalTypes';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    super(connection, logger);
  }

  /**
   * Validate local types code
   */
  async validate(config: Partial<ILocalTypesConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required for validation');
    }

    const checkResponse = await checkClassLocalTypes(
      this.connection,
      config.className,
      config.localTypesCode,
      'inactive'
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }

  /**
   * Create local types with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await super.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local types code
      const codeToCheck = options?.sourceCode || config.localTypesCode;
      const state: IClassState = {
        errors: []
      };
      
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local types code');
        const checkResponse = await checkClassLocalTypes(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Local types check passed');
      }

      // 3. Update local types
      this.logger?.info?.('Step 3: Creating local types');
      const updateResponse = await updateClassLocalTypes(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Local types created');

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

      this.logger?.error('Create LocalTypes failed:', error);
      throw error;
    }
  }

  /**
   * Read local types code
   */
  async read(
    config: Partial<ILocalTypesConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IClassState | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const { getClassImplementationsInclude } = await import('./read');
      const response = await getClassImplementationsInclude(this.connection, config.className, version);
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      this.logger?.error('Read LocalTypes failed:', error);
      throw error;
    }
  }

  /**
   * Update local types with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await super.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local types code
      const codeToCheck = options?.sourceCode || config.localTypesCode;
      const state: IClassState = {
        errors: []
      };
      
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local types code');
        const checkResponse = await checkClassLocalTypes(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Local types check passed');
      }

      // 3. Update local types
      this.logger?.info?.('Step 3: Updating local types');
      const updateResponse = await updateClassLocalTypes(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Local types updated');

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

      this.logger?.error('Update LocalTypes failed:', error);
      throw error;
    }
  }

  /**
   * Delete local types
   * Performs update with empty code to remove the local types
   */
  async delete(config: Partial<ILocalTypesConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    return await this.update({
      ...config,
      localTypesCode: ''
    });
  }

  /**
   * Activate parent class (local types are activated with parent class)
   */
  async activate(config: Partial<ILocalTypesConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await super.activate({ className: config.className });
  }

  /**
   * Check local types code
   */
  async check(
    config: Partial<ILocalTypesConfig>,
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required');
    }

    const checkResponse = await checkClassLocalTypes(
      this.connection,
      config.className,
      config.localTypesCode,
      version
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }
}
