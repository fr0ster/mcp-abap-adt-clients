/**
 * Enhancement module type definitions
 *
 * Supports multiple enhancement types:
 * - enhoxh: Enhancement Implementation (ENHO)
 * - enhoxhb: BAdI Implementation
 * - enhoxhh: Source Code Plugin (has source code)
 * - enhsxs: Enhancement Spot (ENHS)
 * - enhsxsb: BAdI Enhancement Spot
 */

import type { EnhancementType } from '@mcp-abap-adt/interfaces';

// Types defined in @mcp-abap-adt/interfaces
export type {
  EnhancementType,
  IEnhancementConfig,
  IEnhancementMetadata,
  IEnhancementState,
} from '@mcp-abap-adt/interfaces';

/**
 * Enhancement object type codes for ADT
 */
export const ENHANCEMENT_TYPE_CODES: Record<EnhancementType, string> = {
  enhoxh: 'ENHO/EXH', // Enhancement Implementation
  enhoxhb: 'ENHO/EXHB', // BAdI Implementation
  enhoxhh: 'ENHO/EXHH', // Source Code Plugin
  enhsxs: 'ENHS/EXS', // Enhancement Spot
  enhsxsb: 'ENHS/EXSB', // BAdI Enhancement Spot
};

/**
 * Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
 */
export type {
  ICheckEnhancementParams,
  ICreateEnhancementParams,
  IDeleteEnhancementParams,
  IUpdateEnhancementParams,
  IValidateEnhancementParams,
} from '@mcp-abap-adt/interfaces';

/**
 * Get ADT base URL for enhancement type
 */
export function getEnhancementBaseUrl(type: EnhancementType): string {
  return `/sap/bc/adt/enhancements/${type}`;
}

/**
 * Get ADT object URI for specific enhancement
 */
export function getEnhancementUri(type: EnhancementType, name: string): string {
  return `${getEnhancementBaseUrl(type)}/${encodeURIComponent(name.toLowerCase())}`;
}

/**
 * Check if enhancement type supports source code operations
 */
export function supportsSourceCode(type: EnhancementType): boolean {
  return type === 'enhoxhh';
}

/**
 * Check if enhancement type is an implementation (requires enhancement spot)
 */
export function isImplementationType(type: EnhancementType): boolean {
  return type === 'enhoxh' || type === 'enhoxhb' || type === 'enhoxhh';
}

/**
 * Check if enhancement type is a spot/definition
 */
export function isSpotType(type: EnhancementType): boolean {
  return type === 'enhsxs' || type === 'enhsxsb';
}
