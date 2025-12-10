/**
 * Unit test module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Re-export interfaces from interfaces package
export type { 
  IUnitTestBuilderConfig as UnitTestBuilderConfig,
  IClassUnitTestDefinition as ClassUnitTestDefinition,
  IClassUnitTestRunOptions as ClassUnitTestRunOptions
} from '@mcp-abap-adt/interfaces';

// Builder state - internal use only
export interface IUnitTestState extends IAdtObjectState {
  runId?: string;
  runStatus?: any;
  runResult?: any;
}

