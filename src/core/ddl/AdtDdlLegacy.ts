/**
 * AdtDdlLegacy - View handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import {
  encodeSapObjectName,
  safeErrorMessage,
} from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtDdl } from './AdtDdl';
import { lockDDLS } from './lock';
import type { IDdlConfig, IDdlState } from './types';
import { unlockDDLS } from './unlock';

export class AdtDdlLegacy extends AdtDdl {
  override async delete(config: Partial<IDdlConfig>): Promise<IDdlState> {
    if (!config.ddlName) {
      throw new Error('View name is required');
    }

    const state: IDdlState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking view for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDDLS(this.connection, config.ddlName);

      this.logger?.info?.('Deleting view (direct DELETE)');
      const objectUrl = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(config.ddlName).toLowerCase()}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('View deleted');

      return state;
    } catch (error: unknown) {
      this.logger?.error?.('Delete failed:', safeErrorMessage(error));
      if (lockHandle) {
        try {
          await unlockDDLS(this.connection, config.ddlName, lockHandle);
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
