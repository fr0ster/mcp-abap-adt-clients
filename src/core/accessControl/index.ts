import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IAccessControlConfig, IAccessControlState } from './types';

export { AdtAccessControl } from './AdtAccessControl';
export * from './types';

export type AdtAccessControlType = IAdtSourceObject<
  IAccessControlConfig,
  IAccessControlState
>;
