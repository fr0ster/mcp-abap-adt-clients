/**
 * The shared harness's two seams (spec §1, "What stays in packages/adt-clients").
 *
 * The harness knows no system of its own: whoever needs another client or
 * another pair says so through a seam.
 * - Header pairs and refusals are registered per handler class; an
 *   unregistered class is not recognised.
 * - A session's client is built by a factory, the modern one by default, and
 *   its connection takes the on-premise HTTP wire the caller names, plain
 *   `http` by default.
 *
 * This file imports no system-specific helper, so what it registers is all
 * the harness knows here.
 */

import type { ConnectionSpec } from '@mcp-abap-adt/connection';
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { IAuthProvider } from '@mcp-abap-adt/interfaces-auth';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from '../../../clients/AdtClient';
import {
  headersOf,
  integrationHeadersOf,
  registerHeaderPairs,
  registerRefusedMembers,
  registerRefusingHandler,
  TEST_HEADERS,
} from '../../helpers/adtHeaders';
import {
  connectionSpec,
  createTestAdtClient,
  type TestClientFactory,
} from '../../helpers/sessionConfig';

const logger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const PROBE_PAIR: IAdtHeaders = {
  accept: 'application/x-seam-probe-accept',
  contentType: 'application/x-seam-probe-content-type',
};
const LEAF_PAIR: IAdtHeaders = {
  accept: 'application/x-seam-leaf-accept',
  contentType: 'application/x-seam-leaf-content-type',
};

class SeamProbeHandler {
  send(): void {}
}
class SeamInheritedBase {
  send(): void {}
}
class SeamInheritedLeaf extends SeamInheritedBase {}
class SeamUnregistered {
  send(): void {}
}
class SeamRefusing {
  refuse(): void {}
  send(): void {}
}
class SeamRefusingOverride extends SeamRefusing {
  override refuse(): void {}
}

describe('header pairs registered per handler class', () => {
  beforeAll(() => {
    registerHeaderPairs(SeamProbeHandler, { send: PROBE_PAIR });
    registerHeaderPairs(SeamInheritedLeaf, { send: LEAF_PAIR });
  });

  it('recognises a registered class: both lookups hand out its pair', () => {
    expect(integrationHeadersOf(new SeamProbeHandler(), 'send')).toBe(
      PROBE_PAIR,
    );
    expect(headersOf(new SeamProbeHandler(), 'send')).toBe(PROBE_PAIR);
  });

  it('gives a registered leaf its own pair for a member it inherits', () => {
    expect(integrationHeadersOf(new SeamInheritedLeaf(), 'send')).toBe(
      LEAF_PAIR,
    );
  });

  it('does not recognise an unregistered class, its registered subclass notwithstanding', () => {
    expect(() => integrationHeadersOf(new SeamInheritedBase(), 'send')).toThrow(
      'No Accept/Content-Type pair recorded for SeamInheritedBase.send',
    );
    expect(() => integrationHeadersOf(new SeamUnregistered(), 'send')).toThrow(
      'No Accept/Content-Type pair recorded for SeamUnregistered.send',
    );
    expect(headersOf(new SeamUnregistered(), 'send')).toBe(TEST_HEADERS);
  });

  it('refuses a registration that would change a recorded pair', () => {
    expect(() =>
      registerHeaderPairs(
        { name: 'AdtClass', prototype: {} },
        {
          delete: PROBE_PAIR,
        },
      ),
    ).toThrow('AdtClass.delete');
    expect(() =>
      registerHeaderPairs(SeamProbeHandler, { send: LEAF_PAIR }),
    ).toThrow('SeamProbeHandler.send');
    // The same pair again is the same registration.
    expect(() =>
      registerHeaderPairs(SeamProbeHandler, { send: PROBE_PAIR }),
    ).not.toThrow();
  });
});

