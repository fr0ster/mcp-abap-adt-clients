import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtClient, activationRunId, extractRunId } from '../../../index';

/**
 * Start, then status, then results — through the package entry point.
 *
 * `activateObjectsGroup` used to poll `/activation/runs/{runId}` itself and
 * answer the results. The wait is the caller's now, so the whole sequence has
 * to be reachable from outside: the start must hand back the run id, and both
 * members that take one must be there. This asserts that end to end, because
 * each piece passing on its own would not have caught the id being discarded.
 */
const RUN_ID = 'ACT0000000042';

const recording = () => {
  const urls: string[] = [];
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async (request: { url: string }) => {
      urls.push(request.url);

      if (request.url.startsWith('/sap/bc/adt/activation/runs?')) {
        return {
          status: 202,
          statusText: 'Accepted',
          headers: { location: `/sap/bc/adt/activation/runs/${RUN_ID}` },
          data: '',
        } as unknown as IAdtWireResponse;
      }

      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: `<runs:run xmlns:runs="http://www.sap.com/adt/runs" runs:status="finished"/>`,
      } as unknown as IAdtWireResponse;
    },
  };
  return { connection: connection as IAbapConnection, urls };
};

it('starts a run, reads its status, then its results', async () => {
  const { connection, urls } = recording();
  const utils = new AdtClient(connection).getUtils();

  const started = await utils.activateObjectsGroup([
    { name: 'ZCL_X', type: 'CLAS/OC' },
  ]);
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error('expected the run id');

  // The id, not the body: the body carries nothing and both members below
  // take an id.
  const runId = started.getResult().value;
  expect(runId).toBe(RUN_ID);

  const status = await utils.getActivationRun(runId, { withLongPolling: true });
  expect(status.ok).toBe(true);

  const results = await utils.getActivationResults(runId);
  expect(results.ok).toBe(true);

  expect(urls).toEqual([
    '/sap/bc/adt/activation/runs?method=activate&preauditRequested=false',
    `/sap/bc/adt/activation/runs/${RUN_ID}?withLongPolling=true`,
    `/sap/bc/adt/activation/results/${RUN_ID}`,
  ]);
});

it('exports the reading and the header helper a caller composes with', () => {
  // A caller who keeps the exchange with `wireItself` reads the id later.
  expect(
    activationRunId({
      headers: { location: `/sap/bc/adt/activation/runs/${RUN_ID}` },
    } as never),
  ).toBe(RUN_ID);

  expect(extractRunId(`/sap/bc/adt/activation/runs/${RUN_ID}`)).toBe(RUN_ID);

  // No header carried one: the reading says it found none rather than
  // inventing a verdict about the server.
  expect(activationRunId({ headers: {} } as never)).toBe('');
});
