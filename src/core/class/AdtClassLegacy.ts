/**
 * AdtClassLegacy - Class handler for legacy SAP systems (BASIS < 7.50)
 *
 * On legacy systems, the x-sap-adt-sessiontype: stateful header causes locks
 * to be stored in ABAP session memory instead of the global enqueue server.
 * This means lock + update + unlock MUST happen within the same stateful
 * HTTP session — switching to stateless between lock and update invalidates
 * the lock handle (GitHub #11).
 *
 * Overrides:
 * - update() — keeps lock→check→update→unlock in one stateful session
 * - delete() — uses direct DELETE instead of /sap/bc/adt/deletion/ API
 */

import type {
  HttpError,
  IAdtOperationOptions,
} from '@mcp-abap-adt/interfaces';
import {
  encodeSapObjectName,
  safeErrorMessage,
} from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtClass } from './AdtClass';
import { activateClass } from './activation';
import { checkClass } from './check';
import { lockClass } from './lock';
import type { IClassConfig, IClassState } from './types';
import { unlockClass } from './unlock';
import { updateClass } from './update';

export class AdtClassLegacy extends AdtClass {
  /**
   * Update class — legacy override.
   *
   * Keeps lock→check→update→unlock in a single stateful session so the
   * lock handle remains valid (legacy stores locks in ABAP session memory).
   */
  override async update(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Low-level mode: caller owns the session
    if (options?.lockHandle) {
      return super.update(config, options);
    }

    let lockHandle: string | undefined;
    const state: IClassState = { errors: [] };

    try {
      // Enter stateful session for the entire lock→update→unlock chain
      this.connection.setSessionType('stateful');

      // 1. Lock
      this.logger?.info?.('Legacy update step 1: Locking class');
      lockHandle = await lockClass(this.connection, config.className);
      state.lockHandle = lockHandle;
      this.logger?.info?.('Class locked, handle:', lockHandle);

      // 2. Check inactive with source code
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (codeToUpdate) {
        this.logger?.info?.(
          'Legacy update step 2: Checking inactive version',
        );
        state.checkResult = await checkClass(
          this.connection,
          config.className,
          'inactive',
          codeToUpdate,
          this.contentTypes?.sourceArtifactContentType(),
        );
        this.logger?.info?.('Check passed');
      }

      // 3. Update
      if (codeToUpdate && lockHandle) {
        this.logger?.info?.('Legacy update step 3: Updating class');
        state.updateResult = await updateClass(
          this.connection,
          config.className,
          codeToUpdate,
          lockHandle,
          config.transportRequest,
          this.contentTypes?.sourceArtifactContentType(),
        );
        this.logger?.info?.('Class updated');
      }

      // 4. Unlock (still within the same stateful session)
      if (lockHandle) {
        this.logger?.info?.('Legacy update step 4: Unlocking class');
        state.unlockResult = await unlockClass(
          this.connection,
          config.className,
          lockHandle,
        );
        lockHandle = undefined;
        this.logger?.info?.('Class unlocked');
      }
    } catch (error: unknown) {
      // Cleanup: try to unlock if still locked (within same session)
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking class during error cleanup');
          await unlockClass(this.connection, config.className, lockHandle);
        } catch (unlockError: unknown) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      }
      throw error;
    } finally {
      // Always return to stateless after the chain
      this.connection.setSessionType('stateless');
    }

    // Post-lock operations (stateless is fine)

    // 5. Final check
    this.logger?.info?.('Legacy update step 5: Final check');
    state.checkResult = await checkClass(
      this.connection,
      config.className,
      'inactive',
    );
    this.logger?.info?.('Final check passed');

    // 6. Activate (if requested)
    if (options?.activateOnUpdate) {
      this.logger?.info?.('Legacy update step 6: Activating class');
      const activateResult = await activateClass(
        this.connection,
        config.className,
      );
      state.activateResult = activateResult;
      this.logger?.info?.('Class activated, status:', activateResult.status);

      // Read with long polling to ensure object is ready after activation
      this.logger?.info?.('Read (wait for object ready after activation)');
      try {
        const readState = await this.read(
          { className: config.className },
          'active',
          { withLongPolling: true },
        );
        if (readState) {
          state.readResult = readState.readResult;
        }
        this.logger?.info?.('Object is ready after activation');
      } catch (readError) {
        this.logger?.warn?.(
          'Read with long polling failed after activation:',
          safeErrorMessage(readError),
        );
      }
    }

    return state;
  }

  override async delete(config: Partial<IClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const state: IClassState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking class for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockClass(this.connection, config.className);
      this.logger?.info?.(`Lock obtained: ${lockHandle}`);

      this.logger?.info?.('Deleting class (direct DELETE)');
      const objectUrl = `/sap/bc/adt/oo/classes/${encodeSapObjectName(config.className).toLowerCase()}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Class deleted');

      return state;
    } catch (error: unknown) {
      const e = error as HttpError;
      const responseData = e.response?.data;
      const responseStatus = e.response?.status;
      this.logger?.error?.(
        `Delete failed: status=${responseStatus}, body=${typeof responseData === 'string' ? responseData.substring(0, 500) : JSON.stringify(responseData)?.substring(0, 500)}`,
      );
      if (lockHandle) {
        try {
          await unlockClass(this.connection, config.className, lockHandle);
        } catch (unlockError: unknown) {
          this.logger?.error?.(
            'Unlock after delete failure also failed:',
            safeErrorMessage(unlockError),
          );
        }
      }
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}
