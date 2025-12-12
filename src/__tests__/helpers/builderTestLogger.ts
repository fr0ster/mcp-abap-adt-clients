import type { ILogger } from '@mcp-abap-adt/interfaces';
import { DefaultLogger } from '@mcp-abap-adt/logger/dist/default-logger';
import { getLogLevel } from '@mcp-abap-adt/logger/dist/types';

export interface BuilderTestLogger {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

/**
 * Get logger instance for test logging
 * Uses DefaultLogger from @mcp-abap-adt/logger if logger is provided
 * Otherwise returns undefined (logging will use logImmediate only)
 */
function getTestLogger(logger: ILogger | undefined): ILogger | undefined {
  if (!logger) {
    return undefined;
  }
  // If logger is provided, use it (should be DefaultLogger from testLogger.ts)
  // DefaultLogger uses process.stdout/stderr which is synchronous and ideal for tests
  return logger;
}

const debugLogsEnabled = process.env.DEBUG_ADT_TESTS === 'true';
const lockLogsSetting = (process.env.LOG_LOCKS || 'true').toLowerCase();
const lockLogsEnabled = lockLogsSetting !== 'false' && lockLogsSetting !== '0' && lockLogsSetting !== 'off';

// Track test progress
let testCounter = 0;
let totalTests = 0;
const testStartTimes = new Map<string, number>();
const testResults = new Map<string, 'PASS' | 'FAIL' | 'SKIP'>();

function extractErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  // Handle AxiosError
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as any;
    const status = axiosError.response?.status;
    const statusText = axiosError.response?.statusText;
    const data = axiosError.response?.data;

    let message = `HTTP ${status || '?'}`;
    if (statusText) {
      message += ` ${statusText}`;
    }

    // Try to extract meaningful message from response data
    if (data) {
      let dataMessage = '';
      if (typeof data === 'string') {
        // Try to parse XML error
        try {
          const { XMLParser } = require('fast-xml-parser');
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsed = parser.parse(data);
          const errorText = parsed['exc:exception']?.message?.['#text'] ||
                           parsed['exc:exception']?.message ||
                           parsed['exc:exception']?.reason?.['#text'] ||
                           parsed['exc:exception']?.reason;
          if (errorText) {
            dataMessage = errorText;
          } else {
            // Take first 200 chars of XML
            dataMessage = data.substring(0, 200).replace(/\s+/g, ' ').trim();
          }
        } catch {
          // Not XML, take first 200 chars
          dataMessage = data.substring(0, 200).replace(/\s+/g, ' ').trim();
        }
      } else if (typeof data === 'object') {
        dataMessage = JSON.stringify(data).substring(0, 200);
      }

      if (dataMessage) {
        message += `: ${dataMessage}`;
      }
    }

    return message;
  }

  // Handle regular Error
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Force immediate output (Jest buffers console.log)
function logImmediate(message: string): void {
  // Use synchronous write to ensure messages appear in order
  // This ensures test logs are not interleaved when tests run sequentially
  process.stdout.write(message + '\n');
}

export function logBuilderTestStart(logger: ILogger | undefined, testName: string, testCase: any): void {
  if (!testCase) {
    return;
  }

  testCounter++;
  const startTime = Date.now();
  testStartTimes.set(testName, startTime);

  const progress = totalTests > 0 ? `[${testCounter}/${totalTests}]` : `[${testCounter}]`;
  const startMessage = `${progress} ▶ START ${testName} :: ${testCase.name}`;

  // Use logImmediate for synchronous output (Jest buffers console.log)
  logImmediate(startMessage);
  // Also log via logger if provided (uses DefaultLogger which is synchronous)
  const testLogger = getTestLogger(logger);
  testLogger?.info?.(startMessage);
}

export function setTotalTests(count: number): void {
  totalTests = count;
  if (count > 0) {
    logImmediate(`\n📋 Running ${count} test(s)...\n`);
  }
}

export function resetTestCounter(): void {
  testCounter = 0;
  totalTests = 0;
  testStartTimes.clear();
  testResults.clear();
}

