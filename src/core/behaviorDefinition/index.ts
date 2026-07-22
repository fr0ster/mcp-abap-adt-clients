/**
 * Behavior Definition operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type {
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionState,
} from './types';

export { AdtBehaviorDefinition } from './AdtBehaviorDefinition';
export * from './types';

// Type alias for AdtBehaviorDefinition
export type AdtBehaviorDefinitionType = IAdtSourceObject<
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionState
>;
