import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type {
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState,
} from './types';

export { AdtScalarFunctionImplementation } from './AdtScalarFunctionImplementation';
export * from './types';

export type AdtScalarFunctionImplementationType = IAdtObject<
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState
>;
