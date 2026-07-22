/**
 * Behavior Implementation operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type {
  IBehaviorImplementationConfig,
  IBehaviorImplementationState,
} from './types';

export { AdtBehaviorImplementation } from './AdtBehaviorImplementation';
export * from './types';

// Type alias for AdtBehaviorImplementation
export type AdtBehaviorImplementationType = IAdtSourceObject<
  IBehaviorImplementationConfig,
  IBehaviorImplementationState
>;
