/**
 * Unit test module type definitions
 */

// Types defined in @mcp-abap-adt/interfaces
export type {
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestConfig,
  IUnitTestState,
} from '@mcp-abap-adt/interfaces';

// =============================================================================
// Synchronous object-based run (/sap/bc/adt/abapunit/testruns)
// =============================================================================

export type UnitTestObjectType =
  | 'class'
  | 'program'
  | 'function_group'
  | 'include'
  | 'package';

/**
 * Test discovery scope, mirrors the ADT testDeterminationStrategy attributes:
 * - own_tests:     tests in the same program (sameProgram=true, assignedTests=false)
 * - foreign_tests: tests in external classes assigned via TAUNIT_TEST_REL
 * - all_tests:     both own and foreign
 */
export type UnitTestRunScope = 'own_tests' | 'foreign_tests' | 'all_tests';

export interface IUnitTestRunSyncOptions {
  withCoverage?: boolean;
  testScope?: UnitTestRunScope;
}

export interface IUnitTestAlert {
  kind: string;
  severity: string;
  title: string;
}

export interface IUnitTestMethodResult {
  testClass: string;
  name: string;
  status: 'passed' | 'failed' | 'error';
  alerts: IUnitTestAlert[];
}

export interface IUnitTestSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  methods: IUnitTestMethodResult[];
}
