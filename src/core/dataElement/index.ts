/**
 * DataElement operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IDataElementConfig, IDataElementState } from './types';

export { AdtDataElement } from './AdtDataElement';
export { DataElementBuilder } from './DataElementBuilder';
export * from './types';

// Type alias for AdtDataElement
export type AdtDataElementType = IAdtObject<
  IDataElementConfig,
  IDataElementState
>;
