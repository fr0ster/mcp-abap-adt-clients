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

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

/**
 * What the create answers: the enhancement's metadata document.
 */
export type EnhancementCreated = string;

/**
 * The enhancement's source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type EnhancementSource = string;

/**
 * The enhancement's metadata document.
 */
export type EnhancementMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type EnhancementCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type EnhancementActivationResult = string;

/**
 * What name validation answers.
 */
export type EnhancementValidationResult = string;

/**
 * What the deletion answers.
 */
export type EnhancementDeletionResult = string;

/**
 * What the source write answers.
 */
export type EnhancementUpdated = string;

/**
 * The transport document for the enhancement.
 */
export type EnhancementTransport = string;

/** One strategy per member of a enhancement implementation. See `IClassResults`. */
export interface IEnhancementResults<
  TCreated = EnhancementCreated,
  TSource = EnhancementSource,
  TMetadata = EnhancementMetadata,
  TCheck = EnhancementCheckResult,
  TActivation = EnhancementActivationResult,
  TValidation = EnhancementValidationResult,
  TDeletion = EnhancementDeletionResult,
  TUpdated = EnhancementUpdated,
  TTransport = EnhancementTransport,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
  readonly activation: IResultStrategy<TActivation>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
  readonly transport: IResultStrategy<TTransport>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const enhancementDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IEnhancementResults;
