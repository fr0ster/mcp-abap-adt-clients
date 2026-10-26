import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { parseBatchResponse } from '../../batch/wire';

export function assertBatchStatuses(
  response: IAdtWireResponse,
  file: string,
): void {
  for (const [index, part] of parseBatchResponse(response).entries()) {
    if (part.status !== 200)
      throw new Error(
        `Batch part ${index + 1}: expected 200, received ${part.status}; exchange: ${file}`,
      );
  }
}
