/**
 * Program operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { IProgramConfig, IProgramState } from './types';

export { AdtProgram } from './AdtProgram';
export { runProgram } from './run';
export * from './types';

// Type alias for AdtProgram
export type AdtProgramType = IAdtObject<IProgramConfig, IProgramState>;
