/**
 * View operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IViewConfig, IViewState } from './types';

export * from './types';
export { ViewBuilder } from './ViewBuilder';
export { AdtView } from './AdtView';

// Type alias for AdtView
export type AdtViewType = IAdtObject<IViewConfig, IViewState>;
