/**
 * AuthorizationField (SUSO / AUTH) module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters — defined in @mcp-abap-adt/interfaces
export type { ICreateAuthorizationFieldParams } from '@mcp-abap-adt/interfaces';

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
