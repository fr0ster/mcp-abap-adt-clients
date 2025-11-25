/**
 * Common logger interface for all ADT library code (Builders, low-level functions)
 * 
 * Usage:
 * - Builders accept this interface in constructor
 * - Low-level functions accept this interface as parameter
 * - Tests can provide their own implementation
 * - Server/CLI can provide their own implementation or pass empty logger
 */
export interface IAdtLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

/**
 * Empty logger that does nothing (for production use or when logging is disabled)
 */
export const emptyLogger: IAdtLogger = {
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
  logger: IAdtLogger | undefined,
  operation: string,
  error: any
): void {
  if (error?.response) {
    const status = error.response.status;
    const statusText = error.response.statusText;
    const data = typeof error.response.data === 'string' 
      ? error.response.data.substring(0, 500)
      : JSON.stringify(error.response.data).substring(0, 500);
    logger?.error?.(`${operation} failed: HTTP ${status} ${statusText}`, { status, statusText, data });
  } else {
    logger?.error?.(`${operation} failed:`, error instanceof Error ? error.message : String(error));
  }
}
