/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (BASIS < 7.50)
 *
 * All package operations are blocked on legacy — the /sap/bc/adt/packages
 * endpoint exists in discovery but does not return usable results via RFC.
 */

import { AdtPackage } from './AdtPackage';
import type { IPackageConfig, IPackageState } from './types';

const UNSUPPORTED_MSG =
  'Package operations are not supported on legacy SAP systems (BASIS < 7.50) via ADT. ' +
  'Use SAP GUI (SE80 or SE21) to manage packages.';

export class AdtPackageLegacy extends AdtPackage {
  override async create(): Promise<IPackageState> {
    throw new Error(UNSUPPORTED_MSG);
  }

  override async read(): Promise<IPackageState | undefined> {
    throw new Error(UNSUPPORTED_MSG);
  }

  override async readMetadata(): Promise<IPackageState> {
    throw new Error(UNSUPPORTED_MSG);
  }

  override async validate(): Promise<IPackageState> {
    throw new Error(UNSUPPORTED_MSG);
  }

  override async update(): Promise<IPackageState> {
    throw new Error(UNSUPPORTED_MSG);
  }

  override async delete(
    _config: Partial<IPackageConfig>,
  ): Promise<IPackageState> {
    throw new Error(UNSUPPORTED_MSG);
  }
}