export function logBuilderTestSkip(logger: BuilderTestLogger | undefined, testName: string, reason: string, silent: boolean = false): void {
  // If test was disabled before start, don't log anything
  if (silent) {
    testResults.set(testName, 'SKIP');
    return;
  }
  
  const currentCounter = testCounter > 0 ? testCounter : 1;
  const progress = totalTests > 0 ? `[${currentCounter}/${totalTests}]` : `[${currentCounter}]`;
  const message = `${progress} ⏭ SKIP ${testName} – ${reason}`;
  
  // Use logImmediate for synchronous output (Jest buffers console.log)
  logImmediate(message);
  // Also log via logger if provided (uses DefaultLogger which is synchronous)
  if (logger && 'info' in logger) {
    const testLogger = logger as ILogger;
    testLogger.info?.(message);
  }
  testResults.set(testName, 'SKIP');
}

export function logBuilderTestSuccess(logger: BuilderTestLogger | undefined, testName: string): void {
  try {
    const startTime = testStartTimes.get(testName);
    const duration = startTime ? ` (${((Date.now() - startTime) / 1000).toFixed(1)}s)` : '';
    const progress = totalTests > 0 ? `[${testCounter}/${totalTests}]` : `[${testCounter}]`;
    const message = `${progress} ✓ PASS ${testName}${duration}`;
    
    // Use logImmediate for synchronous output (Jest buffers console.log)
    logImmediate(message);
    // Also log via logger if provided (uses DefaultLogger which is synchronous)
    if (logger && 'info' in logger) {
      const testLogger = logger as ILogger;
      testLogger.info?.(message);
    }
    testStartTimes.delete(testName);
    testResults.set(testName, 'PASS');
  } catch (error) {
    // Ignore logging errors if test already completed
    // This can happen when tests are run in parallel and Jest considers test done
  }
}

export function logBuilderTestEnd(logger: BuilderTestLogger | undefined, testName: string): void {
  // Always log test completion to show clear test boundaries
  // This ensures we see when each test finishes, making logs easier to read
  const result = testResults.get(testName);
  const progress = totalTests > 0 ? `[${testCounter}/${totalTests}]` : `[${testCounter}]`;
  
  if (result === 'PASS' || result === 'FAIL') {
    // Test already logged result, but we still log completion for clarity
    const message = `${progress} ✓ END ${testName}`;
    logImmediate(message);
    // Add blank line after test completion for better readability
    logImmediate('');
    // Also log via logger if provided
    if (logger && 'info' in logger) {
      const testLogger = logger as ILogger;
      testLogger.info?.(message);
    }
    return;
  }
  
  // If test was skipped or ended without explicit result, log completion
  const message = `${progress} ✓ END ${testName}`;
  logImmediate(message);
  // Add blank line after test completion for better readability
  logImmediate('');
  // Also log via logger if provided
  if (logger && 'info' in logger) {
    const testLogger = logger as ILogger;
    testLogger.info?.(message);
  }
}

export function logBuilderTestError(
  logger: BuilderTestLogger | undefined,
  testName: string,
  error: unknown
): void {
  const startTime = testStartTimes.get(testName);
  const duration = startTime ? ` (${((Date.now() - startTime) / 1000).toFixed(1)}s)` : '';
  const progress = totalTests > 0 ? `[${testCounter}/${totalTests}]` : `[${testCounter}]`;
  const errorMessage = extractErrorMessage(error);
  const message = `${progress} ✗ FAIL ${testName}${duration}: ${errorMessage}`;

  // Use logImmediate for synchronous output (Jest buffers console.log)
  logImmediate(message);

  if (debugLogsEnabled) {
    // In debug mode, show additional details but keep it structured
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      logImmediate(`  Status: ${axiosError.response?.status}`);
      logImmediate(`  URL: ${axiosError.config?.url || axiosError.request?.path || 'unknown'}`);
      if (axiosError.response?.data && typeof axiosError.response.data === 'string') {
        const dataPreview = axiosError.response.data.substring(0, 500);
        logImmediate(`  Response: ${dataPreview}`);
      }
    }
  }

  // Also log via logger if provided (uses DefaultLogger which is synchronous)
  if (logger && 'error' in logger) {
    const testLogger = logger as ILogger;
    testLogger.error?.(message);
  }

  testStartTimes.delete(testName);
  testResults.set(testName, 'FAIL');
}

export function logBuilderTestStep(step: string): void {
  logImmediate(`  → ${step}`);
}

