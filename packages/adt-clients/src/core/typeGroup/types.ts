/**
 * Type group (`TYPE/DG`) types: the result set's default and the low-level
 * parameters.
 */
import type { ITypeGroupResults } from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

export type {
  ITypeGroupConfig,
  ITypeGroupResults,
} from '@mcp-abap-adt/interfaces-adt';

/** The documents as they arrived, one slot per member. */
export const typeGroupDocuments = {
  validation: rawDocument,
  created: rawDocument,
  metadata: rawDocument,
  source: rawDocument,
  updated: rawDocument,
  activation: rawDocument,
  deletion: rawDocument,
  versions: rawDocument,
  versionSource: rawDocument,
} satisfies ITypeGroupResults;

/** What `create` sends, each value as the caller gave it. */
export interface ICreateTypeGroupParams {
  type_group_name: string;
  package_name: string;
  description?: string | undefined;
  transport_request?: string | undefined;
  masterLanguage?: string | undefined;
}

/** What `update` sends: the source, whole, under the caller's lock. */
export interface IUpdateTypeGroupParams {
  type_group_name: string;
  source_code: string;
  transport_request?: string | undefined;
}

/** What `delete` sends, under the caller's lock. */
export interface IDeleteTypeGroupParams {
  type_group_name: string;
  transport_request?: string | undefined;
}
