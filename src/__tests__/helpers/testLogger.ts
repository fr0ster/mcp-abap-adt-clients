/**
 * Test logging helper with configurable log levels
 *
 * Usage:
 *   LOG_LEVEL=error  - Only errors
 *   LOG_LEVEL=warn   - Errors + warnings + skip reasons
 *   LOG_LEVEL=info   - Errors + warnings + info (default)
 *   LOG_LEVEL=debug  - All logs
 *
 * Debug flags (granular control):
 *   DEBUG_ADT_LIBS=true           - Library code (Builders, core clients)
 *   DEBUG_ADT_HELPER_TESTS=true   - Test helpers (test-helper.js, builderTestLogger, etc.)
 *   DEBUG_ADT_E2E_TESTS=true      - E2E/integration tests
 *   DEBUG_ADT_TESTS=true          - All of the above (backward compatibility)
 *
 * Test Pattern with Skip Reporting:
 *
 * ```typescript
 * describe('My Test Suite', () => {
 *   let testCase: any = null;
 *   let objectName: string | null = null;
 *
 *   beforeEach(async () => {
 *     // Preparation: fetch test case, clean up existing objects
 *     if (!hasConfig) {
 *       logger.skip('Test name', 'Authentication failed');
 *       testCase = null;
 *       objectName = null;
 *       return;
 *     }
 *
 *     const tc = getEnabledTestCase('operation', 'test_id');
 *     if (!tc) {
 *       logger.skip('Test name', 'Test case not enabled in test-config.yaml');
 *       testCase = null;
 *       objectName = null;
 *       return;
 *     }
 *
 *     testCase = tc;
 *     objectName = tc.params.object_name;
 *
 *     try {
 *       await deleteObjectIfExists(objectName!);
 *     } catch (error: any) {
 *       logger.skip('Test name', `Failed to prepare: ${error.message}`);
 *       testCase = null;
 *       objectName = null;
 *     }
 *   });
 *
 *   it('should do something', async () => {
 *     if (!testCase || !objectName) {
 *       return; // Already logged in beforeEach
 *     }
 *     // Test logic here
 *   });
 * });
 * ```
 *
 * Benefits:
 * - Skip reason shown only once (in beforeEach)
 * - No duplicate logging in test body
 * - Clean separation: preparation vs test execution
 * - Works with LOG_LEVEL=warn to show skip reasons without debug spam
 */


import { testLogger } from '@mcp-abap-adt/logger';
import type { ILogger } from '@mcp-abap-adt/interfaces';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Debug scope for granular control over logging
 */
export type DebugScope = 'connectors' | 'libs' | 'helpers' | 'e2e' | 'tests' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Check if debug is enabled for a specific scope
 */
export function isDebugEnabled(scope: DebugScope): boolean {
  // // DEBUG_ADT_TESTS=true enables all scopes (backward compatibility)
  // if (process.env.DEBUG_ADT_TESTS === 'true') {
  //   return true;
  // }

  switch (scope) {
    case 'connectors':
      return process.env.DEBUG_CONNECTORS === 'true';
    case 'libs':
      return process.env.DEBUG_ADT_LIBS === 'true';
    case 'helpers':
      return process.env.DEBUG_ADT_HELPER_TESTS === 'true';
    case 'e2e':
      return process.env.DEBUG_ADT_E2E_TESTS === 'true';
    case 'tests':
      return process.env.DEBUG_ADT_TESTS === 'true';
    case 'none':
      return false;
  }
}

function getLogLevel(): LogLevel {
  // Backward compatibility: DEBUG_ADT_TESTS=true → debug level
  if (process.env.DEBUG_ADT_TESTS === 'true') {
    return 'debug';
  }

  const level = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

const currentLevel = getLogLevel();
const currentLevelValue = LOG_LEVELS[currentLevel];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= currentLevelValue;
}

export interface TestLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  skip: (message: string, reason: string) => void;
  csrfToken?: (action: string, token?: string) => void;
}

/**
 * Create a test logger with configured log level
 * @param prefix - Optional prefix for log messages
 * @param scope - Debug scope (libs, helpers, e2e, all) - controls debug logging
 */
