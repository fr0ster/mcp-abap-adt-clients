import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { ITransformationConfig, ITransformationState } from './types';

export { AdtTransformation } from './AdtTransformation';
export * from './types';

export type AdtTransformationType = IAdtSourceObject<
  ITransformationConfig,
  ITransformationState
>;
