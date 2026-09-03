/**
 * Which saved search runs when the caller names none — and when we must refuse
 * to look it up at all.
 *
 * The refusal has a shape that is easy to get wrong in the safe-looking
 * direction: guarding before reading the explicit configUri rejects every batch
 * call, including the one that works. Both sides are asserted here for that
 * reason.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtRequest } from '../../../../core/transport/AdtRequest';

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

const bodies = (configurationsXml: string) => (url: string) =>
  url.includes('searchconfiguration') ? configurationsXml : '<tm:root/>';

describe('resolving a search configuration', () => {
  it('uses an explicit configUri and asks for no configurations at all', async () => {
    const { connection, calls } = connectionOver(bodies(CONFIGURATIONS('/a')));

    await new AdtRequest(connection).list({ configUri: '/explicit' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('configUri=%2Fexplicit');
  });

  it('uses the only configuration when the caller names none', async () => {
    const { connection, calls } = connectionOver(
      bodies(CONFIGURATIONS('/only')),
    );

    await new AdtRequest(connection).list();

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('searchconfiguration');
    expect(calls[1].url).toContain('configUri=%2Fonly');
  });

  it('refuses to choose between several, naming them', async () => {
    const { connection } = connectionOver(bodies(CONFIGURATIONS('/a', '/b')));

    await expect(new AdtRequest(connection).list()).rejects.toThrow(
      /\/a.*\/b/s,
    );
  });

  it('names the endpoint when the system has no configuration', async () => {
    const { connection } = connectionOver(bodies(CONFIGURATIONS()));

    await expect(new AdtRequest(connection).list()).rejects.toThrow(
      /searchconfiguration\/configurations/,
    );
  });
});

describe('the batch guard', () => {
  const deferred = { responsesAreDeferred: true };

  it('lets an explicit configUri through and records one request', async () => {
    const { connection, calls } = connectionOver(
      bodies(CONFIGURATIONS('/a')),
      deferred,
    );

    await new AdtRequest(connection).list({ configUri: '/explicit' });

    expect(calls).toHaveLength(1);
  });

  it('refuses to resolve, rather than hanging, when no configUri is given', async () => {
    const { connection, calls } = connectionOver(
      bodies(CONFIGURATIONS('/a')),
      deferred,
    );

    const started = Date.now();
    await expect(new AdtRequest(connection).list()).rejects.toThrow(
      /configUri is required on a batch client/,
    );

    // A deadlock would surface as a timeout, which reads like a slow pass.
    expect(Date.now() - started).toBeLessThan(1000);
    expect(calls).toHaveLength(0);
  });
});
