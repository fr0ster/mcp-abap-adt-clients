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

import type { EnhancementType } from '@mcp-abap-adt/interfaces-adt';

// Types defined in @mcp-abap-adt/interfaces
export type {
  EnhancementType,
  IEnhancementConfig,
} from '@mcp-abap-adt/interfaces-adt';

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

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
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
export interface IEnhancementResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
  readonly check: IResultStrategy<unknown>;
  readonly activation: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
  readonly deletion: IResultStrategy<unknown>;
  readonly updated: IResultStrategy<unknown>;
  readonly transport: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
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
  deletionCheck: rawDocument,
} satisfies IEnhancementResults;

/**
 * The shapes below describe the argument of the request builders in this
 * module, and they used to be declared in `@mcp-abap-adt/interfaces`. Nobody
 * outside this package ever accepted them — no parameter, field or return
 * anywhere else was typed by one — and being nobody's contract is how 85 of
 * their fields came to be ignored by the very code that took them, for
 * releases, unnoticed. They live here now, beside the function that reads
 * them, which is the only place that can keep them honest. See decision 30 in
 * the interfaces repository.
 */

export interface ICheckEnhancementParams {
  enhancement_name: string;
  enhancement_type: EnhancementType;
  version?: 'active' | 'inactive';
  source_code?: string;
}

export interface ICreateEnhancementParams {
  enhancement_name: string;
  enhancement_type: EnhancementType;
  description?: string;
  package_name: string;
  transport_request?: string;
  enhancement_spot?: string;
  badi_definition?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IDeleteEnhancementParams {
  enhancement_name: string;
  enhancement_type: EnhancementType;
  transport_request?: string;
}

export interface IUpdateEnhancementParams {
  enhancement_name: string;
  enhancement_type: EnhancementType;
  source_code: string;
  lock_handle: string;
  transport_request?: string;
}

export interface IValidateEnhancementParams {
  enhancement_name: string;
  enhancement_type: EnhancementType;
  package_name?: string;
  description?: string;
}
