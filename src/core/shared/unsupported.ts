import {
  AdtObjectErrorCodes,
  AdtOperationError,
} from '@mcp-abap-adt/interfaces';

/** Throw a typed "operation not supported for this object type" error. */
export function throwUnsupportedOperation(
  operation: string,
  detail?: string,
): never {
  const e = new AdtOperationError(
    `Operation "${operation}" is not supported${detail ? ` for ${detail}` : ''}`,
  );
  e.code = AdtObjectErrorCodes.UNSUPPORTED_OPERATION;
  throw e;
}
