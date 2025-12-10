/**
 * DataElement operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IDataElementConfig, IDataElementState } from './types';

export * from './types';
export { DataElementBuilder } from './DataElementBuilder';
export { AdtDataElement } from './AdtDataElement';

// Type alias for AdtDataElement
export type AdtDataElementType = IAdtObject<IDataElementConfig, IDataElementState>;
