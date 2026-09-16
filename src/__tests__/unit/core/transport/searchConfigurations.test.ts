/**
 * The saved searches, as a member a caller can reach.
 *
 * `list()` resolves one of these itself when it is given no `configUri`, and
 * that resolution is opinionated in two ways a caller could not previously do
 * anything about: its answer never reaches their `analyse`, and on a system
 * holding several it throws with advice ("pass configUri explicitly") they had
 * no supported way to follow. This member is the way.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtError,
  IAdtWireResponse,
  ITransportSearchConfiguration,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';
import { AdtRequest } from '../../../../core/transport/AdtRequest';
import { transportDocuments } from '../../../../core/transport/types';

const CONFIGURATIONS =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<configurations:configurations xmlns:configurations="http://www.sap.com/adt/configurations">' +
  '<configuration:configuration createdBy="CB9980008038" client="100" ' +
  'xmlns:configuration="http://www.sap.com/adt/configuration">' +
  '<atom:link href="/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B" ' +
  'etag="20260807095048" xmlns:atom="http://www.w3.org/2005/Atom"/>' +
  '</configuration:configuration>' +
  '</configurations:configurations>';

const connectionOver = (
  answer: (options: IAbapRequestOptions) => IAdtWireResponse | never,
) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return answer(options);
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

const answering = (body: string, status = 200) =>
  ({
    data: body,
    status,
    statusText: 'OK',
    headers: {},
  }) as unknown as IAdtWireResponse;

/**
 * Through `client.getRequest()`, which is the only way a consumer has one.
 *
 * The member existed on `AdtRequest` before this test did, and was invisible
 * from outside: `getRequest()` answers `IRequestContract`, an intersection of
 * capability types, and the new member was in none of them. The call below
 * ran at runtime and failed to compile — `TS2339: Property
 * 'searchConfigurations' does not exist on type 'IRequestContract<…>'` — which
 * is what the documented example would have done in a consumer's editor.
 *
 * This test is therefore two checks in one: the call works, and this file
 * compiles. Drop `IAdtTransportSearchable` from the contract and `ts-jest`
 * fails the suite before a single assertion runs.
 */
describe('the contract a consumer actually holds', () => {
  it('reaches searchConfigurations through client.getRequest()', async () => {
    const { connection, calls } = connectionOver(() =>
      answering(CONFIGURATIONS),
    );

    const answer = await new AdtClient(connection)
      .getRequest()
      .searchConfigurations();

    if (!answer.ok) throw new Error('expected the configurations');
    const configurations = answer.getResult()
      .value as ITransportSearchConfiguration[];
    expect(configurations).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations',
    );
  });
});

describe('AdtRequest.searchConfigurations', () => {
  it('asks the configurations endpoint once, with the type it answers', async () => {
    const { connection, calls } = connectionOver(() =>
      answering(CONFIGURATIONS),
    );

    const answer = await new AdtRequest(connection).searchConfigurations();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations',
    );
    // Any other Accept answers 406, measured.
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.configurations.v1+xml',
    );
    expect(answer.ok).toBe(true);
  });

  it('answers the configurations, addressable as configUri', async () => {
    const { connection } = connectionOver(() => answering(CONFIGURATIONS));

    const answer = await new AdtRequest(connection).searchConfigurations();
    if (!answer.ok) throw new Error('expected the configurations');
    const configurations = answer.getResult()
      .value as ITransportSearchConfiguration[];

    expect(configurations).toHaveLength(1);
    expect(configurations[0].uri).toBe(
      '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
    );
    expect(configurations[0].etag).toBe('20260807095048');
    expect(configurations[0].attributes.client).toBe('100');
  });

  it('the uri it answers is one list() takes, and costs one request there', async () => {
    // Matched on the path, not on a substring: the LIST url carries the
    // configuration's own uri in its query, percent-encoded, so
    // `includes('searchconfiguration')` answers true for both requests and
    // hands the tree parser a configurations document.
    const { connection, calls } = connectionOver((options) =>
      answering(
        options.url.startsWith(
          '/sap/bc/adt/cts/transportrequests/searchconfiguration',
        )
          ? CONFIGURATIONS
          : '<tm:root/>',
      ),
    );
    const request = new AdtRequest(connection);

    const answer = await request.searchConfigurations();
    if (!answer.ok) throw new Error('expected the configurations');
    const configurations = answer.getResult()
      .value as ITransportSearchConfiguration[];
    await request.list({ configUri: configurations[0].uri });

    // Two in total — the same two `list()` alone would have made, with the
    // first one now the caller's.
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain('configUri=');
    expect(calls[1].url).toContain('7E5B');
  });

  it("reads a refusal through the caller's analyse", async () => {
    const { connection } = connectionOver(() => {
      throw Object.assign(new Error('Request failed with status code 406'), {
        response: answering('<exc:exception/>', 406),
      });
    });

    const seen: unknown[] = [];
    const answer = await new AdtRequest(connection).searchConfigurations({
      analyse: (verdict, wire) => {
        seen.push(wire?.status);
        return verdict === ADT_NO_FAILURE
          ? ADT_NO_FAILURE
          : ({
              ...(verdict as IAdtError),
              message: 'the configurations endpoint refused',
            } as IAdtError);
      },
    });

    // The strategy saw the real answer, not a synthesised one.
    expect(seen).toEqual([406]);
    if (answer.ok) throw new Error('expected a refusal');
    expect(answer.getError().message).toBe(
      'the configurations endpoint refused',
    );
  });

  it('reads the answer the caller injected, where one was injected', async () => {
    const { connection } = connectionOver(() => answering(CONFIGURATIONS));

    const answer = await new AdtRequest(connection, undefined, undefined, {
      ...transportDocuments,
      searchConfigurations: (wire) =>
        `document of ${String(wire.data).length} bytes`,
    }).searchConfigurations();

    if (!answer.ok) throw new Error('expected the injected reading');
    expect(answer.getResult().value).toBe(
      `document of ${CONFIGURATIONS.length} bytes`,
    );
  });
});
