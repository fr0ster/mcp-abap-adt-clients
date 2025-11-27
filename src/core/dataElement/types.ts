/**
 * DataElement module type definitions
 */

import { BaseBuilderState } from '../shared/IBuilder';

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

// Low-level function parameters (snake_case)
export interface CreateDataElementParams {
  data_element_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  type_kind?: 'domain' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClifType';
  type_name?: string;
  data_type?: string;
  length?: number;
  decimals?: number;
  short_label?: string;
  medium_label?: string;
  long_label?: string;
  heading_label?: string;
  search_help?: string;
  search_help_parameter?: string;
  set_get_parameter?: string;
  default_component_name?: string;
  deactivate_input_history?: boolean;
  change_document?: boolean;
  left_to_right_direction?: boolean;
  deactivate_bidi_filtering?: boolean;
}

export interface UpdateDataElementParams {
  data_element_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  type_kind?: 'domain' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClifType';
  type_name?: string;
  data_type?: string;
  length?: number;
  decimals?: number;
  short_label?: string;
  medium_label?: string;
  long_label?: string;
  heading_label?: string;
  search_help?: string;
  search_help_parameter?: string;
  set_get_parameter?: string;
  default_component_name?: string;
  deactivate_input_history?: boolean;
  change_document?: boolean;
  left_to_right_direction?: boolean;
  deactivate_bidi_filtering?: boolean;
  activate?: boolean;
}

export interface DeleteDataElementParams {
  data_element_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
// Note: packageName is required for create operations (validated in builder methods)
// description is required for create/validate operations
export interface DataElementBuilderConfig {
  dataElementName: string;
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
  typeKind?: 'domain' | 'predefinedAbapType' | 'refToPredefinedAbapType' | 'refToDictionaryType' | 'refToClifType';
  typeName?: string;
}

export interface DataElementBuilderState extends BaseBuilderState {
  // DataElement-specific state can be added here if needed
}
