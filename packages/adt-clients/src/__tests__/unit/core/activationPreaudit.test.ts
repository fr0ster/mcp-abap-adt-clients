/**
 * `preauditRequested` on every single-object activation (spec D3): absent, a
 * member sends `true`, the value it sent before the option existed; given, it
 * sends what it was given.
 *
 * The members are taken from the ADT type tables of
 * `@mcp-abap-adt/interfaces-adt`: every API that a table serves `activate` on,
 * on premise or on the cloud (`activatingApis.ts`). A new API with `activate`
 * is a row here at once, and fails until the manifest can drive it.
 */
import { headersOf } from '../../helpers/adtHeaders';
import { recordingClient } from '../capabilities/behaviourGuard';
import { ACTIVATING_APIS, activatingHandler } from './activatingApis';

const ACTIVATION = '/sap/bc/adt/activation?method=activate&preauditRequested=';

async function sentBy(
  api: string,
  preauditRequested: boolean | undefined,
): Promise<string[]> {
  const { handler, config, calls } = activatingHandler(api);
  const headers = headersOf(handler, 'activate', config);
  await handler.activate(
    config,
    preauditRequested === undefined
      ? { headers }
      : { headers, preauditRequested },
  );
  return calls
    .filter((c) => c.method === 'POST' && c.url.startsWith(ACTIVATION))
    .map((c) => c.url);
}

describe('preauditRequested on every single-object activation', () => {
  it('finds the activating APIs of the type tables', () => {
    expect(ACTIVATING_APIS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ACTIVATING_APIS)('%s sends true when not asked', async (api) => {
    expect(await sentBy(api, undefined)).toEqual([`${ACTIVATION}true`]);
  });

  it.each(ACTIVATING_APIS)('%s sends false when asked', async (api) => {
    expect(await sentBy(api, false)).toEqual([`${ACTIVATION}false`]);
  });

  it.each(ACTIVATING_APIS)('%s sends true when asked', async (api) => {
    expect(await sentBy(api, true)).toEqual([`${ACTIVATION}true`]);
  });

  it.each([
    [undefined, 'true'],
    [false, 'false'],
  ])(
    'class.activateTestClasses with preauditRequested %s sends %s',
    async (preauditRequested, sent) => {
      const { client, calls } = recordingClient();
      await client
        .getClass()
        .activateTestClasses(
          { className: 'ZCL_GUARD', testClassName: 'LTCL_GUARD' },
          preauditRequested === undefined ? {} : { preauditRequested },
        );
      expect(calls.map((c) => c.url)).toEqual([`${ACTIVATION}${sent}`]);
    },
  );
});
