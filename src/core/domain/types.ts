/**
 * Domain module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface IFixedValue {
  low: string;
  text: string;
}

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateDomainParams,
  IDeleteDomainParams,
  IUpdateDomainParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName is required for create/update operations (validated in builder methods)
// description is required for create/update/validate operations
export interface IDomainConfig {
  domainName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string; // Required for create/update operations, optional for others
  transportRequest?: string; // Only optional parameter
  description?: string; // Required for create/update/validate operations, optional for others
  datatype?: string;
  length?: number;
  decimals?: number;
  conversion_exit?: string;
  lowercase?: boolean;
  sign_exists?: boolean;
  value_table?: string;
  fixed_values?: IFixedValue[];
}

export interface IDomainState extends IAdtObjectState {}
