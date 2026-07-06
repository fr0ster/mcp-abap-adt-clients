import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type TransformationType = 'SimpleTransformation' | 'XSLTProgram';

// Low-level function parameters (snake_case)
export interface ICreateTransformationParams {
  transformation_name: string;
  transformation_type: TransformationType;
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
  masterLanguage?: string;
}

export interface IUpdateTransformationParams {
  transformation_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteTransformationParams {
  transformation_name: string;
  transport_request?: string;
}

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
