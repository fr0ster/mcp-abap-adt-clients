import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type TransformationType = 'SimpleTransformation' | 'XSLTProgram';

// Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
export type {
  ICreateTransformationParams,
  IDeleteTransformationParams,
  IUpdateTransformationParams,
} from '@mcp-abap-adt/interfaces';

// Builder configuration (camelCase)
export interface ITransformationConfig {
  transformationName: string;
  masterLanguage?: string; // Original/master language for create; falls back to systemContext (SAP_LANGUAGE), then EN
  transformationType: TransformationType;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

// Uses standard IAdtObjectState fields: readResult, metadataResult, transportResult, etc.
export interface ITransformationState extends IAdtObjectState {}
