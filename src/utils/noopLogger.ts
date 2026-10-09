import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

export const noopLogger: ILogger = {
  info: () => {},
  debug: () => {},
  error: () => {},
  warn: () => {},
};
