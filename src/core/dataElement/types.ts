/**
 * DataElement module type definitions
 */

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

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateDataElementParams,
  IDataElementConfig,
  IDataElementState,
  IDeleteDataElementParams,
  IUpdateDataElementParams,
} from '@mcp-abap-adt/interfaces';
