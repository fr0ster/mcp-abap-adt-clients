/**
 * AdtLocalDefinitions - High-level CRUD operations for Local Definitions (definitions include)
 * 
 * Local definitions are type declarations needed for components in the private section.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { checkClassDefinitions } from './check';
import { updateClassDefinitions } from './includes';
import { AdtClass } from './AdtClass';
import { IClassState } from './types';

export interface ILocalDefinitionsConfig {
  className: string;
  definitionsCode?: string;
  transportRequest?: string;
}

export class AdtLocalDefinitions extends AdtClass {
  public readonly objectType: string = 'LocalDefinitions';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    super(connection, logger);
  }

  /**
   * Validate local definitions code
   */
  async validate(config: Partial<ILocalDefinitionsConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required for validation');
    }

    const checkResponse = await checkClassDefinitions(
      this.connection,
      config.className,
      config.definitionsCode,
      'inactive'
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }

  /**
   * Create local definitions with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<ILocalDefinitionsConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required');
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

      // 2. Check local definitions code
      const codeToCheck = options?.sourceCode || config.definitionsCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local definitions code');
        const checkResponse = await checkClassDefinitions(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Local definitions check passed');
      }

      // 3. Update local definitions
      this.logger?.info?.('Step 3: Creating local definitions');
      const updateResponse = await updateClassDefinitions(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Local definitions created');

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

      this.logger?.error('Create LocalDefinitions failed:', error);
      throw error;
    }
  }

  /**
   * Read local definitions code
   */
  async read(
    config: Partial<ILocalDefinitionsConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IClassState | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    try {
      const { getClassDefinitionsInclude } = await import('./read');
      const response = await getClassDefinitionsInclude(this.connection, config.className, version);
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      this.logger?.error('Read LocalDefinitions failed:', error);
      throw error;
    }
  }

  /**
   * Update local definitions with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<ILocalDefinitionsConfig>,
    options?: IAdtOperationOptions
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required');
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

      // 2. Check local definitions code
      const codeToCheck = options?.sourceCode || config.definitionsCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local definitions code');
        const checkResponse = await checkClassDefinitions(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        state.checkResult = checkResponse;
        this.logger?.info?.('Local definitions check passed');
      }

      // 3. Update local definitions
      this.logger?.info?.('Step 3: Updating local definitions');
      const updateResponse = await updateClassDefinitions(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      state.updateResult = updateResponse;
      this.logger?.info?.('Local definitions updated');

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

      this.logger?.error('Update LocalDefinitions failed:', error);
      throw error;
    }
  }

  /**
   * Delete local definitions
   * Performs update with empty code to remove the local definitions
   */
  async delete(config: Partial<ILocalDefinitionsConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    return await this.update({
      ...config,
      definitionsCode: ''
    });
  }

  /**
   * Activate parent class (local definitions are activated with parent class)
   */
  async activate(config: Partial<ILocalDefinitionsConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await super.activate({ className: config.className });
  }

  /**
   * Check local definitions code
   */
  async check(
    config: Partial<ILocalDefinitionsConfig>,
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required');
    }

    const checkResponse = await checkClassDefinitions(
      this.connection,
      config.className,
      config.definitionsCode,
      version
    );

    return {
      checkResult: checkResponse,
      errors: []
    };
  }
}
