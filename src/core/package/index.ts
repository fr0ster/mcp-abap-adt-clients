/**
 * Package operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IPackageConfig, IPackageState } from './types';

export * from './types';
export { PackageBuilder } from './PackageBuilder';
export { AdtPackage } from './AdtPackage';

// Type alias for AdtPackage
export type AdtPackageType = IAdtObject<IPackageConfig, IPackageState>;
