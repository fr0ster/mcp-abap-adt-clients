/**
 * ServiceDefinition operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type {
  IServiceDefinitionConfig,
  IServiceDefinitionState,
} from './types';

export { AdtServiceDefinition } from './AdtServiceDefinition';
export * from './types';

// Type alias for AdtServiceDefinition
export type AdtServiceDefinitionType = IAdtSourceObject<
  IServiceDefinitionConfig,
  IServiceDefinitionState
>;
