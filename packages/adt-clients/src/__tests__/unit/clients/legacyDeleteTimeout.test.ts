/**
 * The caller's deadline reaches the legacy deletes too.
 *
 * The legacy overrides of `delete` (BASIS < 7.50) issue a direct DELETE of
 * their own instead of the modern deletion resource, and they handed the bare
 * connection to it — so `options.timeout`, which every other member puts on
 * its requests through `withCallTimeout`, was dropped there. With no deadline
 * of the library's, the caller's is the only one there is.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { headersOf } from '../../helpers/adtHeaders';

function recordingConnection() {
  const sent: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: IAbapRequestOptions) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', data: '', headers: {} };
    }),
  } as unknown as IAbapConnection;
  return { connection, sent };
}

type Deletable = {
  delete(
    config: unknown,
    options: { headers: IAdtHeaders; timeout?: number },
  ): Promise<unknown>;
};

const cases: Array<[string, (c: AdtClientLegacy) => Deletable, unknown]> = [
  ['class', (c) => c.getClass() as Deletable, { className: 'ZCL_X' }],
  ['ddl', (c) => c.getDdl() as Deletable, { ddlName: 'ZDDL_X' }],
  [
    'function group',
    (c) => c.getFunctionGroup() as Deletable,
    { functionGroupName: 'ZFG_X' },
  ],
  [
    'function module',
    (c) => c.getFunctionModule() as Deletable,
    { functionGroupName: 'ZFG_X', functionModuleName: 'Z_FM_X' },
  ],
  [
    'interface',
    (c) => c.getInterface() as Deletable,
    { interfaceName: 'ZIF_X' },
  ],
  ['program', (c) => c.getProgram() as Deletable, { programName: 'ZPROG_X' }],
];

describe("legacy delete carries the caller's timeout", () => {
  it.each(cases)('%s', async (_name, handler, config) => {
    const { connection, sent } = recordingConnection();
    const client = new AdtClientLegacy(connection);

    const deletable = handler(client);
    await deletable.delete(config, {
      headers: headersOf(deletable, 'delete'),
      timeout: 1234,
    });

    const deletes = sent.filter((r) => r.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(sent.map((r) => r.timeout)).toEqual(sent.map(() => 1234));
  });

  it.each(cases)(
    '%s sends no deadline without one',
    async (_name, handler, config) => {
      const { connection, sent } = recordingConnection();
      const client = new AdtClientLegacy(connection);

      const deletable = handler(client);
      await deletable.delete(config, {
        headers: headersOf(deletable, 'delete'),
      });

      expect(sent.map((r) => r.timeout)).toEqual(sent.map(() => 0));
    },
  );
});

describe('legacy delete sends the measured request', () => {
  const lockHandle = 'LH/1+2=';
  const encoded = encodeURIComponent(lockHandle);

  async function run(
    handler: (c: AdtClientLegacy) => Deletable,
    config: unknown,
    extra: { lockHandle?: string },
  ) {
    const { connection, sent } = recordingConnection();
    const client = new AdtClientLegacy(connection);
    const deletable = handler(client);
    await deletable.delete(config, {
      headers: headersOf(deletable, 'delete'),
      ...extra,
    } as { headers: IAdtHeaders });
    return { connection, sent };
  }

  it.each(cases)(
    '%s: one DELETE with the lock handle',
    async (_name, handler, config) => {
      const { connection, sent } = await run(handler, config, { lockHandle });
      expect(sent).toHaveLength(1);
      expect(sent[0]?.method).toBe('DELETE');
      const url = sent[0]?.url as string;
      expect(url.endsWith(`?lockHandle=${encoded}`)).toBe(true);
      expect(url).not.toContain('_action=');
      expect(connection.setSessionType).not.toHaveBeenCalled();
    },
  );

  it.each(cases)(
    '%s: the transport request travels as corrNr',
    async (_name, handler, config) => {
      const { sent } = await run(
        handler,
        { ...(config as object), transportRequest: 'TRK000001' },
        { lockHandle },
      );
      expect(sent).toHaveLength(1);
      expect(sent[0]?.method).toBe('DELETE');
      expect(
        sent[0]?.url?.endsWith(`?lockHandle=${encoded}&corrNr=TRK000001`),
      ).toBe(true);
    },
  );

  it.each(cases)(
    '%s: without a handle one DELETE and no lockHandle parameter',
    async (_name, handler, config) => {
      const { connection, sent } = await run(handler, config, {});
      expect(sent).toHaveLength(1);
      expect(sent[0]?.method).toBe('DELETE');
      expect(sent[0]?.url).not.toContain('lockHandle');
      expect(sent[0]?.url).not.toContain('_action=');
      expect(connection.setSessionType).not.toHaveBeenCalled();
    },
  );
});
