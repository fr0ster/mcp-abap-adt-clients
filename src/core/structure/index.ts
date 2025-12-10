/**
 * Structure operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IStructureConfig, IStructureState } from './types';

export * from './types';
export { StructureBuilder } from './StructureBuilder';
export { AdtStructure } from './AdtStructure';

// Type alias for AdtStructure
export type AdtStructureType = IAdtObject<IStructureConfig, IStructureState>;
