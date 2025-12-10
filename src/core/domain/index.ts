/**
 * Domain operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IDomainConfig, IDomainState } from './types';

export * from './types';
export { DomainBuilder } from './DomainBuilder';
export { AdtDomain } from './AdtDomain';

// Type alias for AdtDomain
export type AdtDomainType = IAdtObject<IDomainConfig, IDomainState>;
