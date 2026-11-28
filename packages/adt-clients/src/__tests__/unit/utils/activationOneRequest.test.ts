/**
 * One member, one endpoint, one request (C7, 49.0.0): an activation member
 * sends `POST /sap/bc/adt/activation` and nothing else, whatever its
 * checklist says. After a checklist that does not state its outcome — a
 * silent one (`activationExecuted="false"`, no message) or one with no
 * `activationExecuted` and warnings alone — the inactive list is the
 * caller's to read (`getUtils().getInactiveObjects()`), and the member hands
 * its `analyse` the verdict and the answer, never a context.
 *
 * Until 48.0.0 every member read `GET /sap/bc/adt/activation/inactiveobjects`
 * after such a checklist: these cases are the oracle of the split.
 */
import { join } from 'node:path';
import type {
  AdtNoFailure,
  IAdtAnalyseContext,
  IAdtError,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { headersOf } from '../../helpers/adtHeaders';
import { readExchange } from '../../helpers/recordedConformance';
import { recordingClient } from '../capabilities/behaviourGuard';
import { ACTIVATING_APIS, activatingHandler } from '../core/activatingApis';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');

/** A recorded silent checklist (S/4HANA 2025, fr0ster/mcp-abap-adt#351). */
const SILENT = readExchange(
  ANSWERS,
  'activation-group-alone-s4-2025--04-activation.json',
).body;

/**
 * No `activationExecuted` and one `W` (fr0ster/mcp-abap-adt#360, SAP_BASIS
 * 7.52), built from the report, not recorded.
 */
const UNSTATED = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><msg objDescr="Program ZUNITTEST_MOCKUP_LOADER_EXMPL" type="W" line="1"/></chkl:messages>`;

/** An `analyse` that records the context it was handed, and clears nothing. */
function spying() {
  const seen: { context: IAdtAnalyseContext | undefined }[] = [];
  const analyse = (
    verdict: IAdtError | AdtNoFailure,
    _answer?: IAdtWireResponse,
    context?: IAdtAnalyseContext,
  ): IAdtError | AdtNoFailure => {
    seen.push({ context });
    return verdict;
  };
  return { analyse, seen };
}

const ACTIVATION = /^\/sap\/bc\/adt\/activation\?method=activate&/;

describe.each([
  ['a silent checklist', SILENT],
  ['a checklist with no verdict and warnings alone', UNSTATED],
])('after %s', (_what, body) => {
  it.each(ACTIVATING_APIS)(
    '%s.activate sends the activation POST alone, and hands analyse no context',
    async (api) => {
      const { analyse, seen } = spying();
      const { handler, config, calls } = activatingHandler(api, body);
      await handler.activate(config, {
        headers: headersOf(handler, 'activate', config),
        analyse,
      });

      expect(calls.map((c) => c.method)).toEqual(['POST']);
      expect(calls[0]?.url).toMatch(ACTIVATION);
      expect(seen).toHaveLength(1);
      expect(seen[0]?.context).toBeUndefined();
    },
  );

  it('activateObjects sends the activation POST alone, and hands analyse no context', async () => {
    const { analyse, seen } = spying();
    const { client, calls } = recordingClient(body);
    const utils = client.getUtils();
    await utils.activateObjects(
      [
        { name: 'ZCL_GUARD', type: 'CLAS/OC' },
        { name: 'ZIF_GUARD', type: 'INTF/OI' },
      ],
      true,
      { headers: headersOf(utils, 'activateObjects'), analyse },
    );

    expect(calls.map((c) => c.method)).toEqual(['POST']);
    expect(calls[0]?.url).toMatch(ACTIVATION);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('activateTestClasses sends the activation POST alone, and hands analyse no context', async () => {
    const { analyse, seen } = spying();
    const { client, calls } = recordingClient(body);
    await client
      .getClass()
      .activateTestClasses(
        { className: 'ZCL_GUARD', testClassName: 'LTCL_GUARD' },
        { analyse },
      );

    expect(calls.map((c) => c.method)).toEqual(['POST']);
    expect(calls[0]?.url).toMatch(ACTIVATION);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.context).toBeUndefined();
  });
});
