/**
 * Package operations - exports
 */

import type {
  IAdtCheckable,
  IAdtCrud,
  IAdtLockable,
  IAdtTransportAware,
  IAdtValidatable,
} from '@mcp-abap-adt/interfaces';
import type { IPackageConfig, IPackageState } from './types';

export { AdtPackage } from './AdtPackage';
export * from './types';

// Type alias for AdtPackage
export type AdtPackageType = IAdtCrud<IPackageConfig, IPackageState> &
  IAdtValidatable<IPackageConfig, IPackageState> &
  IAdtCheckable<IPackageConfig, IPackageState> &
  IAdtLockable<IPackageConfig, IPackageState> &
  IAdtTransportAware<IPackageConfig, IPackageState>;
