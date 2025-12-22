/**
 * Behavior Implementation operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type {
  IBehaviorImplementationConfig,
  IBehaviorImplementationState,
} from './types';

export { AdtBehaviorImplementation } from './AdtBehaviorImplementation';
export { BehaviorImplementationBuilder } from './BehaviorImplementationBuilder';
export * from './types';

// Type alias for AdtBehaviorImplementation
export type AdtBehaviorImplementationType = IAdtObject<
  IBehaviorImplementationConfig,
  IBehaviorImplementationState
>;
