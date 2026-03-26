/**
 * Transport operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { ITransportConfig, ITransportState } from './types';

export { AdtRequest } from './AdtRequest';
export { AdtRequestLegacy } from './AdtRequestLegacy';
export type {
  IListTransportsParams,
  ITransportConfig,
  ITransportState,
} from './types';

// Type alias for AdtRequest
export type AdtRequestType = IAdtObject<ITransportConfig, ITransportState>;
