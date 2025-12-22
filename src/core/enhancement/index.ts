/**
 * Enhancement module exports
 *
 * Provides CRUD operations for SAP Enhancement objects:
 * - Enhancement Implementation (ENHO)
 * - BAdI Implementation
 * - Source Code Plugin (with source code)
 * - Enhancement Spot (ENHS)
 * - BAdI Enhancement Spot
 */

// High-level AdtObject implementation
export { AdtEnhancement } from './AdtEnhancement';
export { activateEnhancement } from './activation';
export { check, checkEnhancement } from './check';

// Low-level functions
export { create } from './create';
export { checkDeletion, deleteEnhancement } from './delete';
export { lockEnhancement, lockEnhancementForUpdate } from './lock';
export {
  getEnhancementMetadata,
  getEnhancementSource,
  getEnhancementTransport,
} from './read';
// Types
export type {
  EnhancementType,
  ICheckEnhancementParams,
  ICreateEnhancementParams,
  IDeleteEnhancementParams,
  IEnhancementConfig,
  IEnhancementMetadata,
  IEnhancementState,
  IUpdateEnhancementParams,
  IValidateEnhancementParams,
} from './types';
export {
  ENHANCEMENT_TYPE_CODES,
  getEnhancementBaseUrl,
  getEnhancementUri,
  isImplementationType,
  isSpotType,
  supportsSourceCode,
} from './types';
export { unlockEnhancement } from './unlock';
export { update, updateEnhancement } from './update';
export { validate, validateEnhancementName } from './validation';
