/**
 * View operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type { IDdlConfig, IDdlState } from './types';

export { AdtDdl } from './AdtDdl';
export * from './types';

// Type alias for AdtDdl
export type AdtDdlType = IAdtSourceObject<IDdlConfig, IDdlState>;
