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
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { IProgramConfig, IProgramState } from './types';
import { validateProgramName } from './validation';
import { create as createProgram } from './create';
import { checkProgram } from './check';
import { lockProgram } from './lock';
import { uploadProgramSource } from './update';
import { unlockProgram } from './unlock';
import { activateProgram } from './activation';
import { checkDeletion, deleteProgram } from './delete';
import { getProgramSource, getProgramTransport, getProgramMetadata } from './read';

export class AdtProgram implements IAdtObject<IProgramConfig, IProgramState> {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  public readonly objectType: string = 'Program';

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Validate program configuration before creation
   */
  async validate(config: Partial<IProgramConfig>): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required for validation');
    }

    try {
      const validationResponse = await validateProgramName(
        this.connection,
        config.programName,
        config.description
      );

      return {
        validationResponse: validationResponse,
        errors: []
      };
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data 
        ? (typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 500)
            : JSON.stringify(error.response.data).substring(0, 500))
        : error.message || 'Unknown error';

      this.logger?.error?.(
        `Validation failed: HTTP ${status} ${statusText} - ${errorMessage}`
      );

      if (status === 400 || (status >= 400 && status < 500)) {
        throw new Error(`Validation failed: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Create program with full operation chain
   */
  async create(
    config: IProgramConfig,
    options?: IAdtOperationOptions
  ): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    let objectCreated = false;
    let lockHandle: string | undefined;
    const sessionId = this.connection.getSessionId?.() || '';
    const state: IProgramState = {
      errors: []
    };

    try {
      // 1. Validate (no stateful needed)
      this.logger?.info?.('Step 1: Validating program configuration');
      const validationResponse = await validateProgramName(
        this.connection,
        config.programName,
        config.description
      );
      state.validationResponse = validationResponse;
      this.logger?.info?.('Validation passed');

      // 2. Create (requires stateful)
      this.logger?.info?.('Step 2: Creating program');
      const createResponse = await createProgram(this.connection, {
        programName: config.programName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description,
        programType: config.programType,
        application: config.application,
        sourceCode: options?.sourceCode || config.sourceCode
      });
      state.createResult = createResponse;
      objectCreated = true;
      this.logger?.info?.('Program created');

      // 3. Check after create (stateful still set from create)
      this.logger?.info?.('Step 3: Checking created program');
      const checkResponse1 = await checkProgram(this.connection, config.programName, 'inactive');
      state.checkResult = checkResponse1;
      this.logger?.info?.('Check after create passed');

      // 4. Lock (stateful already set, keep it)
      this.logger?.info?.('Step 4: Locking program');
      this.connection.setSessionType('stateful');
      lockHandle = await lockProgram(this.connection, config.programName);
      state.lockHandle = lockHandle;
      this.logger?.info?.('Program locked, handle:', lockHandle);

      // 5. Check inactive with code for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 5: Checking inactive version with update content');
        const checkResponse2 = await checkProgram(this.connection, config.programName, 'inactive', codeToCheck);
        state.checkResult = checkResponse2;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 6. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 6: Updating program with source code');
        const updateResponse = await uploadProgramSource(
          this.connection,
          config.programName,
          codeToCheck,
          lockHandle,
          sessionId,
          config.transportRequest
        );
        state.updateResult = updateResponse;
        this.logger?.info?.('Program updated');
      }

      // 7. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 7: Unlocking program');
        const unlockResponse = await unlockProgram(this.connection, config.programName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Program unlocked');
      }

      // 8. Final check (no stateful needed)
      this.logger?.info?.('Step 8: Final check');
      const checkResponse3 = await checkProgram(this.connection, config.programName, 'inactive');
      state.checkResult = checkResponse3;
      this.logger?.info?.('Final check passed');

      // 9. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 9: Activating program');
        const activateResponse = await activateProgram(this.connection, config.programName);
        state.activateResult = activateResponse;
        this.logger?.info?.('Program activated, status:', activateResponse.status);
      }

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking program during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockProgram(this.connection, config.programName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if no lock was acquired
        this.connection.setSessionType('stateless');
      }

      if (objectCreated && options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting program after failure');
          this.connection.setSessionType('stateful');
          await deleteProgram(this.connection, {
            programName: config.programName,
            transportRequest: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete program after failure:', deleteError);
        }
      }

      this.logger?.error('Create failed:', error);
      throw error;
    }
  }

  /**
   * Read program
   */
  async read(
    config: Partial<IProgramConfig>,
    version: 'active' | 'inactive' = 'active'
  ): Promise<IProgramState | undefined> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    try {
      const response = await getProgramSource(this.connection, config.programName);
      return {
        readResult: response,
        errors: []
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read program metadata (object characteristics: package, responsible, description, etc.)
   */
  async readMetadata(config: Partial<IProgramConfig>): Promise<IProgramState> {
    const state: IProgramState = { errors: [] };
    if (!config.programName) {
      const error = new Error('Program name is required');
      state.errors.push({ method: 'readMetadata', error, timestamp: new Date() });
      throw error;
    }
    try {
      const response = await getProgramMetadata(this.connection, config.programName);
      state.metadataResult = response;
      this.logger?.info?.('Program metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({ method: 'readMetadata', error: err, timestamp: new Date() });
      this.logger?.error('readMetadata', err);
      throw err;
    }
  }

  /**
   * Update program with full operation chain
   * Always starts with lock
   */
  async update(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions
  ): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    let lockHandle: string | undefined;
    const sessionId = this.connection.getSessionId?.() || '';
    const state: IProgramState = {
      errors: []
    };

    try {
      // 1. Lock (update always starts with lock, stateful only for lock)
      this.logger?.info?.('Step 1: Locking program');
      this.connection.setSessionType('stateful');
      lockHandle = await lockProgram(this.connection, config.programName);
      state.lockHandle = lockHandle;
      this.logger?.info?.('Program locked, handle:', lockHandle);

      // 2. Check inactive with code for update (from options or config)
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.('Step 2: Checking inactive version with update content');
        const checkResponse = await checkProgram(this.connection, config.programName, 'inactive', codeToCheck);
        state.checkResult = checkResponse;
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating program');
        const updateResponse = await uploadProgramSource(
          this.connection,
          config.programName,
          codeToCheck,
          lockHandle,
          sessionId,
          config.transportRequest
        );
        state.updateResult = updateResponse;
        this.logger?.info?.('Program updated');
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking program');
        const unlockResponse = await unlockProgram(this.connection, config.programName, lockHandle);
        state.unlockResult = unlockResponse;
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Program unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      const checkResponse2 = await checkProgram(this.connection, config.programName, 'inactive');
      state.checkResult = checkResponse2;
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested, no stateful needed - uses same session/cookies)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating program');
        const activateResponse = await activateProgram(this.connection, config.programName);
        state.activateResult = activateResponse;
        this.logger?.info?.('Program activated, status:', activateResponse.status);
      }

      return state;
    } catch (error: any) {
      // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking program during error cleanup');
          // We're already in stateful after lock, just unlock and set stateless
          await unlockProgram(this.connection, config.programName, lockHandle);
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.('Failed to unlock during cleanup:', unlockError);
        }
      } else {
        // Ensure stateless if lock failed
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting program after failure');
          this.connection.setSessionType('stateful');
          await deleteProgram(this.connection, {
            programName: config.programName,
            transportRequest: config.transportRequest
          });
          this.connection.setSessionType('stateless');
        } catch (deleteError) {
          this.logger?.warn?.('Failed to delete program after failure:', deleteError);
        }
      }

      this.logger?.error('Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete program
   */
  async delete(config: Partial<IProgramConfig>): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    const state: IProgramState = {
      errors: []
    };

    try {
      // Check for deletion (no stateful needed)
      this.logger?.info?.('Checking program for deletion');
      const checkResponse = await checkDeletion(this.connection, {
        programName: config.programName,
        transportRequest: config.transportRequest
      });
      state.checkResult = checkResponse;
      this.logger?.info?.('Deletion check passed');

      // Delete (requires stateful, but no lock)
      this.logger?.info?.('Deleting program');
      this.connection.setSessionType('stateful');
      const deleteResponse = await deleteProgram(this.connection, {
        programName: config.programName,
        transportRequest: config.transportRequest
      });
      state.deleteResult = deleteResponse;
      this.logger?.info?.('Program deleted');

      return state;
    } catch (error: any) {
      this.logger?.error('Delete failed:', error);
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }

  /**
   * Activate program
   * No stateful needed - uses same session/cookies
   */
  async activate(config: Partial<IProgramConfig>): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    const state: IProgramState = {
      errors: []
    };

    try {
      const activateResponse = await activateProgram(this.connection, config.programName);
      state.activateResult = activateResponse;
      return state;
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = error.response?.data 
        ? (typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 500)
            : JSON.stringify(error.response.data).substring(0, 500))
        : error.message || 'Unknown error';

      this.logger?.error?.(
        `Activate failed: HTTP ${status} ${statusText} - ${errorMessage}`
      );

      this.logger?.error('Activate failed:', error);
      throw error;
    }
  }

  /**
   * Check program
   */
  async check(
    config: Partial<IProgramConfig>,
    status?: string
  ): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    const state: IProgramState = {
      errors: []
    };

    try {
      // Map status to version
      const version: 'active' | 'inactive' = status === 'active' ? 'active' : 'inactive';
      const checkResponse = await checkProgram(this.connection, config.programName, version, config.sourceCode);
      state.checkResult = checkResponse;
      return state;
    } catch (error: any) {
      this.logger?.error('Check failed:', error);
      throw error;
    }
  }

  /**
   * Read transport request information for the program
   */
  async readTransport(config: Partial<IProgramConfig>): Promise<IProgramState> {
    const state: IProgramState = {
      errors: []
    };

    if (!config.programName) {
      const error = new Error('Program name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date()
      });
      throw error;
    }

    try {
      const response = await getProgramTransport(this.connection, config.programName);
      state.transportResult = response;
      this.logger?.info?.('Transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date()
      });
      this.logger?.error('readTransport', err);
      throw err;
    }
  }
}
