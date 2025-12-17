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

// Types
export type {
  EnhancementType,
  ICreateEnhancementParams,
  IUpdateEnhancementParams,
  IDeleteEnhancementParams,
  ICheckEnhancementParams,
  IValidateEnhancementParams,
  IEnhancementConfig,
  IEnhancementState,
  IEnhancementMetadata
} from './types';

export {
  ENHANCEMENT_TYPE_CODES,
  getEnhancementBaseUrl,
  getEnhancementUri,
  supportsSourceCode,
  isImplementationType,
  isSpotType
} from './types';

// Low-level functions
export { create } from './create';
export { getEnhancementMetadata, getEnhancementSource, getEnhancementTransport } from './read';
export { update, updateEnhancement } from './update';
export { checkDeletion, deleteEnhancement } from './delete';
export { lockEnhancement, lockEnhancementForUpdate } from './lock';
export { unlockEnhancement } from './unlock';
export { activateEnhancement } from './activation';
export { checkEnhancement, check } from './check';
export { validateEnhancementName, validate } from './validation';
