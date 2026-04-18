/**
 * AuthorizationField (SUSO / AUTH) module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export interface ICreateAuthorizationFieldParams {
  authorization_field_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;

  field_name?: string;
  roll_name?: string;
  check_table?: string;
  exit_fb?: string;
  abap_language_version?: string;
  search?: string;
  objexit?: string;
  domname?: string;
  outputlen?: string;
  convexit?: string;
  orglvlinfo?: string;
  col_searchhelp?: string;
  col_searchhelp_name?: string;
  col_searchhelp_descr?: string;
}

export interface IAuthorizationFieldConfig {
  authorizationFieldName: string;
  packageName?: string;
  description?: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;

  fieldName?: string;
  rollName?: string;
  checkTable?: string;
  exitFb?: string;
  abapLanguageVersion?: string;
  search?: string;
  objexit?: string;
  domname?: string;
  outputlen?: string;
  convexit?: string;
  orglvlinfo?: string;
  colSearchhelp?: string;
  colSearchhelpName?: string;
  colSearchhelpDescr?: string;

  onLock?: (lockHandle: string) => void;
}

export interface IAuthorizationFieldState extends IAdtObjectState {}