describe('refusals registered per handler class', () => {
  beforeAll(() => {
    registerRefusedMembers(SeamRefusing, ['refuse']);
  });

  it('lets a registered refusal through without a pair', () => {
    expect(integrationHeadersOf(new SeamRefusing(), 'refuse')).toBe(
      TEST_HEADERS,
    );
  });

  it('does not let through another member, nor an override of the refusal', () => {
    expect(() => integrationHeadersOf(new SeamRefusing(), 'send')).toThrow(
      'SeamRefusing.send',
    );
    expect(() =>
      integrationHeadersOf(new SeamRefusingOverride(), 'refuse'),
    ).toThrow('SeamRefusingOverride.refuse');
  });

  it('recognises a plain-object handler only once a check is registered for it', () => {
    const handler = { objectType: 'SeamPlain', refuse: () => undefined };
    const other = { objectType: 'SeamPlain', refuse: () => undefined };
    expect(() => integrationHeadersOf(handler, 'refuse')).toThrow(
      'No Accept/Content-Type pair recorded for Object.refuse',
    );
    registerRefusingHandler(
      (candidate, member) => candidate === handler && member === 'refuse',
    );
    expect(integrationHeadersOf(handler, 'refuse')).toBe(TEST_HEADERS);
    expect(() => integrationHeadersOf(other, 'refuse')).toThrow(
      'Object.refuse',
    );
  });
});

/** A connection whose discovery answers as a modern system does. */
function modernConnection() {
  const makeAdtRequest = jest.fn(async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/atomsvc+xml' },
    data: '<app:service/>',
  }));
  return {
    connection: { makeAdtRequest } as unknown as IAbapConnection,
    makeAdtRequest,
  };
}

describe('the client factory', () => {
  it('builds the modern client by default, after the discovery read it always made', async () => {
    const { connection, makeAdtRequest } = modernConnection();
    const { client, isLegacy } = await createTestAdtClient(connection, logger);
    expect(Object.getPrototypeOf(client)).toBe(AdtClient.prototype);
    expect(isLegacy).toBe(false);
    expect(makeAdtRequest).toHaveBeenCalledTimes(1);
    expect(makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/sap/bc/adt/core/discovery' }),
    );
  });

  it('builds what an injected factory builds, with the same arguments, and sends nothing itself', async () => {
    const { connection, makeAdtRequest } = modernConnection();
    const options = { masterSystem: 'SEAM' };
    const built = {
      client: new AdtClient(connection, logger),
      isLegacy: false,
    };
    const factory: TestClientFactory = jest.fn(async () => built);
    const result = await createTestAdtClient(
      connection,
      logger,
      options,
      factory,
    );
    expect(result).toBe(built);
    expect(factory).toHaveBeenCalledWith(connection, logger, options);
    expect(makeAdtRequest).not.toHaveBeenCalled();
  });
});

describe('the connection spec', () => {
  const config = { url: 'https://seam.example', authType: 'basic' as const };
  const credential = {} as IAuthProvider;
  const base = { config, credential, logger, wireLogger: logger };

  it('keeps the modern on-premise HTTP session: plain http, agent options', () => {
    const spec = connectionSpec(config, 'onprem', credential, logger, {
      connectionType: 'http',
    });
    expect(spec).toEqual({
      ...base,
      system: 'onprem',
      transport: 'http',
      agentOptions: expect.any(Function),
    });
    expect((spec as { agentOptions: () => unknown }).agentOptions()).toEqual(
      {},
    );
  });

  it('keeps the cloud session: http, agent options', () => {
    const spec = connectionSpec(config, 'cloud', credential, logger, {
      connectionType: 'http',
    });
    expect(spec).toEqual({
      ...base,
      system: 'cloud',
      transport: 'http',
      agentOptions: expect.any(Function),
    });
  });

  it('keeps the RFC session: no agent options', () => {
    const spec: ConnectionSpec = connectionSpec(
      config,
      'onprem',
      credential,
      logger,
      { connectionType: 'rfc' },
    );
    expect(spec).toEqual({ ...base, system: 'onprem', transport: 'rfc' });
  });
});
