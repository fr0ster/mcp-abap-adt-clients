/**
 * Program operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IProgramConfig, IProgramState } from './types';

export * from './types';
export { ProgramBuilder } from './ProgramBuilder';
export { AdtProgram } from './AdtProgram';

// Type alias for AdtProgram
export type AdtProgramType = IAdtObject<IProgramConfig, IProgramState>;
