/**
 * The interface cycle on SAP_BASIS 7.40 SP04 over RFC (spec §4).
 *
 * validate (name free) → create → lock → update → unlock → activate → read →
 * readMetadata → check → getVersions → getVersionSource → `readTransport`
 * refused → lock → delete → unlock → read `404`. Every step asserts the
 * requests it sent, their statuses and its effect read back; the record of
 * each answer is B4-cycles-20261026-2019 (i0–i10, r3-intf-validate).
 *
 * The interface is created by this run in `$TMP` (no transport) and deleted
 * by it — by its last steps, or by the cleanup when a step failed; nothing
 * this run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_interface` enabled:
 * npm run test:live -- integration/legacy/cycles/InterfaceCycle
 */

import { interfaceDocuments } from '@mcp-abap-adt/adt-clients';
import {
  analyseActivation,
  analyseCheck,
  analyseDeletion,
  analyseException,
  objectVersions,
} from '@mcp-abap-adt/adt-strategies';
import type { IInterfaceConfig } from '@mcp-abap-adt/interfaces-adt';
import { integrationHeadersOf } from '../../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  expectFailure,
  expectResult,
} from '../../../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../../../adt-clients/src/__tests__/helpers/judged';
import {
  cycleObject,
  expectRefusedUnsent,
  expectSent,
  runCycle,
} from '../../../helpers/legacyCycle';
import { requireOwnNames } from '../../../helpers/legacyEnv';
import {
  closeLegacySession,
  type LegacySession,
  LOCAL_PACKAGE,
  openLegacySession,
  param,
  queryOf,
  withLegacyCase,
} from '../../../helpers/legacyLive';
import { describeLegacyRfc } from '../../../helpers/legacyRfc';

