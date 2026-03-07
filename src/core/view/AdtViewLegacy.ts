/**
 * AdtViewLegacy - View handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtView } from './AdtView';
import { lockDDLS } from './lock';
import type { IViewConfig, IViewState } from './types';
import { unlockDDLS } from './unlock';

export class AdtViewLegacy extends AdtView {
  override async delete(config: Partial<IViewConfig>): Promise<IViewState> {
    if (!config.viewName) {
      throw new Error('View name is required');
    }

    const state: IViewState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking view for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockDDLS(this.connection, config.viewName);

      this.logger?.info?.('Deleting view (direct DELETE)');
      const objectUrl = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(config.viewName).toLowerCase()}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('View deleted');

      return state;
    } catch (error: unknown) {
      this.logger?.error?.('Delete failed:', error);
      if (lockHandle) {
        try {
          await unlockDDLS(this.connection, config.viewName, lockHandle);
        } catch (unlockError: unknown) {
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
