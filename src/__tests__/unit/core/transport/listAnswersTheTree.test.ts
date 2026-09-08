/**
 * `list()` answers the tree, and does it in the requests it already made.
 *
 * There used to be a second member, `listNodes()`, which was `list()` plus the
 * parse — one endpoint reached through two names, differing only in how far the
 * document was read. 31.0.0 removed it: the reading is chosen when the
 * implementation is built, so `list()` answers whatever that reading makes of
 * the document and the shipped one is the tree.
 *
 * What survives from that file is the claim the split existed to protect —
 * parsing costs no extra round-trip. The parse itself is pinned in
 * `parseTransportTree.test.ts`, and how the search configuration is resolved in
 * `listResolution.test.ts`; this is the seam between them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtRequest } from '../../../../core/transport/AdtRequest';
import { expectResult } from '../../../helpers/contract';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '../../../fixtures/transport', name), 'utf8');

const CONFIGURATIONS =
  '<configurations:configurations xmlns:configurations="c">' +
  '<configuration:configuration client="100" xmlns:configuration="k">' +
  '<atom:link href="/only" xmlns:atom="a"/>' +
  '</configuration:configuration>' +
  '</configurations:configurations>';

const connectionOver = (listXml: string) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: options.url.includes('searchconfiguration')
          ? CONFIGURATIONS
          : listXml,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('AdtRequest.list()', () => {
  it('answers the parsed tree, and the parse costs no request', async () => {
    const { connection, calls } = connectionOver(
      fixture('transportTree.noTargets.xml'),
    );

    const tree = expectResult(
      await new AdtRequest(connection).list(),
      'list transport requests',
    );

    expect(tree.requests).toHaveLength(7);
    // The configuration lookup and the listing itself. Nothing is re-fetched
    // to read the document a second time.
    expect(calls).toHaveLength(2);
  });
});
