/**
 * `activateObjects` (fr0ster/mcp-abap-adt#351): one `POST /sap/bc/adt/activation` with the
 * body `activateObjectsGroup` sends to `/activation/runs`, `preauditRequested`
 * `false` unless asked, read by the `objectActivation` slot. Which of the two
 * endpoints a system offers is in its discovery; the caller picks the member.
 */
import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { headersOf } from '../../helpers/adtHeaders';
import { CriticalSectionConnection } from '../../helpers/recordingConnection';

const OBJECTS = [
  { type: 'CLAS/OC', name: 'ZCL_GUARD' },
  { type: 'FUGR/FF', name: 'Z_FM_GUARD', parentName: 'ZFG_GUARD' },
  { type: 'DDLS/DF', name: 'ZDDL_GUARD' },
] as const;

function recording(
  body = '',
  slots: Partial<
    Record<'objectActivation' | 'activation', IResultStrategy<unknown>>
  > = {},
) {
  const connection = new CriticalSectionConnection(() => body);
  const utils = new AdtUtils(connection, {
    logger: noopLogger,
    results: { ...utilDocuments, ...slots },
  });
  return { connection, utils };
}

describe('activateObjects', () => {
  it('sends one POST to /activation, preauditRequested=false by default', async () => {
    const { connection, utils } = recording();
    await utils.activateObjects([...OBJECTS], undefined, {
      headers: headersOf(utils, 'activateObjects'),
    });
    expect(connection.sent.map((r) => [r.method, r.url])).toEqual([
      [
        'POST',
        '/sap/bc/adt/activation?method=activate&preauditRequested=false',
      ],
    ]);
  });

  it('sends preauditRequested=true when asked', async () => {
    const { connection, utils } = recording();
    await utils.activateObjects([...OBJECTS], true, {
      headers: headersOf(utils, 'activateObjects'),
    });
    expect(connection.sent[0]?.url).toBe(
      '/sap/bc/adt/activation?method=activate&preauditRequested=true',
    );
  });

  it('sends the body activateObjectsGroup sends, references with uri, type and name', async () => {
    const group = recording();
    await group.utils.activateObjectsGroup([...OBJECTS], undefined, {
      headers: headersOf(group.utils, 'activateObjectsGroup'),
    });
    const objects = recording();
    await objects.utils.activateObjects([...OBJECTS], undefined, {
      headers: headersOf(objects.utils, 'activateObjects'),
    });

    expect(group.connection.sent[0]?.url).toBe(
      '/sap/bc/adt/activation/runs?method=activate&preauditRequested=false',
    );
    expect(objects.connection.sent[0]?.data).toBe(
      group.connection.sent[0]?.data,
    );
    expect(String(objects.connection.sent[0]?.data)).toContain(
      'adtcore:uri="/sap/bc/adt/functions/groups/zfg_guard/fmodules/z_fm_guard" adtcore:type="FUGR/FF" adtcore:name="Z_FM_GUARD"',
    );
  });

  it('sends the caller headers', async () => {
    const { connection, utils } = recording();
    await utils.activateObjects([...OBJECTS], undefined, {
      headers: { accept: 'application/x-a', contentType: 'application/x-c' },
    });
    expect(connection.sent[0]?.headers).toEqual({
      Accept: 'application/x-a',
      'Content-Type': 'application/x-c',
    });
  });

  it('is read by the objectActivation slot, not the run slot', async () => {
    const { utils } = recording('<x/>', {
      objectActivation: () => 'objectActivation',
      activation: () => 'activation',
    });
    const answer = await utils.activateObjects([...OBJECTS], undefined, {
      headers: headersOf(utils, 'activateObjects'),
    });
    expect(answer.ok && answer.getResult().value).toBe('objectActivation');
  });

  it('reads the inactive list once after a silent checklist', async () => {
    const silent =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="false"/></chkl:messages>';
    const { connection, utils } = recording(silent);
    let named: readonly string[] | undefined;
    await utils.activateObjects([...OBJECTS], undefined, {
      headers: headersOf(utils, 'activateObjects'),
      analyse: (verdict, _answer, context) => {
        named = context?.activation?.named;
        return verdict;
      },
    });
    expect(connection.events).toEqual([
      'POST /sap/bc/adt/activation?method=activate&preauditRequested=false',
      'GET /sap/bc/adt/activation/inactiveobjects',
    ]);
    expect(named).toEqual([
      '/sap/bc/adt/oo/classes/zcl_guard',
      '/sap/bc/adt/functions/groups/zfg_guard/fmodules/z_fm_guard',
      '/sap/bc/adt/ddic/ddl/sources/zddl_guard',
    ]);
  });

  it('refuses a code the tables do not activate, without a request', async () => {
    const { connection, utils } = recording();
    await expect(
      utils.activateObjects(
        // @ts-expect-error -- the tables list no activate for MSAG/N
        [{ name: 'ZGUARD', type: 'MSAG/N' }],
        false,
        { headers: headersOf(utils, 'activateObjects') },
      ),
    ).rejects.toThrow(/list no activate/);
    expect(connection.sent).toEqual([]);
  });
});
