/**
 * AppendStructure (TABL/DS append) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface ICreateAppendStructureParams {
  append_structure_name: string;
  base_object: string; // name of the base table OR structure being extended
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateAppendStructureParams {
  append_structure_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteAppendStructureParams {
  append_structure_name: string;
  transport_request?: string;
}

export interface IAppendStructureConfig {
  appendStructureName: string;
  baseObject?: string; // required for create (validated in handler)
  masterLanguage?: string;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

export interface IAppendStructureState extends IAdtObjectState {
  validationSupported?: boolean;
}
