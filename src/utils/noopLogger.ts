import type { ILogger } from '@mcp-abap-adt/interfaces';

export const noopLogger: ILogger = {
  info: () => {},
  debug: () => {},
  error: () => {},
  warn: () => {},
};