export function createTestLogger(prefix?: string, scope: DebugScope = 'none'): TestLogger {
  const p = prefix ? `[${prefix}] ` : '';
  const debugEnabled = isDebugEnabled(scope);

  // Helper to get caller location from stack trace
  function getCallerLocation(): string {
    const stack = new Error().stack;
    if (!stack) return '';

    const lines = stack.split('\n');
    // Skip: Error, getCallerLocation, logger function, actual caller
    const callerLine = lines[3];
    if (!callerLine) return '';

    // Extract file:line:col from stack trace
    const match = callerLine.match(/\((.+):(\d+):(\d+)\)/) || callerLine.match(/at (.+):(\d+):(\d+)/);
    if (!match) return '';

    const [, file, line, col] = match;
    const shortFile = file.replace(/.*\/packages\//, 'packages/').replace(/.*\/src\//, 'src/');
    return `${shortFile}:${line}:${col}`;
  }

  return {
    debug: shouldLog('debug') && debugEnabled
      ? function(msg, ...args) {
          const location = getCallerLocation();
          console.log(`${p}${msg}`, ...args);
          if (location) console.log(`      at ${location}`);
        }
      : () => {},
    info: shouldLog('info')
      ? function(msg, ...args) {
          console.log(`${p}${msg}`, ...args);
          if (debugEnabled) {
            const location = getCallerLocation();
            if (location) console.log(`      at ${location}`);
          }
        }
      : () => {},
    warn: shouldLog('warn')
      ? function(msg, ...args) {
          console.warn(`${p}⚠️  ${msg}`, ...args);
          if (debugEnabled) {
            const location = getCallerLocation();
            if (location) console.warn(`      at ${location}`);
          }
        }
      : () => {},
    error: shouldLog('error')
      ? function(msg, ...args) {
          console.error(`${p}❌ ${msg}`, ...args);
          if (debugEnabled) {
            const location = getCallerLocation();
            if (location) console.error(`      at ${location}`);
          }
        }
      : () => {},
    skip: shouldLog('warn')
      ? (msg, reason) => process.stdout.write(`${p}⏭️  SKIPPED: ${msg}\n   Reason: ${reason}\n`)
      : () => {},
    csrfToken: shouldLog('debug') && debugEnabled
      ? function(action, token) {
          const location = getCallerLocation();
          console.log(`${p}CSRF ${action}:`, token);
          if (location) console.log(`      at ${location}`);
        }
      : () => {},
  };
}

/**
 * Get current log level (for debugging)
 */
export function getCurrentLogLevel(): LogLevel {
  return currentLevel;
}

/**
 * Create a connection logger for @mcp-abap-adt/connection package
 * Uses DEBUG_CONNECTORS flag
 * Returns ILogger compatible logger from @mcp-abap-adt/logger
 * Note: ILogger from @mcp-abap-adt/interfaces doesn't have csrfToken, but connection package extends it
 */
export function createConnectionLogger(): ILogger {
  const enabled = isDebugEnabled('connectors');
  if (!enabled) {
    // Return empty logger if debug is disabled
    return emptyLogger;
  }
  // Use testLogger from @mcp-abap-adt/logger when debug is enabled
  // Note: connection package may need csrfToken, but ILogger doesn't have it
  // This is a compatibility layer - connection package will handle csrfToken separately if needed
  return testLogger;
}

/**
 * Create a builder logger for Builder library code
 * Uses DEBUG_ADT_LIBS flag
 * Returns ILogger compatible logger from @mcp-abap-adt/logger
 * Logger respects AUTH_LOG_LEVEL environment variable for log level control
 */
export function createBuilderLogger(): ILogger {
  const enabled = isDebugEnabled('libs');
  if (!enabled) {
    // Return empty logger if debug is disabled
    return emptyLogger;
  }
  // Use testLogger from @mcp-abap-adt/logger when debug is enabled
  // Logger will respect AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return testLogger;
}

/**
 * Create a test logger for Builder integration tests
 * Uses DEBUG_ADT_TESTS flag
 * Returns ILogger compatible logger from @mcp-abap-adt/logger
 * Logger respects AUTH_LOG_LEVEL environment variable for log level control
 */
export function createTestsLogger(): ILogger {
  const enabled = isDebugEnabled('tests');
  if (!enabled) {
    // Return empty logger if debug is disabled
    return emptyLogger;
  }
  // Use testLogger from @mcp-abap-adt/logger when debug is enabled
  // Logger will respect AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return testLogger;
}

/**
 * Create a test logger for E2E integration tests
 * Uses DEBUG_ADT_E2E_TESTS flag
 * Returns ILogger compatible logger from @mcp-abap-adt/logger
 * Logger respects AUTH_LOG_LEVEL environment variable for log level control
 */
export function createE2ETestsLogger(): ILogger {
  const enabled = isDebugEnabled('e2e');
  if (!enabled) {
    // Return empty logger if debug is disabled
    return emptyLogger;
  }
  // Use testLogger from @mcp-abap-adt/logger when debug is enabled
  // Logger will respect AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return testLogger;
}


/**
 * Empty logger that does nothing (for production use or when logging is disabled)
 * Implements ILogger interface with all required methods
 */
export const emptyLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Safely log error without exposing credentials from AxiosError.config/request
 * Only logs status, statusText, and response data (limited to 500 chars)
 */
export function logErrorSafely(
  logger: ILogger | undefined,
  operation: string,
  error: any
): void {
  if (error?.response) {
    const status = error.response.status;
    const statusText = error.response.statusText;
    const data = typeof error.response.data === 'string' 
      ? error.response.data.substring(0, 500)
      : JSON.stringify(error.response.data).substring(0, 500);
    logger?.error(`${operation} failed: HTTP ${status} ${statusText}`, { status, statusText, data });
  } else {
    logger?.error(`${operation} failed:`, error instanceof Error ? error.message : String(error));
  }
}