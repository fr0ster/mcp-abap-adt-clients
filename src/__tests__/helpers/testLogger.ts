/**
 * Test logging helper - creates loggers using DefaultLogger from @mcp-abap-adt/logger
 *
 * Uses DefaultLogger for tests (synchronous, ideal for test output)
 * PinoLogger is for consumers/servers (asynchronous, may delay output in tests)
 *
 * Environment variables:
 *   AUTH_LOG_LEVEL=error|warn|info|debug  - Controls log level (default: info)
 *   DEBUG_CONNECTORS=true                  - Enable connection logging
 *   DEBUG_ADT_LIBS=true                    - Enable library code logging
 *   DEBUG_ADT_TESTS=true                   - Enable test execution logging
 *   DEBUG_ADT_E2E_TESTS=true               - Enable E2E test logging
 */

import type { ILogger } from '@mcp-abap-adt/interfaces';
// Import only what we need to avoid side effects from pinoLogger initialization
// When importing from '@mcp-abap-adt/logger', it executes: export const pinoLogger = new PinoLogger()
// This causes an error if 'pino' is not installed, even though we don't use pinoLogger
// Solution: Import classes and functions directly from dist files to avoid side effects
import { DefaultLogger } from '@mcp-abap-adt/logger/dist/default-logger';
import { getLogLevel } from '@mcp-abap-adt/logger/dist/types';

/**
 * Debug scope for granular control over logging
 */
export type DebugScope =
  | 'connectors'
  | 'libs'
  | 'helpers'
  | 'e2e'
  | 'tests'
  | 'none';

/**
 * Check if debug is enabled for a specific scope
 */
export function isDebugEnabled(scope: DebugScope): boolean {
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

/**
 * Get current log level (for debugging)
 * Uses getLogLevel from @mcp-abap-adt/logger which respects AUTH_LOG_LEVEL
 */
export function getCurrentLogLevel() {
  return getLogLevel();
}

/**
 * Create a connection logger for @mcp-abap-adt/connection package
 * Uses DEBUG_CONNECTORS flag
 * Returns DefaultLogger from @mcp-abap-adt/logger (synchronous, ideal for tests)
 * Note: ILogger from @mcp-abap-adt/interfaces doesn't have csrfToken, but connection package extends it
 */
export function createConnectionLogger(): ILogger {
  const enabled = isDebugEnabled('connectors');
  if (!enabled) {
    return emptyLogger;
  }
  // Use DefaultLogger for tests - synchronous, ideal for test output
  // Logger respects AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return new DefaultLogger(getLogLevel());
}

/**
 * Create a builder logger for Builder library code
 * Uses DEBUG_ADT_LIBS flag
 * Returns DefaultLogger from @mcp-abap-adt/logger (synchronous, ideal for tests)
 * Logger respects AUTH_LOG_LEVEL environment variable for log level control
 */
export function createBuilderLogger(): ILogger {
  const enabled = isDebugEnabled('libs');
  if (!enabled) {
    return emptyLogger;
  }
  // Use DefaultLogger for tests - synchronous, ideal for test output
  // Logger respects AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return new DefaultLogger(getLogLevel());
}

/**
 * Create a test logger for Builder integration tests
 * Uses DEBUG_ADT_TESTS flag
 * Returns DefaultLogger from @mcp-abap-adt/logger (synchronous, ideal for tests)
 * Logger respects AUTH_LOG_LEVEL environment variable for log level control
 */
export function createTestsLogger(): ILogger {
  const enabled = isDebugEnabled('tests');
  if (!enabled) {
    return emptyLogger;
  }
  // Use DefaultLogger for tests - synchronous, ideal for test output
  // Logger respects AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return new DefaultLogger(getLogLevel());
}

/**
 * Create a test logger for E2E integration tests
 * Uses DEBUG_ADT_E2E_TESTS flag
 * Returns DefaultLogger from @mcp-abap-adt/logger (synchronous, ideal for tests)
 * Logger respects AUTH_LOG_LEVEL environment variable for log level control
 */
export function createE2ETestsLogger(): ILogger {
  const enabled = isDebugEnabled('e2e');
  if (!enabled) {
    return emptyLogger;
  }
  // Use DefaultLogger for tests - synchronous, ideal for test output
  // Logger respects AUTH_LOG_LEVEL (error, warn, info, debug) from environment
  return new DefaultLogger(getLogLevel());
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
  error: any,
): void {
  if (error?.response) {
    const status = error.response.status;
    const statusText = error.response.statusText;
    const data =
      typeof error.response.data === 'string'
        ? error.response.data.substring(0, 500)
        : JSON.stringify(error.response.data).substring(0, 500);
    logger?.error(`${operation} failed: HTTP ${status} ${statusText}`, {
      status,
      statusText,
      data,
    });
  } else {
    logger?.error(
      `${operation} failed:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}
