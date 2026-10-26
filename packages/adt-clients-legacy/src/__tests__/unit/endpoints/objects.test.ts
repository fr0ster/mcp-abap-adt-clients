/**
 * The one address of its own the legacy classes declare, against the exact
 * address it must be, beside the root package's record it replaces on 7.40.
 */
import { TRANSPORT_REQUEST } from '@mcp-abap-adt/adt-clients';
import { TRANSPORT_REQUEST_LEGACY } from '../../../core/transport/readLegacy';

describe('records', () => {
  it('transport request has a legacy address of its own', () => {
    expect(TRANSPORT_REQUEST.collection).toBe(
      '/sap/bc/adt/cts/transportrequests',
    );
    expect(TRANSPORT_REQUEST_LEGACY.collection).toBe(
      '/sap/bc/cts/transportrequests',
    );
  });
});
