/**
 * Transport operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { ITransportConfig, ITransportState } from './types';

export { AdtRequest } from './AdtRequest';
export type {
  IResolveTransportParams,
  IResolveTransportResult,
} from './resolveTransport';
export { resolveTransport } from './resolveTransport';
export type { ITransportConfig, ITransportState } from './types';

// Type alias for AdtRequest
export type AdtRequestType = IAdtObject<ITransportConfig, ITransportState>;
