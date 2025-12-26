/**
 * Package operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IPackageConfig, IPackageState } from './types';

export { AdtPackage } from './AdtPackage';
export * from './types';

// Type alias for AdtPackage
export type AdtPackageType = IAdtObject<IPackageConfig, IPackageState>;
