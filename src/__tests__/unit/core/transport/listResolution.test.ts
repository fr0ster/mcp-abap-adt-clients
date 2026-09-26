/**
 * `list` runs the saved search the caller names, and nothing else.
 *
 * Until interfaces-adt 11 a missing `configUri` made it read the
 * configurations, use the only one, and throw when there were none or several
 * (decision 37). That choice is the caller's now, and `searchConfigurations`
 * is how they make it — so what is asserted is the absence: one request, the
 * named search, no lookup of its own.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtRequest } from '../../../../core/transport/AdtRequest';
import { transportParsing } from '../../../helpers/transportParsing';

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

describe('list runs the named search', () => {
  it('sends exactly one request, carrying the configUri it was given', async () => {
    const { connection, calls } = connectionOver(bodies(CONFIGURATIONS('/a')));

    await new AdtRequest(connection).list({ configUri: '/explicit' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('configUri=%2Fexplicit');
    expect(calls[0].url).not.toContain('searchconfiguration/configurations');
  });

  it('what there is to choose from is its own member', async () => {
    const { connection, calls } = connectionOver(
      bodies(CONFIGURATIONS('/a', '/b')),
    );

    const answer = await new AdtRequest(
      connection,
      undefined,
      undefined,
      transportParsing,
    ).searchConfigurations();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('searchconfiguration/configurations');
    expect(answer.ok && answer.getResult().value.map((c) => c.uri)).toEqual([
      '/a',
      '/b',
    ]);
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
});
