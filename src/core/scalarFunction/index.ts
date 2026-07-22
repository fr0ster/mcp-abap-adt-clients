import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IScalarFunctionConfig, IScalarFunctionState } from './types';

export { AdtScalarFunction } from './AdtScalarFunction';
export * from './types';

export type AdtScalarFunctionType = IAdtSourceObject<
  IScalarFunctionConfig,
  IScalarFunctionState
>;
