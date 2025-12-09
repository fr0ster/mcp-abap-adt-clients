/**
 * AdtLocalTypes - High-level CRUD operations for Local Types (implementations include)
 * 
 * Local types are defined in the implementations include of an ABAP class.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { checkClassLocalTypes } from './check';
import { updateClassLocalTypes } from './includes';
import { AdtClass } from './AdtClass';

export interface LocalTypesConfig {
  className: string;
  localTypesCode?: string;
  transportRequest?: string;
}

export class AdtLocalTypes implements IAdtObject<LocalTypesConfig, LocalTypesConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  private readonly adtClass: AdtClass;
  public readonly objectType: string = 'LocalTypes';

  constructor(connection: IAbapConnection, adtClass?: AdtClass, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = adtClass || new AdtClass(connection, logger);
  }

  /**
   * Validate local types code
   */
  async validate(config: Partial<LocalTypesConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required for validation');
    }

    return await checkClassLocalTypes(
      this.connection,
      config.className,
      config.localTypesCode,
      'inactive'
    );
  }

  /**
   * Create local types with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<LocalTypesConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalTypesConfig> {
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
      lockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local types code
      const codeToCheck = options?.sourceCode || config.localTypesCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local types code');
        await checkClassLocalTypes(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Local types check passed');
      }

      // 3. Update local types
      this.logger?.info?.('Step 3: Creating local types');
      await updateClassLocalTypes(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Local types created');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.adtClass.unlock({ className: config.className }, lockHandle);
      lockHandle = undefined;

      return {
        className: config.className,
        localTypesCode: config.localTypesCode,
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

      logErrorSafely(this.logger, 'Create LocalTypes', error);
      throw error;
    }
  }

  /**
   * Read local types code
   */
  async read(
    config: Partial<LocalTypesConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<LocalTypesConfig | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Reading local types requires reading the parent class and extracting implementations include
    // This is a simplified implementation - in practice, you'd need to parse the class source
    // For now, return basic config
    return {
      className: config.className,
      localTypesCode: config.localTypesCode
    };
  }

  /**
   * Update local types with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<LocalTypesConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalTypesConfig> {
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
      lockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local types code
      const codeToCheck = options?.sourceCode || config.localTypesCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local types code');
        await checkClassLocalTypes(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Local types check passed');
      }

      // 3. Update local types
      this.logger?.info?.('Step 3: Updating local types');
      await updateClassLocalTypes(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Local types updated');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.adtClass.unlock({ className: config.className }, lockHandle);
      lockHandle = undefined;

      return {
        className: config.className,
        localTypesCode: config.localTypesCode,
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

      logErrorSafely(this.logger, 'Update LocalTypes', error);
      throw error;
    }
  }

  /**
   * Delete local types
   * Performs update with empty code to remove the local types
   */
  async delete(config: Partial<LocalTypesConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    await this.update({
      ...config,
      localTypesCode: ''
    });
    
    // Return empty response (update already completed)
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config: {} } as AxiosResponse;
  }

  /**
   * Activate parent class (local types are activated with parent class)
   */
  async activate(config: Partial<LocalTypesConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.activate({ className: config.className });
  }

  /**
   * Check local types code
   */
  async check(
    config: Partial<LocalTypesConfig>,
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required');
    }

    return await checkClassLocalTypes(
      this.connection,
      config.className,
      config.localTypesCode,
      version
    );
  }

  /**
   * Lock parent class (required for local types operations)
   */
  async lock(config: Partial<LocalTypesConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.lock({ className: config.className });
  }

  /**
   * Unlock parent class
   */
  async unlock(config: Partial<LocalTypesConfig>, lockHandle: string): Promise<void> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!lockHandle) {
      throw new Error('Lock handle is required');
    }

    await this.adtClass.unlock({ className: config.className }, lockHandle);
  }
}
