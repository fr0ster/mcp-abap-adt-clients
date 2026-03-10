/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (BASIS < 7.50)
 *
 * - create() blocked: on legacy systems packages are created via SAP GUI only (SE80/SE21)
 * - validate() blocked: /sap/bc/adt/packages/validation not in discovery
 * - delete() uses direct DELETE instead of /sap/bc/adt/deletion/ API
 * - read() works via /sap/bc/adt/packages (present in legacy discovery)
 */

import {
  encodeSapObjectName,
  safeErrorMessage,
} from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtPackage } from './AdtPackage';
import { lockPackage } from './lock';
import type { IPackageConfig, IPackageState } from './types';
import { unlockPackage } from './unlock';

export class AdtPackageLegacy extends AdtPackage {
  override async create(): Promise<IPackageState> {
    throw new Error(
      'Package creation is not supported on legacy SAP systems via ADT. ' +
        'Use SAP GUI (SE80 or SE21) to create packages.',
    );
  }

  override async validate(): Promise<IPackageState> {
    throw new Error(
      'Package validation is not supported on legacy SAP systems. ' +
        'The endpoint /sap/bc/adt/packages/validation was not found in the ' +
        "system's ADT discovery catalog.",
    );
  }

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
    } catch (error: unknown) {
      this.logger?.error?.('Delete failed:', safeErrorMessage(error));
      if (lockHandle) {
        try {
          await unlockPackage(this.connection, config.packageName, lockHandle);
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
