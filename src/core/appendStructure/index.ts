import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IAppendStructureConfig, IAppendStructureState } from './types';

export { AdtAppendStructure } from './AdtAppendStructure';
export * from './types';

export type AdtAppendStructureType = IAdtObject<
  IAppendStructureConfig,
  IAppendStructureState
>;
