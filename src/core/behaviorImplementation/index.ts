/**
 * Behavior Implementation operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IBehaviorImplementationConfig, IBehaviorImplementationState } from './types';

export * from './types';
export { BehaviorImplementationBuilder } from './BehaviorImplementationBuilder';
export { AdtBehaviorImplementation } from './AdtBehaviorImplementation';

// Type alias for AdtBehaviorImplementation
export type AdtBehaviorImplementationType = IAdtObject<IBehaviorImplementationConfig, IBehaviorImplementationState>;

