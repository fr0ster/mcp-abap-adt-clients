/**
 * DataElement module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

/**
 * SAP ADT supports the following type kinds for data elements:
 *  - domain
 *  - predefinedAbapType
 *  - refToPredefinedAbapType
 *  - refToDictionaryType
 *  - refToClifType
 *
 * When type_kind is 'domain', data_type must contain the domain name.
 * For the reference/predefined variants, use type_kind + data_type/length/refs accordingly.
 */

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateDataElementParams,
  IDeleteDataElementParams,
  IUpdateDataElementParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface IDataElementConfig {
  dataElementName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/validate operations, optional for others
  dataType?: string;
  length?: number;
  decimals?: number;
  shortLabel?: string;
  mediumLabel?: string;
  longLabel?: string;
  headingLabel?: string;
  typeKind?:
    | 'domain'
    | 'predefinedAbapType'
    | 'refToPredefinedAbapType'
    | 'refToDictionaryType'
    | 'refToClifType';
  typeName?: string;
  searchHelp?: string;
  searchHelpParameter?: string;
  setGetParameter?: string;
}

export interface IDataElementState extends IAdtObjectState {
  // DataElement-specific state can be added here if needed
}
