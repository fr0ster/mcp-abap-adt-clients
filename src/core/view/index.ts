/**
 * View operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IViewConfig, IViewState } from './types';

export { AdtView } from './AdtView';
export * from './types';

// Type alias for AdtView
export type AdtViewType = IAdtObject<IViewConfig, IViewState>;
