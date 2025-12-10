/**
 * Transport operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { ITransportConfig, ITransportState } from './types';

export { TransportBuilder } from './TransportBuilder';
export { AdtRequest } from './AdtRequest';
export type { ITransportConfig, ITransportState } from './types';

// Type alias for AdtRequest
export type AdtRequestType = IAdtObject<ITransportConfig, ITransportState>;
