/**
 * Domain operations - exports
 */

import type { IAdtNonVersionedObject } from '@mcp-abap-adt/interfaces';
import type { IDomainConfig, IDomainState } from './types';

export { AdtDomain } from './AdtDomain';
export * from './types';

// Type alias for AdtDomain
export type AdtDomainType = IAdtNonVersionedObject<IDomainConfig, IDomainState>;
