/**
 * Unit test module type definitions
 */

// Re-export interfaces from interfaces package
export type { 
  IUnitTestBuilderConfig as UnitTestBuilderConfig,
  IClassUnitTestDefinition as ClassUnitTestDefinition,
  IClassUnitTestRunOptions as ClassUnitTestRunOptions
} from '@mcp-abap-adt/interfaces';

// Builder state - internal use only
export interface UnitTestBuilderState {
  runId?: string;
  runStatus?: any;
  runResult?: any;
  testLockHandle?: string;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

