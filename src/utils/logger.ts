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
