/**
 * AdtProgram - High-level CRUD operations for Program objects
 * 
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Uses low-level functions directly (not Builder classes).
 * 
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 * 
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import { IAbapConnection, IAdtObject, IAdtOperationOptions } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { ProgramBuilderConfig } from './types';
import { validateProgramName } from './validation';
import { create as createProgram } from './create';
import { checkProgram } from './check';
import { lockProgram } from './lock';
import { uploadProgramSource } from './update';
import { unlockProgram } from './unlock';
import { activateProgram } from './activation';
import { checkDeletion, deleteProgram } from './delete';
import { getProgramSource } from './read';

export class AdtProgram implements IAdtObject<ProgramBuilderConfig, ProgramBuilderConfig> {
  private readonly connection: IAbapConnection;
  private readonly logger: IAdtLogger;
  public readonly objectType: string = 'Program';

  constructor(connection: IAbapConnection, logger: IAdtLogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate program configuration before creation
   */
  async validate(config: Partial<ProgramBuilderConfig>): Promise<AxiosResponse> {
    if (!config.programName) {
      throw new Error('Program name is required for validation');
    }

    return await validateProgramName(
      this.connection,
      config.programName,
      config.description
    );
  }

  /**
   * Create program with full operation chain
   */
  async create(
    config: ProgramBuilderConfig,
    options?: IAdtOperationOptions
  ): Promise<ProgramBuilderConfig> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const sessionId = this.connection.getSessionId?.() || '';

    try {
      // 1. Validate (no stateful needed)
      this.logger.info?.('Step 1: Validating program configuration');
      await validateProgramName(
        this.connection,
        config.programName,
        config.description
      );
      this.logger.info?.('Validation passed');

      // 2. Create (requires stateful)
      this.logger.info?.('Step 2: Creating program');
      await createProgram(this.connection, {
        programName: config.programName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description,
        programType: config.programType,
        application: config.application,
        sourceCode: options?.sourceCode || config.sourceCode
      });
      objectCreated = true;
      this.logger.info?.('Program created');

      // 3. Check after create (stateful still set from create)
      this.logger.info?.('Step 3: Checking created program');
      await checkProgram(this.connection, config.programName, 'inactive');
      this.logger.info?.('Check after create passed');

      // 4. Lock (stateful already set, keep it)
      this.logger.info?.('Step 4: Locking program');
      this.connection.setSessionType('stateful');
      lockHandle = await lockProgram(this.connection, config.programName);
      this.logger.info?.('Program locked, handle:', lockHandle);

      // 5. Check inactive with code for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 5: Checking inactive version with update content');
        await checkProgram(this.connection, config.programName, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 6: Updating program with source code');
        await uploadProgramSource(
          this.connection,
          config.programName,
          codeToCheck,
          lockHandle,
          sessionId,
          config.transportRequest
        );
        this.logger.info?.('Program updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 7: Unlocking program');
        await unlockProgram(this.connection, config.programName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Program unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger.info?.('Step 8: Final check');
      await checkProgram(this.connection, config.programName, 'inactive');
      this.logger.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger.info?.('Step 9: Activating program');
        const activateResponse = await activateProgram(this.connection, config.programName);
        this.logger.info?.('Program activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info without sourceCode (activation returns 201)
        return {
          programName: config.programName,
          packageName: config.packageName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getProgramSource(this.connection, config.programName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        programName: config.programName,
        packageName: config.packageName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking program during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockProgram(this.connection, config.programName, lockHandle);
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
          this.logger.warn?.('Deleting program after failure');
          this.connection.setSessionType('stateful');
          await deleteProgram(this.connection, {
            programName: config.programName,
            transportRequest: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete program after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Create', error);
      throw error;
    }
  }

  /**
   * Read program
   */
  async read(
    config: Partial<ProgramBuilderConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<ProgramBuilderConfig | undefined> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    try {
      const response = await getProgramSource(this.connection, config.programName);
      const sourceCode = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        programName: config.programName,
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
   * Update program with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<ProgramBuilderConfig>,
    options?: IAdtOperationOptions
  ): Promise<ProgramBuilderConfig> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    let lockHandle: string | undefined;
    const sessionId = this.connection.getSessionId?.() || '';

    try {
      // 1. Lock (update always starts with lock, stateful only for lock)
      this.logger.info?.('Step 1: Locking program');
      this.connection.setSessionType('stateful');
      lockHandle = await lockProgram(this.connection, config.programName);
      this.logger.info?.('Program locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger.info?.('Step 2: Checking inactive version with update content');
        await checkProgram(this.connection, config.programName, 'inactive', codeToCheck);
        this.logger.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger.info?.('Step 3: Updating program');
        await uploadProgramSource(
          this.connection,
          config.programName,
          codeToCheck,
          lockHandle,
          sessionId,
          config.transportRequest
        );
        this.logger.info?.('Program updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger.info?.('Step 4: Unlocking program');
        await unlockProgram(this.connection, config.programName, lockHandle);
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger.info?.('Program unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger.info?.('Step 5: Final check');
      await checkProgram(this.connection, config.programName, 'inactive');
      this.logger.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger.info?.('Step 6: Activating program');
        const activateResponse = await activateProgram(this.connection, config.programName);
        this.logger.info?.('Program activated, status:', activateResponse.status);
        
        // Don't read after activation - object may not be ready yet
        // Return basic info without sourceCode (activation returns 201)
        return {
          programName: config.programName
        };
      }

      // Read and return result (no stateful needed)
      const readResponse = await getProgramSource(this.connection, config.programName);
      const sourceCode = typeof readResponse.data === 'string'
        ? readResponse.data
        : JSON.stringify(readResponse.data);

      return {
        programName: config.programName,
        sourceCode
      };
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger.warn?.('Unlocking program during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockProgram(this.connection, config.programName, lockHandle);
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
          this.logger.warn?.('Deleting program after failure');
          this.connection.setSessionType('stateful');
          await deleteProgram(this.connection, {
            programName: config.programName,
            transportRequest: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger.warn?.('Failed to delete program after failure:', deleteError);
        }
      }

      logErrorSafely(this.logger, 'Update', error);
      throw error;
    }
  }

  /**
   * Delete program
   */
  async delete(config: Partial<ProgramBuilderConfig>): Promise<AxiosResponse> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    try {
      // Check for deletion (no stateful needed)
      this.logger.info?.('Checking program for deletion');
      await checkDeletion(this.connection, {
        programName: config.programName,
        transportRequest: config.transportRequest
      });
      this.logger.info?.('Deletion check passed');

      // Delete (requires stateful, but no lock)
      this.logger.info?.('Deleting program');
      this.connection.setSessionType('stateful');
      const result = await deleteProgram(this.connection, {
        programName: config.programName,
        transportRequest: config.transportRequest
      });
      this.logger.info?.('Program deleted');

      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Delete', error);
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Activate program
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<ProgramBuilderConfig>): Promise<AxiosResponse> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    try {
      const result = await activateProgram(this.connection, config.programName);
      return result;
    } catch (error: any) {
      logErrorSafely(this.logger, 'Activate', error);
      throw error;
    }
  }

  /**
   * Check program
   */
  async check(
    config: Partial<ProgramBuilderConfig>,
    status?: string
  ): Promise<AxiosResponse> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    // Map status to version
    const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
    return await checkProgram(this.connection, config.programName, version, config.sourceCode);
  }
}
