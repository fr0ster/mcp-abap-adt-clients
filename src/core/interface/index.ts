/**
 * Interface operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IInterfaceConfig, IInterfaceState } from './types';

export * from './types';
export { InterfaceBuilder } from './InterfaceBuilder';
export { AdtInterface } from './AdtInterface';

// Type alias for AdtInterface
export type AdtInterfaceType = IAdtObject<IInterfaceConfig, IInterfaceState>;
