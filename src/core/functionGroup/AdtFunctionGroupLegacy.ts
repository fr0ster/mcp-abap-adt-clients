/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionGroup } from './AdtFunctionGroup';
import { lockFunctionGroup } from './lock';
import type { IFunctionGroupConfig, IFunctionGroupState } from './types';
import { unlockFunctionGroup } from './unlock';

export class AdtFunctionGroupLegacy extends AdtFunctionGroup {
  override async delete(
    config: Partial<IFunctionGroupConfig>,
  ): Promise<IFunctionGroupState> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    const state: IFunctionGroupState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking function group for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionGroup(
        this.connection,
        config.functionGroupName,
      );

      this.logger?.info?.('Deleting function group (direct DELETE)');
      const objectUrl = `/sap/bc/adt/functions/groups/${config.functionGroupName.toLowerCase()}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Function group deleted');

      return state;
    } catch (error: any) {
      this.logger?.error?.('Delete failed:', error);
      if (lockHandle) {
        try {
          await unlockFunctionGroup(
            this.connection,
            config.functionGroupName,
            lockHandle,
          );
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
