/**
 * AppendStructure (TABL/DS append) module type definitions
 */
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Low-level function parameters — defined in @mcp-abap-adt/interfaces
export type {
  ICreateAppendStructureParams,
  IDeleteAppendStructureParams,
  IUpdateAppendStructureParams,
} from '@mcp-abap-adt/interfaces';

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