const CASE = 'legacy_cycle_interface';
const DESCRIPTION = 'legacy live cycle: interface';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — interface cycle', () => {
  withLegacyCase(CASE, (params) => {
    let session: LegacySession | undefined;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it('creates, writes, activates, reads, checks, lists versions and deletes an interface', async () => {
      const { client, recorder } = session as LegacySession;
      const name = param(params, 'interface_name');
      requireOwnNames(CASE, [['interface', name]]);
      const config: IInterfaceConfig = { interfaceName: name };
      const uri = `/sap/bc/adt/oo/interfaces/${name.toLowerCase()}`;
      const source = `INTERFACE ${name.toLowerCase()} PUBLIC.\n  METHODS run.\nENDINTERFACE.`;
      const intf = cycleObject({
        caseName: CASE,
        label: 'interface',
        name,
        config,
        handler: () => client.getInterface(),
        validateConfig: {
          ...config,
          packageName: LOCAL_PACKAGE,
          description: DESCRIPTION,
        },
      });
      const at = () => recorder.requests.length;

      await runCycle(CASE, [intf], async () => {
        let mark = at();
        await intf.requireFree();
        // B4 r3-intf-validate (200, a free name), i0-absent (404).
        expectSent(recorder, mark, [
          ['POST /sap/bc/adt/oo/validation/objectname', 200],
          [`GET ${uri}`, 404],
        ]);

        mark = at();
        intf.markCreated();
        expectResult(
          await intf.handler.create(
            {
              interfaceName: name,
              packageName: LOCAL_PACKAGE,
              description: DESCRIPTION,
            },
            {
              headers: integrationHeadersOf(intf.handler, 'create'),
              analyse: analyseException,
            },
          ),
          'create',
        );
        // B4 i1-create: 201.
        expectSent(recorder, mark, [['POST /sap/bc/adt/oo/interfaces', 201]]);

        mark = at();
        expectResult(await intf.lock(), 'lock');
        // B4 i2-lock.
        expectSent(recorder, mark, [[`POST ${uri} LOCK`, 200]]);

        mark = at();
        expectResult(
          await intf.handler.update(config, {
            headers: integrationHeadersOf(intf.handler, 'update'),
            lockHandle: intf.handle(),
            source,
            analyse: analyseException,
          }),
          'update',
        );
        // B4 i2-update.
        const [put] = expectSent(recorder, mark, [
          [`PUT ${uri}/source/main`, 200],
        ]);
        expect(queryOf(put, 'lockHandle')).toBe(intf.handle());

        mark = at();
        expectResult(await intf.unlock(), 'unlock');
        // B4 i2-unlock.
        expectSent(recorder, mark, [[`POST ${uri} UNLOCK`, 200]]);

        mark = at();
        expectResult(
          await intf.handler.activate(config, {
            headers: integrationHeadersOf(intf.handler, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        // B4 i3-activate.
        expectSent(recorder, mark, [['POST /sap/bc/adt/activation', 200]]);

        mark = at();
        const read = expectResult(
          await intf.handler.read(config, 'active', {
            analyse: analyseException,
          }),
          'read active',
        );
        // B4 i4-read.
        const [get] = expectSent(recorder, mark, [
          [`GET ${uri}/source/main`, 200],
        ]);
        expect(queryOf(get, 'version')).toBe('active');
        expect(String(read)).toContain('METHODS run.');

        mark = at();
        const metadata = expectResult(
          await intf.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'readMetadata',
        );
        // B4 i5-readMetadata.
        expectSent(recorder, mark, [[`GET ${uri}`, 200]]);
        expect(String(metadata).toUpperCase()).toContain(`"${name}"`);

        mark = at();
        expectResult(
          await intf.handler.check(config, 'active', {
            headers: integrationHeadersOf(intf.handler, 'check'),
            analyse: judged(analyseCheck),
          }),
          'check',
        );
        // B4 i6-check.
        expectSent(recorder, mark, [['POST /sap/bc/adt/checkruns', 200]]);

        const versioned = client.getInterface({
          ...interfaceDocuments,
          versions: objectVersions,
        });
        mark = at();
        const versions = expectResult(
          await versioned.getVersions(config, { analyse: analyseException }),
          'getVersions',
        );
        // B4 i7-getVersions.
        expectSent(recorder, mark, [[`GET ${uri}/source/main/versions`, 200]]);
        expect(versions.length).toBeGreaterThan(0);
        const contentUri = versions[0]?.contentUri ?? '';
        expect(contentUri).toContain(`${uri}/source/main/versions/`);

        mark = at();
        const versionSource = expectResult(
          await versioned.getVersionSource(contentUri, {
            analyse: analyseException,
          }),
          'getVersionSource',
        );
        // B4 i7b-getVersionSource.
        expectSent(recorder, mark, [[`GET ${contentUri.split('?')[0]}`, 200]]);
        expect(String(versionSource).toUpperCase()).toContain('INTERFACE');

        mark = at();
        // B4 i9-readTransport: 404 for every type — refused, nothing sent.
        expectRefusedUnsent(
          await intf.handler.readTransport(config, {
            analyse: analyseException,
          }),
          recorder,
          mark,
        );

        mark = at();
        expectResult(await intf.lock(), 'lock for delete');
        const handle = intf.handle();
        expectResult(
          await intf.handler.delete(config, {
            headers: integrationHeadersOf(intf.handler, 'delete'),
            lockHandle: intf.handle(),
            analyse: judged(analyseDeletion),
          }),
          'delete',
        );
        expectResult(await intf.unlock(), 'unlock after delete');
        // B4 i10-del-lock, i10-delete, i10-del-unlock.
        const [, deleted] = expectSent(recorder, mark, [
          [`POST ${uri} LOCK`, 200],
          [`DELETE ${uri}`, 200],
          [`POST ${uri} UNLOCK`, 200],
        ]);
        expect(queryOf(deleted, 'lockHandle')).toBe(handle);

        mark = at();
        const gone = expectFailure(
          await intf.handler.readMetadata(config, {
            analyse: analyseException,
          }),
          'read after delete',
        );
        // B4 i10-read404.
        expect(gone.response?.status).toBe(404);
        expectSent(recorder, mark, [[`GET ${uri}`, 404]]);
      });
    }, 900000);
  });
});
