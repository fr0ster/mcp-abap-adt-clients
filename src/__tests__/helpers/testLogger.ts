/**
 * Test logging helper with configurable log levels
 *
 * Usage:
 *   LOG_LEVEL=error  - Only errors
 *   LOG_LEVEL=warn   - Errors + warnings + skip reasons
 *   LOG_LEVEL=info   - Errors + warnings + info (default)
 *   LOG_LEVEL=debug  - All logs (same as DEBUG_TESTS=true)
 *
 * Backward compatibility:
 *   DEBUG_TESTS=true - Same as LOG_LEVEL=debug
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

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function getLogLevel(): LogLevel {
  // Backward compatibility: DEBUG_TESTS=true → debug level
  if (process.env.DEBUG_TESTS === 'true') {
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
 */
export function createTestLogger(prefix?: string): TestLogger {
  const p = prefix ? `[${prefix}] ` : '';

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
    debug: shouldLog('debug')
      ? function(msg, ...args) {
          const location = getCallerLocation();
          console.log(`${p}${msg}`, ...args);
          if (location) console.log(`      at ${location}`);
        }
      : () => {},
    info: shouldLog('info')
      ? function(msg, ...args) {
          console.log(`${p}${msg}`, ...args);
          if (shouldLog('debug')) {
            const location = getCallerLocation();
            if (location) console.log(`      at ${location}`);
          }
        }
      : () => {},
    warn: shouldLog('warn')
      ? function(msg, ...args) {
          console.warn(`${p}⚠️  ${msg}`, ...args);
          if (shouldLog('debug')) {
            const location = getCallerLocation();
            if (location) console.warn(`      at ${location}`);
          }
        }
      : () => {},
    error: shouldLog('error')
      ? function(msg, ...args) {
          console.error(`${p}❌ ${msg}`, ...args);
          if (shouldLog('debug')) {
            const location = getCallerLocation();
            if (location) console.error(`      at ${location}`);
          }
        }
      : () => {},
    skip: shouldLog('warn')
      ? (msg, reason) => process.stdout.write(`${p}⏭️  SKIPPED: ${msg}\n   Reason: ${reason}\n`)
      : () => {},
    csrfToken: shouldLog('debug')
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
