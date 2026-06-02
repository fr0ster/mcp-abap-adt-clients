/**
 * Unit test module type definitions
 */

import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

// Unit test definition types (local to adt-clients)
export interface IClassUnitTestDefinition {
  containerClass: string;
  testClass: string;
}

export interface IClassUnitTestRunOptions {
  title?: string;
  context?: string;
  scope?: {
    ownTests?: boolean;
    foreignTests?: boolean;
    addForeignTestsAsPreview?: boolean;
  };
  riskLevel?: {
    harmless?: boolean;
    dangerous?: boolean;
    critical?: boolean;
  };
  duration?: {
    short?: boolean;
    medium?: boolean;
    long?: boolean;
  };
}

// Re-export with aliases for backward compatibility
export type ClassUnitTestDefinition = IClassUnitTestDefinition;
export type ClassUnitTestRunOptions = IClassUnitTestRunOptions;

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

// Unit test configuration (camelCase)
export interface IUnitTestConfig {
  tests?: Array<{
    containerClass: string;
    testClass: string;
  }>; // Optional: required for test run, not needed for test class creation
  options?: {
    title?: string;
    context?: string;
    scope?: {
      ownTests?: boolean;
      foreignTests?: boolean;
      addForeignTestsAsPreview?: boolean;
    };
    riskLevel?: {
      harmless?: boolean;
      dangerous?: boolean;
      critical?: boolean;
    };
    duration?: {
      short?: boolean;
      medium?: boolean;
      long?: boolean;
    };
  };
  runId?: string; // Set after create, used for read operations
  status?: unknown;
  result?: unknown;
}

// Unit test state
export interface IUnitTestState extends IAdtObjectState {
  runId?: string;
  runStatus?: unknown;
  runResult?: unknown;
}
