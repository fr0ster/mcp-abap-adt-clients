/**
 * Behavior Definition operations - exports
 * 
 * All operations are exposed as standalone functions.
 * Use them directly or through CrudClient methods.
 */

export * from './types';
export { validate } from './validation';
export { create } from './create';
export { lock, lockForUpdate } from './lock';
export { unlock } from './unlock';
export { read, readSource } from './read';
export { update } from './update';
export { check, checkImplementation, checkAbap } from './check';
export { activate } from './activation';
export { checkDeletion, deleteBehaviorDefinition } from './delete';
export { BehaviorDefinitionBuilder } from './BehaviorDefinitionBuilder';
