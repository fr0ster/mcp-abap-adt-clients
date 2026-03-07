/**
 * AdtInterfaceLegacy - Interface handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtInterface } from './AdtInterface';
import { lockInterface } from './lock';
import type { IInterfaceConfig, IInterfaceState } from './types';
import { unlockInterface } from './unlock';

export class AdtInterfaceLegacy extends AdtInterface {
  override async delete(
    config: Partial<IInterfaceConfig>,
  ): Promise<IInterfaceState> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    const state: IInterfaceState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking interface for deletion');
      this.connection.setSessionType('stateful');
      const lockResult = await lockInterface(
        this.connection,
        config.interfaceName,
      );
      lockHandle = lockResult.lockHandle;

      this.logger?.info?.('Deleting interface (direct DELETE)');
      const objectUrl = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(config.interfaceName).toLowerCase()}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle as string,
        config.transportRequest,
      );
      this.logger?.info?.('Interface deleted');

      return state;
    } catch (error: unknown) {
      this.logger?.error?.('Delete failed:', error);
      if (lockHandle) {
        try {
          await unlockInterface(
            this.connection,
            config.interfaceName,
            lockHandle,
          );
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
