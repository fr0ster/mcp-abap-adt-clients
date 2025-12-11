/**
 * Unit test module type definitions
 */

import { IAdtObjectState } from '@mcp-abap-adt/interfaces';

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
  status?: any; // Set after read (status)
  result?: any; // Set after read (result)
}

// Unit test state
export interface IUnitTestState extends IAdtObjectState {
  runId?: string;
  runStatus?: any;
  runResult?: any;
}

