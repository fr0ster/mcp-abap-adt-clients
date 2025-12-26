/**
 * Structure operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IStructureConfig, IStructureState } from './types';

export { AdtStructure } from './AdtStructure';
export * from './types';

// Type alias for AdtStructure
export type AdtStructureType = IAdtObject<IStructureConfig, IStructureState>;
