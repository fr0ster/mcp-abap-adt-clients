/**
 * AdtLocalDefinitions - High-level CRUD operations for Local Definitions (definitions include)
 * 
 * Local definitions are type declarations needed for components in the private section.
 * All operations require the parent class to be locked.
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { checkClassDefinitions } from './check';
import { updateClassDefinitions } from './includes';
import { AdtClass } from './AdtClass';

export interface LocalDefinitionsConfig {
  className: string;
  definitionsCode?: string;
  transportRequest?: string;
}

export class AdtLocalDefinitions implements IAdtObject<LocalDefinitionsConfig, LocalDefinitionsConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger?: IAdtLogger;
  private readonly adtClass: AdtClass;
  public readonly objectType: string = 'LocalDefinitions';

  constructor(connection: IAbapConnection, adtClass?: AdtClass, logger?: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = adtClass || new AdtClass(connection, logger);
  }

  /**
   * Validate local definitions code
   */
  async validate(config: Partial<LocalDefinitionsConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required for validation');
    }

    return await checkClassDefinitions(
      this.connection,
      config.className,
      config.definitionsCode,
      'inactive'
    );
  }

  /**
   * Create local definitions with full operation chain
   * Requires parent class to be locked
   */
  async create(
    config: Partial<LocalDefinitionsConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalDefinitionsConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local definitions code
      const codeToCheck = options?.sourceCode || config.definitionsCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local definitions code');
        await checkClassDefinitions(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Local definitions check passed');
      }

      // 3. Update local definitions
      this.logger?.info?.('Step 3: Creating local definitions');
      await updateClassDefinitions(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Local definitions created');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.adtClass.unlock({ className: config.className }, lockHandle);
      lockHandle = undefined;

      return {
        className: config.className,
        definitionsCode: config.definitionsCode,
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

      logErrorSafely(this.logger, 'Create LocalDefinitions', error);
      throw error;
    }
  }

  /**
   * Read local definitions code
   */
  async read(
    config: Partial<LocalDefinitionsConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<LocalDefinitionsConfig | undefined> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Reading local definitions requires reading the parent class and extracting definitions include
    // This is a simplified implementation - in practice, you'd need to parse the class source
    // For now, return basic config
    return {
      className: config.className,
      definitionsCode: config.definitionsCode
    };
  }

  /**
   * Update local definitions with full operation chain
   * Requires parent class to be locked
   */
  async update(
    config: Partial<LocalDefinitionsConfig>,
    options?: IAdtOperationOptions
  ): Promise<LocalDefinitionsConfig> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required');
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock parent class (stateful only for lock)
      this.logger?.info?.('Step 1: Locking parent class');
      lockHandle = await this.adtClass.lock({ className: config.className });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Check local definitions code
      const codeToCheck = options?.sourceCode || config.definitionsCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking local definitions code');
        await checkClassDefinitions(
          this.connection,
          config.className,
          codeToCheck,
          'inactive'
        );
        this.logger?.info?.('Local definitions check passed');
      }

      // 3. Update local definitions
      this.logger?.info?.('Step 3: Updating local definitions');
      await updateClassDefinitions(
        this.connection,
        config.className,
        codeToCheck!,
        lockHandle,
        config.transportRequest
      );
      this.logger?.info?.('Local definitions updated');

      // 4. Unlock parent class (obligatory stateless after unlock)
      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.adtClass.unlock({ className: config.className }, lockHandle);
      lockHandle = undefined;

      return {
        className: config.className,
        definitionsCode: config.definitionsCode,
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

      logErrorSafely(this.logger, 'Update LocalDefinitions', error);
      throw error;
    }
  }

  /**
   * Delete local definitions
   * Performs update with empty code to remove the local definitions
   */
  async delete(config: Partial<LocalDefinitionsConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Delete by updating with empty code
    await this.update({
      ...config,
      definitionsCode: ''
    });
    
    // Return empty response (update already completed)
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config: {} } as AxiosResponse;
  }

  /**
   * Activate parent class (local definitions are activated with parent class)
   */
  async activate(config: Partial<LocalDefinitionsConfig>): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.activate({ className: config.className });
  }

  /**
   * Check local definitions code
   */
  async check(
    config: Partial<LocalDefinitionsConfig>,
    version: 'active' | 'inactive' = 'inactive'
  ): Promise<AxiosResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.definitionsCode) {
      throw new Error('Definitions code is required');
    }

    return await checkClassDefinitions(
      this.connection,
      config.className,
      config.definitionsCode,
      version
    );
  }

  /**
   * Lock parent class (required for local definitions operations)
   */
  async lock(config: Partial<LocalDefinitionsConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.adtClass.lock({ className: config.className });
  }

  /**
   * Unlock parent class
   */
  async unlock(config: Partial<LocalDefinitionsConfig>, lockHandle: string): Promise<void> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!lockHandle) {
      throw new Error('Lock handle is required');
    }

    await this.adtClass.unlock({ className: config.className }, lockHandle);
  }
}
