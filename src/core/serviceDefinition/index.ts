/**
 * ServiceDefinition operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IServiceDefinitionConfig, IServiceDefinitionState } from './types';

export * from './types';
export { ServiceDefinitionBuilder } from './ServiceDefinitionBuilder';
export { AdtServiceDefinition } from './AdtServiceDefinition';

// Type alias for AdtServiceDefinition
export type AdtServiceDefinitionType = IAdtObject<IServiceDefinitionConfig, IServiceDefinitionState>;

