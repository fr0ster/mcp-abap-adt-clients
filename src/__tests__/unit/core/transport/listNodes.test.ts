/**
 * `listNodes()` is `list()` plus parsing — never an extra request, and never a
 * silent widening to `unknown` when the caller supplies its own parser.
 *
 * The batch guard lives in `list()` (see listResolution.test.ts) and must keep
 * working the same way through `listNodes()`, since it goes through `list()`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
  ITransportTree,
} from '@mcp-abap-adt/interfaces';
import { AdtRequest } from '../../../../core/transport/AdtRequest';
import { AdtRequestLegacy } from '../../../../core/transport/AdtRequestLegacy';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '../../../fixtures/transport', name), 'utf8');

const CONFIGURATIONS = (...uris: string[]) =>
  '<configurations:configurations xmlns:configurations="c">' +
  uris
    .map(
      (uri) =>
        '<configuration:configuration client="100" xmlns:configuration="k">' +
        `<atom:link href="${uri}" xmlns:atom="a"/>` +
        '</configuration:configuration>',
    )
    .join('') +
  '</configurations:configurations>';

const connectionOver = (
  bodyFor: (url: string) => string,
  extra: Record<string, unknown> = {},
) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: bodyFor(options.url),
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtWireResponse;
    },
    ...extra,
  } as unknown as IAbapConnection;
  return { connection, calls };
};

const bodies = (listXml: string, configurationsXml: string) => (url: string) =>
  url.includes('searchconfiguration') ? configurationsXml : listXml;

describe('listNodes()', () => {
  it('adds no request over list(): same call count, the tree parsed', async () => {
    const noTargets = fixture('transportTree.noTargets.xml');

    const listConn = connectionOver(bodies(noTargets, CONFIGURATIONS('/only')));
    await new AdtRequest(listConn.connection).list();

    const nodesConn = connectionOver(
      bodies(noTargets, CONFIGURATIONS('/only')),
    );
    const tree = await new AdtRequest(nodesConn.connection).listNodes();

    expect(tree.requests).toHaveLength(7);
    expect(nodesConn.calls).toHaveLength(listConn.calls.length);
  });

  it('returns exactly what a supplied parser returns, and never calls the default', async () => {
    const sentinel = { mine: true };
    const parse = jest.fn((_data: unknown) => sentinel);

    // A body the default parser would reject outright — proof that if it ran,
    // this test would fail with a thrown error, not a wrong value.
    const { connection } = connectionOver(
      bodies(
        '<html><body>not a transport tree</body></html>',
        CONFIGURATIONS('/only'),
      ),
    );

    const result: typeof sentinel = await new AdtRequest(connection).listNodes(
      parse,
    );

    expect(result).toBe(sentinel);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  describe('the batch guard, inherited from list()', () => {
    const deferred = { responsesAreDeferred: true };

    it('lets an explicit configUri through and records one part', async () => {
      const { connection, calls } = connectionOver(
        bodies(fixture('transportTree.noTargets.xml'), CONFIGURATIONS('/a')),
        deferred,
      );

      const tree: ITransportTree = await new AdtRequest(connection).listNodes({
        configUri: '/explicit',
      });

      expect(tree.requests).toHaveLength(7);
      expect(calls).toHaveLength(1);
    });

    it('refuses to resolve, rather than hanging, when no configUri is given', async () => {
      const { connection, calls } = connectionOver(
        bodies(fixture('transportTree.noTargets.xml'), CONFIGURATIONS('/a')),
        deferred,
      );

      const started = Date.now();
      await expect(new AdtRequest(connection).listNodes()).rejects.toThrow(
        /configUri is required on a batch client/,
      );

      // A deadlock would surface as a timeout, which reads like a slow pass.
      expect(Date.now() - started).toBeLessThan(1000);
      expect(calls).toHaveLength(0);
    });
  });
});

describe('AdtRequestLegacy.listNodes()', () => {
  it('throws, naming that the legacy payload has never been captured', async () => {
    const { connection } = connectionOver(
      bodies('<tm:root/>', CONFIGURATIONS()),
    );

    await expect(new AdtRequestLegacy(connection).listNodes()).rejects.toThrow(
      /not supported on legacy SAP systems.*never been captured.*list\(\)/s,
    );
  });
});
