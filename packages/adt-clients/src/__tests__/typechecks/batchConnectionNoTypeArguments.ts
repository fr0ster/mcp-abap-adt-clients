/**
 * C1 of #304: `AdtBatchConnection.makeAdtRequest` is the contract's, with no
 * type parameters. A caller-chosen answer type was a cast in the library —
 * the part is whatever SAP sent — so a generic call is refused, and the
 * answer's `data` is `unknown`, as from any connection.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtBatchConnection } from '../../batch';

declare const batch: AdtBatchConnection;
const request = { method: 'GET', url: '/u', timeout: 0 };

export async function batchAnswers(): Promise<void> {
  // @ts-expect-error -- no caller-chosen answer type: the part is SAP's
  void batch.makeAdtRequest<string>(request);
  const answer: IAdtWireResponse = await batch.makeAdtRequest(request);
  const data: unknown = answer.data;
  void data;
}
