/**
 * Interface operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IInterfaceConfig, IInterfaceState } from './types';

export { AdtInterface } from './AdtInterface';
export * from './types';

// Type alias for AdtInterface
export type AdtInterfaceType = IAdtSourceObject<
  IInterfaceConfig,
  IInterfaceState
>;
