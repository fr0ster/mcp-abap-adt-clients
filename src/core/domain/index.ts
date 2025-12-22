/**
 * Domain operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IDomainConfig, IDomainState } from './types';

export { AdtDomain } from './AdtDomain';
export { DomainBuilder } from './DomainBuilder';
export * from './types';

// Type alias for AdtDomain
export type AdtDomainType = IAdtObject<IDomainConfig, IDomainState>;
