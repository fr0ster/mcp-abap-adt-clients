/**
 * A binding's LOCK read by `analysePublicationLock`, end to end through the
 * library: the `403` of a binding someone is editing becomes a lock with no
 * handle, so the caller publishes and has nothing to unlock. Without the
 * strategy the same answer is a refusal.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analysePublicationLock } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from '../../../../clients/AdtClient';

const HELD = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../../corpus/adt/refusal-lock-held-by-other--01-lock.body.xml',
  ),
  'utf8',
);

const connection = {
  setSessionType: () => {},
  isConnected: () => true,
  makeAdtRequest: async () => {
    throw {
      message: 'Request failed with status code 403',
      response: {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        data: HELD,
      },
    };
  },
} as unknown as IAbapConnection;

const logger = { info: () => {}, debug: () => {} } as unknown as ILogger;
const binding = () => new AdtClient(connection, logger).getServiceBinding();

describe('a binding lock someone is editing', () => {
  it('is a lock without a handle under analysePublicationLock', async () => {
    const answer = await binding().lock(
      { bindingName: 'ZSB_X' },
      { analyse: analysePublicationLock },
    );
    expect(answer.ok).toBe(true);
    expect(answer.ok && answer.getResult().value).toBe('');
  });

  it('is a refusal without it', async () => {
    const answer = await binding().lock({ bindingName: 'ZSB_X' });
    expect(answer.ok).toBe(false);
  });
});
