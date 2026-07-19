/**
 * TableType module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateTableTypeParams,
  IDeleteTableTypeParams,
  IUpdateTableTypeParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ITableTypeConfig {
  tableTypeName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  // XML-based TableType parameters (TableType is XML-based entity like Domain/DataElement)
  rowTypeName?: string; // Structure name for dictionaryType (required for update)
  rowTypeKind?:
    | 'dictionaryType'
    | 'predefinedAbapType'
    | 'refToPredefinedAbapType'
    | 'refToDictionaryType'
    | 'refToClassOrInterfaceType'
    | 'rangeTypeOnPredefinedType'
    | 'rangeTypeOnDataelement';
  accessType?: 'standard' | 'sorted' | 'hashed' | 'index' | 'notSpecified';
  primaryKeyDefinition?:
    | 'standard'
    | 'rowType'
    | 'keyComponents'
    | 'empty'
    | 'notSpecified';
  primaryKeyKind?: 'unique' | 'nonUnique' | 'notSpecified';
  description?: string; // Required for create/validate operations, optional for others
}

export interface ITableTypeState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // TableType-specific fields can be added here if needed
}
