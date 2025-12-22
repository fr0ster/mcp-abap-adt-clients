/**
 * ServiceDefinition operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type {
  IServiceDefinitionConfig,
  IServiceDefinitionState,
} from './types';

export { AdtServiceDefinition } from './AdtServiceDefinition';
export { ServiceDefinitionBuilder } from './ServiceDefinitionBuilder';
export * from './types';

// Type alias for AdtServiceDefinition
export type AdtServiceDefinitionType = IAdtObject<
  IServiceDefinitionConfig,
  IServiceDefinitionState
>;
