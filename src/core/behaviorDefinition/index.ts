/**
 * Behavior Definition operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type {
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionState,
} from './types';

export { AdtBehaviorDefinition } from './AdtBehaviorDefinition';
export * from './types';

// Type alias for AdtBehaviorDefinition
export type AdtBehaviorDefinitionType = IAdtObject<
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionState
>;
