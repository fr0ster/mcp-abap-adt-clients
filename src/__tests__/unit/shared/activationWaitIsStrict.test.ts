import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../index';
import {
  activateAndWait,
  activationStatusIn,
} from '../../helpers/activationRun';

/**
 * The wait ends on `finished`, and on nothing else.
 *
 * A helper that returned `error` as a normal outcome would let a test declare
 * success over a failed activation — quietly, and for as long as nobody read
 * the status it handed back. So the three endings are asserted here rather
 * than left to an integration run nobody watches.
 */
const RUN_ID = 'ACT0000000042';

const answering = (statuses: string[]): IAbapConnection => {
  let call = 0;
  return {
    makeAdtRequest: async (request: { url: string }) => {
      if (request.url.startsWith('/sap/bc/adt/activation/runs?')) {
        return {
          status: 202,
          headers: { location: `/sap/bc/adt/activation/runs/${RUN_ID}` },
          data: '',
        } as unknown as IAdtWireResponse;
      }
      if (request.url.includes('/activation/results/')) {
        return {
          status: 200,
          headers: {},
          data: '<chkl:messages/>',
        } as unknown as IAdtWireResponse;
      }
      const s = statuses[Math.min(call++, statuses.length - 1)];
      return {
        status: 200,
        headers: {},
        data: `<runs:run xmlns:runs="http://www.sap.com/adt/runs" runs:status="${s}"/>`,
      } as unknown as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
};

const objects = [{ name: 'ZCL_X', type: 'CLAS/OC' }];

it('polls past running and returns once the run finished', async () => {
  const client = new AdtClient(answering(['running', 'running', 'finished']));
  const outcome = await activateAndWait(client, objects);

  expect(outcome.status).toBe('finished');
  expect(outcome.runId).toBe(RUN_ID);
  expect(outcome.results).toContain('chkl:messages');
});

it.each(['error', 'failed'])('raises when the run ended as %s', async (s) => {
  const client = new AdtClient(answering([s]));
  await expect(activateAndWait(client, objects)).rejects.toThrow(
    new RegExp(`ended as ${s}`),
  );
});

it('raises rather than proceeding when no status was ever read', async () => {
  // A document this reading cannot read is a reason to keep asking, not to
  // move on — and at the deadline it is a failure, not an outcome.
  const client = new AdtClient(answering(['']));
  await expect(
    activateAndWait(client, objects, { deadlineMs: 50 }),
  ).rejects.toThrow(/had not finished at the deadline/);
});

it('reads the status whatever namespace prefix the server used', () => {
  expect(activationStatusIn('<r:run xmlns:r="x" r:status="finished"/>')).toBe(
    'finished',
  );
  expect(activationStatusIn('<run status="running"/>')).toBe('running');
  expect(activationStatusIn('<run/>')).toBe('');
});
