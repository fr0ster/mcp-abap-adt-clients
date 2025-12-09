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

export interface LocalMacrosConfig {
  className: string;
  macrosCode?: string;
  transportRequest?: string;
}

export class AdtLocalMacros implements IAdtObject<LocalMacrosConfig, LocalMacrosConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  private readonly adtClass: AdtClass;
  public readonly objectType: string = 'LocalMacros';

  constructor(connection: IAbapConnection, adtClass?: AdtClass, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = adtClass || new AdtClass(connection, logger);
  }

  /**
   * Validate local macros code
   */
  async validate(config: Partial<LocalMacrosConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required for validation');
    }

    return await checkClassMacros(
      this.connection,
      config.className,
      config.macrosCode,
      'inactive'
    );
  }

  /**
   * Create local macros with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<LocalMacrosConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalMacrosConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local macros code
      const codeToCheck = options?.sourceCode || config.macrosCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local macros code');
        await checkClassMacros(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Local macros check passed');
      }

      // 3. Update local macros
      this.logger?.info?.('Step 3: Creating local macros');
      await updateClassMacros(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Local macros created');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.adtClass.unlock({ className: config.className }, lockHandle);
      lockHandle = undefined;

      return {
        className: config.className,
        macrosCode: config.macrosCode,
        transportRequest: config.transportRequest
      };
    } catch (error: any) {
      // Cleanup on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await this.adtClass.unlock({ className: config.className }, lockHandle);
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
    config: Partial<LocalMacrosConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<LocalMacrosConfig | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Reading local macros requires reading the parent class and extracting macros include
    // This is a simplified implementation - in practice, you'd need to parse the class source
    // For now, return basic config
    return {
      className: config.className,
      macrosCode: config.macrosCode
    };
  }

  /**
   * Update local macros with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<LocalMacrosConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalMacrosConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local macros code
      const codeToCheck = options?.sourceCode || config.macrosCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local macros code');
        await checkClassMacros(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Local macros check passed');
      }

      // 3. Update local macros
      this.logger?.info?.('Step 3: Updating local macros');
      await updateClassMacros(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Local macros updated');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.adtClass.unlock({ className: config.className }, lockHandle);
      lockHandle = undefined;

      return {
        className: config.className,
        macrosCode: config.macrosCode,
        transportRequest: config.transportRequest
      };
    } catch (error: any) {
      // Cleanup on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class during error cleanup');
          await this.adtClass.unlock({ className: config.className }, lockHandle);
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
  async delete(config: Partial<LocalMacrosConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    await this.update({
      ...config,
      macrosCode: ''
    });
    
    // Return empty response (update already completed)
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config: {} } as AxiosResponse;
  }

  /**
   * Activate parent class (local macros are activated with parent class)
   */
  async activate(config: Partial<LocalMacrosConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.activate({ className: config.className });
  }

  /**
   * Check local macros code
   */
  async check(
    config: Partial<LocalMacrosConfig>,
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.macrosCode) {
      throw new Error('Macros code is required');
    }

    return await checkClassMacros(
      this.connection,
      config.className,
      config.macrosCode,
      version
    );
  }

  /**
   * Lock parent class (required for local macros operations)
   */
  async lock(config: Partial<LocalMacrosConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.lock({ className: config.className });
  }

  /**
   * Unlock parent class
   */
  async unlock(config: Partial<LocalMacrosConfig>, lockHandle: string): Promise<void> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!lockHandle) {
      throw new Error('Lock handle is required');
    }

    await this.adtClass.unlock({ className: config.className }, lockHandle);
  }
}
