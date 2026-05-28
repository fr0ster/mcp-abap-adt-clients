/**
 * ATC (ABAP Test Cockpit) module type definitions
 */

import type {
  AtcFindingsFormat,
  AtcObjectType,
  IAdtObjectState,
} from '@mcp-abap-adt/interfaces';

export type { AtcFindingsFormat, AtcObjectType };

export interface IAtcRunOptions {
  checkVariant?: string;
  maxFindings?: number;
}

export interface IAtcFindingsOptions {
  format?: AtcFindingsFormat;
  includeExemptedFindings?: boolean;
}

export interface IAtcListVariantsOptions {
  maxItemCount?: number;
  namePattern?: string;
}

export interface IAtcConfig {
  objectName?: string;
  objectType?: AtcObjectType;
  options?: IAtcRunOptions;
  worklistId?: string;
  runId?: string;
  findingsFormat?: AtcFindingsFormat;
  includeExemptedFindings?: boolean;
}

export interface IAtcState extends IAdtObjectState {
  worklistId?: string;
  runId?: string;
  checkVariant?: string;
  runStatus?: unknown;
  findings?: unknown;
}
