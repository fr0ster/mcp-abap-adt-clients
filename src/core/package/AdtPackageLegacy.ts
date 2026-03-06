/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtPackage } from './AdtPackage';
import { lockPackage } from './lock';
import type { IPackageConfig, IPackageState } from './types';
import { unlockPackage } from './unlock';

export class AdtPackageLegacy extends AdtPackage {
  override async delete(
    config: Partial<IPackageConfig>,
  ): Promise<IPackageState> {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    const state: IPackageState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking package for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockPackage(this.connection, config.packageName);

      this.logger?.info?.('Deleting package (direct DELETE)');
      const objectUrl = `/sap/bc/adt/packages/${encodeSapObjectName(config.packageName)}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Package deleted');

      return state;
    } catch (error: any) {
      this.logger?.error?.('Delete failed:', error);
      if (lockHandle) {
        try {
          await unlockPackage(this.connection, config.packageName, lockHandle);
        } catch (unlockError: any) {
          this.logger?.error?.('Unlock after delete failure also failed:', unlockError);
        }
      }
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}
