/**
 * Transport operations - exports
 */

import { IAdtObject, ITransportBuilderConfig } from '@mcp-abap-adt/interfaces';

export { TransportBuilder } from './TransportBuilder';
export { AdtRequest } from './AdtRequest';

// Type alias for AdtRequest
export type AdtRequestType = IAdtObject<ITransportBuilderConfig, ITransportBuilderConfig>;
