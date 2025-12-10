/**
 * Behavior Definition operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IBehaviorDefinitionConfig, IBehaviorDefinitionState } from './types';

export * from './types';
export { BehaviorDefinitionBuilder } from './BehaviorDefinitionBuilder';
export { AdtBehaviorDefinition } from './AdtBehaviorDefinition';

// Type alias for AdtBehaviorDefinition
export type AdtBehaviorDefinitionType = IAdtObject<IBehaviorDefinitionConfig, IBehaviorDefinitionState>;
