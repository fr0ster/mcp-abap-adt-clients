/**
 * The legacy side of the harness's seams (spec §1): `legacyRegistrations.ts`
 * brings the legacy pairs, refusals and session to a harness that knows none
 * of them, and a legacy session built through the seams is the one the harness
 * built before.
 */

import { AdtContentTypesBase } from '@mcp-abap-adt/adt-clients';
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { IAuthProvider } from '@mcp-abap-adt/interfaces-auth';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  connectionSpec,
  createTestAdtClient,
} from '../../../../../adt-clients/src/__tests__/helpers/sessionConfig';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import {
  legacyClientFactory,
  legacyConnectionOptions,
} from '../../helpers/legacyRegistrations';

const logger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** A connection that fails any request: nothing here may send one. */
function silentConnection() {
  const makeAdtRequest = jest.fn(async () => {
    throw new Error('no request expected');
  });
  return {
    connection: { makeAdtRequest } as unknown as IAbapConnection,
    makeAdtRequest,
  };
}

type Harness = {
  integrationHeadersOf: (
    handler: object,
    member: string,
    config?: object,
  ) => IAdtHeaders;
  TEST_HEADERS: IAdtHeaders;
};
type Legacy = { AdtClientLegacy: typeof AdtClientLegacy };

/**
 * The harness and the legacy client in a module registry of their own, with
 * or without the registrations loaded.
 */
function isolated(withRegistrations: boolean): Harness & Legacy {
  let loaded: (Harness & Legacy) | undefined;
  jest.isolateModules(() => {
    if (withRegistrations) require('../../helpers/legacyRegistrations');
    loaded = {
      ...(require('../../../../../adt-clients/src/__tests__/helpers/adtHeaders') as Harness),
      ...(require('../../../clients/AdtClientLegacy') as Legacy),
    };
  });
  if (!loaded) throw new Error('isolateModules did not run');
  return loaded;
}

describe('the legacy registrations', () => {
  const XML = { accept: 'application/xml', contentType: 'application/xml' };

  it.each([false, true])(
    'the harness knows the legacy pairs and refusals only once they are registered (registered: %s)',
    (withRegistrations) => {
      const {
        integrationHeadersOf,
        TEST_HEADERS,
        AdtClientLegacy: Client,
      } = isolated(withRegistrations);
      const client = new Client(silentConnection().connection, logger);
      const pair = () => integrationHeadersOf(client.getClass(), 'delete');
      // @ts-expect-error -- 7.40 does not serve package; the refusal is for a caller outside the type system
      const refusal = () => integrationHeadersOf(client.getPackage(), 'create');
      // @ts-expect-error -- 7.40 does not serve domain; the refusal is for a caller outside the type system
      const absent = () => integrationHeadersOf(client.getDomain(), 'create');
      if (withRegistrations) {
        expect(pair()).toEqual(XML);
        expect(refusal()).toBe(TEST_HEADERS);
        expect(absent()).toBe(TEST_HEADERS);
      } else {
        expect(pair).toThrow('AdtClassLegacy.delete');
        expect(refusal).toThrow('AdtPackageLegacy.create');
        expect(absent).toThrow('Object.create');
      }
    },
  );
});

describe('a legacy session through the seams', () => {
  it('builds the legacy client the harness built before, with the options given, and sends nothing', async () => {
    const { connection, makeAdtRequest } = silentConnection();
    const options = { contentTypes: new AdtContentTypesBase(false) };
    const { client } = await createTestAdtClient(
      connection,
      logger,
      options,
      legacyClientFactory,
    );
    expect(Object.getPrototypeOf(client)).toBe(AdtClientLegacy.prototype);
    expect((client as unknown as { contentTypes?: unknown }).contentTypes).toBe(
      options.contentTypes,
    );
    expect(makeAdtRequest).not.toHaveBeenCalled();
  });

  it('names the legacy HTTP wire for a legacy configuration, plain http otherwise', () => {
    expect(legacyConnectionOptions(() => true)).toEqual({
      onPremHttpTransport: 'legacy-http',
    });
    expect(legacyConnectionOptions(() => false)).toEqual({
      onPremHttpTransport: 'http',
    });
  });

  it('gives a legacy configuration the wire it had: legacy-http on premise over HTTP, rfc and cloud as they were', () => {
    const config = { url: 'https://seam.example', authType: 'basic' as const };
    const credential = {} as IAuthProvider;
    const { onPremHttpTransport } = legacyConnectionOptions(() => true);
    const base = { config, credential, logger, wireLogger: logger };
    expect(
      connectionSpec(config, 'onprem', credential, logger, {
        connectionType: 'http',
        onPremHttpTransport,
      }),
    ).toEqual({
      ...base,
      system: 'onprem',
      transport: 'legacy-http',
      agentOptions: expect.any(Function),
    });
    expect(
      connectionSpec(config, 'onprem', credential, logger, {
        connectionType: 'rfc',
        onPremHttpTransport,
      }),
    ).toEqual({ ...base, system: 'onprem', transport: 'rfc' });
    expect(
      connectionSpec(config, 'cloud', credential, logger, {
        connectionType: 'http',
        onPremHttpTransport,
      }),
    ).toEqual({
      ...base,
      system: 'cloud',
      transport: 'http',
      agentOptions: expect.any(Function),
    });
  });
});
