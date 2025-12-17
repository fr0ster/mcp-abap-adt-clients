/**
 * TableType module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters (snake_case)
export interface ICreateTableTypeParams {
  tabletype_name: string;
  package_name: string;
  description?: string;
  transport_request?: string;
}

export interface IUpdateTableTypeParams {
  tabletype_name: string;
  description?: string; // Description is required for XML format update
  // XML-based TableType parameters (TableType is XML-based entity like Domain/DataElement)
  row_type_name: string; // Structure name for dictionaryType (required)
  row_type_kind?: 'dictionaryType' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClassOrInterfaceType' | 'rangeTypeOnPredefinedType' | 'rangeTypeOnDataelement';
  access_type?: 'standard' | 'sorted' | 'hashed' | 'index' | 'notSpecified';
  primary_key_definition?: 'standard' | 'rowType' | 'keyComponents' | 'empty' | 'notSpecified';
  primary_key_kind?: 'unique' | 'nonUnique' | 'notSpecified';
  transport_request?: string;
  activate?: boolean;
}

export interface IDeleteTableTypeParams {
  tabletype_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface ITableTypeConfig {
  tableTypeName: string;
  packageName?: string; // Required for create operations, optional for others
  transportRequest?: string; // Only optional parameter
  // XML-based TableType parameters (TableType is XML-based entity like Domain/DataElement)
  rowTypeName?: string; // Structure name for dictionaryType (required for update)
  rowTypeKind?: 'dictionaryType' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClassOrInterfaceType' | 'rangeTypeOnPredefinedType' | 'rangeTypeOnDataelement';
  accessType?: 'standard' | 'sorted' | 'hashed' | 'index' | 'notSpecified';
  primaryKeyDefinition?: 'standard' | 'rowType' | 'keyComponents' | 'empty' | 'notSpecified';
  primaryKeyKind?: 'unique' | 'nonUnique' | 'notSpecified';
  description?: string; // Required for create/validate operations, optional for others
}

export interface ITableTypeState extends IAdtObjectState {
  // All operation results are in IAdtObjectState:
  // validationResponse, createResult, lockHandle, updateResult, checkResult,
  // unlockResult, activateResult, deleteResult, readResult, transportResult, errors
  // TableType-specific fields can be added here if needed
}
