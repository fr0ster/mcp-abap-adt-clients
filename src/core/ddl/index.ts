/**
 * View operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IDdlConfig, IDdlState } from './types';

export { AdtDdl } from './AdtDdl';
export * from './types';

// Type alias for AdtDdl
export type AdtDdlType = IAdtObject<IDdlConfig, IDdlState>;
