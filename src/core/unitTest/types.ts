/**
 * Unit test module type definitions
 */

export interface ClassUnitTestDefinition {
  containerClass: string;
  testClass: string;
}

export interface ClassUnitTestRunOptions {
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

export interface UnitTestBuilderState {
  runId?: string;
  runStatus?: any;
  runResult?: any;
  testLockHandle?: string;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

