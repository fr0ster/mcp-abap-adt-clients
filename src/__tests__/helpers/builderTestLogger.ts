export interface BuilderTestLogger {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

const debugLogsEnabled = process.env.DEBUG_ADT_TESTS === 'true';
const lockLogsSetting = (process.env.LOG_LOCKS || 'true').toLowerCase();
const lockLogsEnabled = lockLogsSetting !== 'false' && lockLogsSetting !== '0' && lockLogsSetting !== 'off';

// Track test progress
let testCounter = 0;
let totalTests = 0;
const testStartTimes = new Map<string, number>();

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
  process.stdout.write(message + '\n');
}

export function logBuilderTestStart(logger: BuilderTestLogger | undefined, testName: string, testCase: any): void {
  if (!testCase) {
    return;
  }

  testCounter++;
  const startTime = Date.now();
  testStartTimes.set(testName, startTime);

  const progress = totalTests > 0 ? `[${testCounter}/${totalTests}]` : `[${testCounter}]`;
  const startMessage = `${progress} ▶ ${testName} :: ${testCase.name}`;

  logImmediate(startMessage);

  if (debugLogsEnabled) {
    const serializedParams = JSON.stringify(testCase.params || {});
    logImmediate(`  Params: ${serializedParams}`);
  }

  logger?.info?.(startMessage);
  if (debugLogsEnabled) {
    logger?.info?.(`Params: ${JSON.stringify(testCase.params || {})}`);
  }
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
}

export function logBuilderTestSkip(logger: BuilderTestLogger | undefined, testName: string, reason: string): void {
  const currentCounter = testCounter > 0 ? testCounter : 1;
  const progress = totalTests > 0 ? `[${currentCounter}/${totalTests}]` : `[${currentCounter}]`;
  const message = `${progress} ⏭ SKIP ${testName} – ${reason}`;
  logImmediate(message);
  logger?.warn?.(message);
}

export function logBuilderTestSuccess(logger: BuilderTestLogger | undefined, testName: string): void {
  const startTime = testStartTimes.get(testName);
  const duration = startTime ? ` (${((Date.now() - startTime) / 1000).toFixed(1)}s)` : '';
  const progress = totalTests > 0 ? `[${testCounter}/${totalTests}]` : `[${testCounter}]`;
  const message = `${progress} ✓ PASS ${testName}${duration}`;
  // Ensure immediate output
  logImmediate(message);
  logger?.info?.(message);
  testStartTimes.delete(testName);
}

export function logBuilderTestEnd(logger: BuilderTestLogger | undefined, testName: string): void {
  // End is logged implicitly in success/fail, only log in debug mode
  if (debugLogsEnabled) {
    const message = `  END ${testName}`;
    logImmediate(message);
    logger?.info?.(message);
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

  logger?.error?.(message, error);
  testStartTimes.delete(testName);
}

export function logBuilderTestStep(step: string): void {
  if (debugLogsEnabled) {
    logImmediate(`  → ${step}`);
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

