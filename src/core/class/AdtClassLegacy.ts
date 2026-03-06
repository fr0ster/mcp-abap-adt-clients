/**
 * AdtClassLegacy - Class handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtClass } from './AdtClass';
import { lockClass } from './lock';
import type { IClassConfig, IClassState } from './types';
import { unlockClass } from './unlock';

export class AdtClassLegacy extends AdtClass {
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
    } catch (error: any) {
      const responseData = error.response?.data;
      const responseStatus = error.response?.status;
      this.logger?.error?.(
        `Delete failed: status=${responseStatus}, body=${typeof responseData === 'string' ? responseData.substring(0, 500) : JSON.stringify(responseData)?.substring(0, 500)}`,
      );
      if (lockHandle) {
        try {
          await unlockClass(this.connection, config.className, lockHandle);
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
