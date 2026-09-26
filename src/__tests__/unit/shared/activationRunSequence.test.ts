// The source path, not the package: the reading is new in adt-strategies and
// the package's built entry point does not carry it until it is released.
import { utilActivationRunId } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';

/**
 * Start, then status, then results — through the client a consumer holds.
 *
 * `activateObjectsGroup` used to poll `/activation/runs/{runId}` itself and
 * answer the results. The wait is the caller's now, so the whole sequence has
 * to be reachable from outside: the start must hand back the run id, and both
 * members that take one must be there. This asserts that end to end, because
 * each piece passing on its own would not have caught the id being discarded.
 *
 * The id is read by `utilActivationRunId` from adt-strategies, passed for the
 * `activation` slot — the default answers the POST as it came. The reading's
 * own cases moved there with it (`utilReadings.test.ts`).
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
  const utils = new AdtClient(connection).getUtils({
    ...utilDocuments,
    activation: utilActivationRunId,
  });

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

it('answers the POST as it came by default', async () => {
  const { connection } = recording();
  const started = await new AdtClient(connection)
    .getUtils()
    .activateObjectsGroup([{ name: 'ZCL_X', type: 'CLAS/OC' }]);
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error('expected the answer');
  // The body, which carries nothing — the id is in a header the default does
  // not read.
  expect(started.getResult().value).toBe('');
});
