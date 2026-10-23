/**
 * 7.40 SP04 does not serve the package item resource (`GET` answered `404`),
 * so the members that address it refuse without a request.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtPackageLegacy } from '../../../../core/package/AdtPackageLegacy';
import { LockRegistry } from '../../../../core/shared/LockRegistry';
import { expectFailure } from '../../../helpers/contract';

const recordingConnection = () => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      throw new Error('a refusal must send nothing');
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('legacy package', () => {
  const config = { packageName: 'ZGUARD_PKG' };
  const cases: [string, (p: AdtPackageLegacy) => Promise<unknown>][] = [
    ['lock', (p) => p.lock(config)],
    ['unlock', (p) => p.unlock(config, 'HANDLE')],
    ['readTransport', (p) => p.readTransport(config)],
    [
      'check',
      (p) => p.check(config, 'inactive', { headers: {} as IAdtHeaders }),
    ],
    ['read', (p) => p.read()],
  ];

  it.each(cases)('%s refuses without a request', async (_member, call) => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      (await call(new AdtPackageLegacy(connection))) as Parameters<
        typeof expectFailure
      >[0],
      'legacy package',
    );

    expect(failure.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(failure.origin).toBe('refusal');
    expect(failure.message).toMatch(/legacy/);
    expect(calls).toHaveLength(0);
  });

  it('a refused lock tracks nothing, so unlockAll sends nothing', async () => {
    const { connection, calls } = recordingConnection();
    const registry = new LockRegistry(connection);
    const handler = new AdtPackageLegacy(
      connection,
      undefined,
      undefined,
      registry,
    );

    await handler.lock(config);

    expect(registry.pending).toEqual([]);
    expect(await registry.unlockAll()).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
