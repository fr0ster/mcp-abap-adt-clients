/**
 * AdtProgramLegacy - Program handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtProgram } from './AdtProgram';
import { lockProgram } from './lock';
import type { IProgramConfig, IProgramState } from './types';
import { unlockProgram } from './unlock';

export class AdtProgramLegacy extends AdtProgram {
  override async delete(
    config: Partial<IProgramConfig>,
  ): Promise<IProgramState> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    const state: IProgramState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking program for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockProgram(this.connection, config.programName);

      this.logger?.info?.('Deleting program (direct DELETE)');
      const objectUrl = `/sap/bc/adt/programs/programs/${encodeSapObjectName(config.programName).toLowerCase()}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Program deleted');

      return state;
    } catch (error: any) {
      this.logger?.error?.('Delete failed:', error);
      if (lockHandle) {
        try {
          await unlockProgram(this.connection, config.programName, lockHandle);
        } catch (unlockError: any) {
          this.logger?.error?.(
            'Unlock after delete failure also failed:',
            unlockError,
          );
        }
      }
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}
