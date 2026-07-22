/**
 * Structure operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IStructureConfig, IStructureState } from './types';

export { AdtStructure } from './AdtStructure';
export * from './types';

// Type alias for AdtStructure
export type AdtStructureType = IAdtSourceObject<
  IStructureConfig,
  IStructureState
>;
