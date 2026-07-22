import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IAppendStructureConfig, IAppendStructureState } from './types';

export { AdtAppendStructure } from './AdtAppendStructure';
export * from './types';

export type AdtAppendStructureType = IAdtSourceObject<
  IAppendStructureConfig,
  IAppendStructureState
>;