export function logBuilderTestStepError(step: string, error: any): void {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as any;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    
    let errorMessage = '';
    if (typeof data === 'string') {
      // Try to parse XML error and extract only the meaningful message
      try {
        const { XMLParser } = require('fast-xml-parser');
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(data);
        errorMessage = parsed['exc:exception']?.localizedMessage?.['#text'] ||
                      parsed['exc:exception']?.localizedMessage ||
                      parsed['exc:exception']?.message?.['#text'] ||
                      parsed['exc:exception']?.message ||
                      parsed['exc:exception']?.reason?.['#text'] ||
                      parsed['exc:exception']?.reason ||
                      '';
        
        // Clean up HTML tags if present
        if (errorMessage) {
          errorMessage = errorMessage.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        }
      } catch {
        // Not XML, try to extract meaningful part
        const match = data.match(/<message[^>]*>([^<]+)<\/message>/i) ||
                     data.match(/localizedMessage[^>]*>([^<]+)<\/localizedMessage>/i);
        errorMessage = match ? match[1].trim() : '';
      }
    } else if (typeof data === 'object') {
      errorMessage = data.message || data.error || JSON.stringify(data).substring(0, 200);
    }
    
    if (errorMessage) {
      logImmediate(`  ✗ ${step} FAILED (HTTP ${status}): ${errorMessage}`);
    } else {
      logImmediate(`  ✗ ${step} FAILED (HTTP ${status})`);
    }
  } else {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logImmediate(`  ✗ ${step} FAILED: ${errorMessage}`);
  }
}

/**
 * Log systemInfo for debugging (used in FunctionGroup create and other operations)
 */
export function logBuilderSystemInfo(systemInfo: any, finalValues: {
  masterSystem?: string;
  responsible?: string;
  willIncludeMasterSystem?: boolean;
  willIncludeResponsible?: boolean;
  masterSystemAttr?: string;
  responsibleAttr?: string;
}): void {
  if (debugLogsEnabled) {
    logImmediate(`  [SystemInfo] hasSystemInfo: ${!!systemInfo}`);
    logImmediate(`  [SystemInfo] systemID: ${systemInfo?.systemID || '(none)'}`);
    logImmediate(`  [SystemInfo] userName: ${systemInfo?.userName || '(none)'}`);
    logImmediate(`  [SystemInfo] finalMasterSystem: ${finalValues.masterSystem || '(none)'}`);
    logImmediate(`  [SystemInfo] finalResponsible: ${finalValues.responsible || '(none)'}`);
    logImmediate(`  [SystemInfo] willIncludeMasterSystem: ${finalValues.willIncludeMasterSystem || false}`);
    logImmediate(`  [SystemInfo] willIncludeResponsible: ${finalValues.willIncludeResponsible || false}`);
    logImmediate(`  [SystemInfo] masterSystemAttr: ${finalValues.masterSystemAttr || '(not included)'}`);
    logImmediate(`  [SystemInfo] responsibleAttr: ${finalValues.responsibleAttr || '(not included)'}`);
  }
}

export function logBuilderLockEvent(
  objectType: string,
  objectName: string,
  sessionId: string,
  lockHandle: string
): void {
  if (!lockLogsEnabled) {
    return;
  }
  const target = objectType === 'fm' && objectName.includes('/') ? objectName : `${objectType}:${objectName}`;
  logImmediate(`[LOCK] ${target} (session=${sessionId}, handle=${lockHandle})`);
}

export function getHttpStatusText(error: any): string {
  const primaryStatus = typeof error?.response?.status === 'number'
    ? error.response.status
    : typeof error?.status === 'number'
      ? error.status
      : undefined;
  if (typeof primaryStatus === 'number') {
    return `HTTP ${primaryStatus}`;
  }

  const messageSources: string[] = [];
  if (typeof error?.message === 'string') {
    messageSources.push(error.message);
  }
  if (typeof error?.response?.statusText === 'string') {
    messageSources.push(error.response.statusText);
  }
  if (typeof error?.response?.data === 'string') {
    messageSources.push(error.response.data);
  }

  const combined = messageSources.join(' ');
  const match = combined.match(/http\s+(\d{3})/i);
  if (match) {
    return `HTTP ${match[1]}`;
  }

  return 'HTTP ?';
}

