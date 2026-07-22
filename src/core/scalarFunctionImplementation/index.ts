import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type {
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState,
} from './types';

export { AdtScalarFunctionImplementation } from './AdtScalarFunctionImplementation';
export * from './types';

export type AdtScalarFunctionImplementationType = IAdtSourceObject<
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState
>;
