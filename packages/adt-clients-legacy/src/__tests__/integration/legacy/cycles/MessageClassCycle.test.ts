/**
 * The message class and message cycle on SAP_BASIS 7.40 SP04 over RFC
 * (spec §4).
 *
 * Class: validate (name free) → create → lock → unlock → readMetadata →
 * `updateMetadata` refused. Message 001: create → read → update → read →
 * delete → read (absent). Class: lock → delete (one `DELETE` under the
 * caller's lock, spec §2) → unlock → readMetadata answers an empty `200`.
 * Every step asserts the requests it sent, their statuses and its effect read
 * back; the record of each answer is B4-cycles-20261026-2019 (r2-m0–r2-m12,
 * r3-msag-validate).
 *
 * A message is written through its class's document: each write is the
 * complete sequence read of the class, `LOCK_MSG`, a class `LOCK` with
 * `msgNo`, the `PUT`, the `UNLOCK` and `UNLOCK_ALL`; the PUT and the UNLOCK
 * carry the handle that class `LOCK` answered (read off a recorder that keeps
 * the answers). A message class that
 * does not exist reads `200` with an empty body, not `404` (B4 r2-m0,
 * r2-m12-read404): the absence before the create and after the delete is
 * that empty `200`.
 *
 * The class is created by this run in `$TMP` (no transport) and deleted by
 * it — by its last steps, or by the cleanup when a step failed; nothing this
 * run did not create is touched.
 *
 * Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_cycle_message_class` enabled:
 * npm run test:live -- integration/legacy/cycles/MessageClassCycle
 */

import {
  analyseDeletion,
  analyseException,
  analyseMessageClassMessage,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IMessageClassConfig,
  IMessageClassMessageConfig,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
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
  type SentStep,
} from '../../../helpers/legacyCycle';
import { requireOwnNames } from '../../../helpers/legacyEnv';
import {
  closeLegacySession,
  type LegacySession,
  LOCAL_PACKAGE,
  legacyClientsOn,
  openLegacySession,
  param,
  queryOf,
  withLegacyCase,
} from '../../../helpers/legacyLive';
import { describeLegacyRfc } from '../../../helpers/legacyRfc';

const CASE = 'legacy_cycle_message_class';
const DESCRIPTION = 'legacy live cycle: message class';
const MSGNO = '001';
const FIRST_TEXT = 'Legacy live cycle message';
const SECOND_TEXT = 'Legacy live cycle message, updated';

/** The `LOCK_HANDLE` of a lock answer's body; `''` when it carries none. */
function lockHandleIn(body: unknown): string {
  const text = typeof body === 'string' ? body : '';
  const open = text.indexOf('<LOCK_HANDLE>');
  const close = text.indexOf('</LOCK_HANDLE>');
  return open < 0 || close < open ? '' : text.slice(open + 13, close);
}

describeLegacyRfc(
  'Legacy 7.40 SP04 over RFC — message class and message cycle',
  () => {
    withLegacyCase(CASE, (params) => {
      let opened: LegacySession | undefined;
      /** The same connection, behind a recorder that keeps each answer's body. */
      let session: LegacySession | undefined;

      beforeAll(async () => {
        opened = await openLegacySession();
        session = await legacyClientsOn(opened.connection, {
          keepAnswers: true,
        });
      }, 120000);

      afterAll(async () => {
        await closeLegacySession(opened);
      });

      it('creates a message class, writes, reads and deletes message 001, and deletes the class', async () => {
        const { client, recorder } = session as LegacySession;
        const name = param(params, 'message_class_name');
        requireOwnNames(CASE, [['message class', name]]);
        const config: IMessageClassConfig = { name };
        const uri = `/sap/bc/adt/messageclass/${name.toLowerCase()}`;
        const messageUri = `${uri}/messages/${MSGNO}`;
        const msag = cycleObject({
          caseName: CASE,
          label: 'message class',
          name,
          config,
          handler: () => client.getMessageClass(),
          validateConfig: { ...config, description: DESCRIPTION },
        });
        const messages = () => client.getMessageClassMessage();
        const message = (msgtext?: string): IMessageClassMessageConfig =>
          msgtext === undefined
            ? { className: name, msgno: MSGNO }
            : { className: name, msgno: MSGNO, msgtext };
        /** A message write: the class read, the two locks, the PUT, the two unlocks. */
        const messageWrite: readonly SentStep[] = [
          [`GET ${uri}`, 200],
          [`POST ${messageUri} LOCK_MSG`, 200],
          [`POST ${uri} LOCK`, 200],
          [`PUT ${uri}`, 200],
          [`POST ${uri} UNLOCK`, 200],
          [`POST ${messageUri} UNLOCK_ALL`, 200],
        ];
        const at = () => recorder.requests.length;
        /**
         * A message write, every request asserted: the six requests, the
         * class `LOCK` for this message (`accessMode=MODIFY`, `msgNo=001`,
         * `onSave=X`, B4 r2-m5/m7/m9), and the PUT and the UNLOCK carrying the
         * handle that LOCK answered.
         */
        const expectMessageWrite = (mark: number) => {
          const [, lockMessage, lockClass, put, unlock] = expectSent(
            recorder,
            mark,
            messageWrite,
          );
          expect(queryOf(lockMessage, 'accessMode')).toBe('MODIFY');
          expect(queryOf(lockClass, 'accessMode')).toBe('MODIFY');
          expect(queryOf(lockClass, 'msgNo')).toBe(MSGNO);
          expect(queryOf(lockClass, 'onSave')).toBe('X');
          const handle = lockHandleIn(lockClass?.answer);
          expect(handle).not.toBe('');
          expect(queryOf(put, 'lockHandle') === handle).toBe(true);
          expect(queryOf(unlock, 'lockHandle') === handle).toBe(true);
        };

        await runCycle(CASE, [msag], async () => {
          let mark = at();
          await msag.requireFree();
          // B4 r3-msag-validate (200, a free name), r2-m0-readMetadata (an
          // absent class: 200, empty).
          expectSent(recorder, mark, [
            ['POST /sap/bc/adt/messageclass/validation', 200],
            [`GET ${uri}`, 200],
          ]);

          mark = at();
          expectResult(
            await msag.createOwned(() =>
              msag.handler.create(
                { name, packageName: LOCAL_PACKAGE, description: DESCRIPTION },
                {
                  headers: integrationHeadersOf(msag.handler, 'create'),
                  analyse: analyseException,
                },
              ),
            ),
            'create message class',
          );
          // B4 r2-m1-create: 201.
          expectSent(recorder, mark, [['POST /sap/bc/adt/messageclass', 201]]);

          mark = at();
          expectResult(await msag.lock(), 'lock message class');
          expectResult(await msag.unlock(), 'unlock message class');
          // B4 r2-m2-lock, r2-m2-unlock.
          expectSent(recorder, mark, [
            [`POST ${uri} LOCK`, 200],
            [`POST ${uri} UNLOCK`, 200],
          ]);

          mark = at();
          const metadata = expectResult(
            await msag.handler.readMetadata(config, {
              analyse: analyseException,
            }),
            'readMetadata message class',
          );
          // B4 r2-m3-readMetadata.
          expectSent(recorder, mark, [[`GET ${uri}`, 200]]);
          expect(String(metadata).toUpperCase()).toContain(`"${name}"`);

          mark = at();
          // B4 r2-m2-updateMetadata: 400 ExceptionInvalidData — refused,
          // nothing sent.
          expectRefusedUnsent(
            await msag.handler.updateMetadata(
              { ...config, description: `${DESCRIPTION}, changed` },
              {
                headers: integrationHeadersOf(msag.handler, 'updateMetadata'),
                analyse: analyseException,
              },
            ),
            recorder,
            mark,
          );

          const readMessage = async (what: string) => {
            const before = at();
            const answer = await messages().read(message(), undefined, {
              analyse: judged(analyseMessageClassMessage(MSGNO)),
            });
            expectSent(recorder, before, [[`GET ${uri}`, 200]]);
            return { answer, what };
          };

          mark = at();
          expectResult(
            await messages().create(message(FIRST_TEXT), {
              headers: integrationHeadersOf(messages(), 'create'),
              analyse: analyseException,
            }),
            'create message 001',
          );
          // B4 r2-m5-msg-create.
          expectMessageWrite(mark);

          let read = await readMessage('read message 001');
          // B4 r2-m6-msg-read.
          expect(String(expectResult(read.answer, read.what))).toContain(
            FIRST_TEXT,
          );

          mark = at();
          expectResult(
            await messages().update(message(SECOND_TEXT), {
              headers: integrationHeadersOf(messages(), 'update'),
              analyse: analyseException,
            }),
            'update message 001',
          );
          // B4 r2-m7-msg-update.
          expectMessageWrite(mark);

          read = await readMessage('read message 001 after the update');
          // B4 r2-m8-msg-read.
          expect(String(expectResult(read.answer, read.what))).toContain(
            SECOND_TEXT,
          );

          mark = at();
          expectResult(
            await messages().delete(message(), {
              headers: integrationHeadersOf(messages(), 'delete'),
              analyse: analyseException,
            }),
            'delete message 001',
          );
          // B4 r2-m9-msg-delete.
          expectMessageWrite(mark);

          read = await readMessage('read message 001 after the delete');
          // B4 r2-m10-msg-read: 200, the class document without message 001,
          // which analyseMessageClassMessage answers as the message absent
          // (the strategy's reading of the 7.40 document: Task 6).
          const absent = expectFailure(read.answer, read.what);
          expect(absent.code).toBe(AdtObjectErrorCodes.OBJECT_NOT_FOUND);
          expect(absent.message).toContain(
            `Message ${MSGNO} not found in class`,
          );

          mark = at();
          expectResult(await msag.lock(), 'lock message class for delete');
          const handle = msag.handle();
          expectResult(
            await msag.handler.delete(config, {
              headers: integrationHeadersOf(msag.handler, 'delete'),
              lockHandle: handle,
              analyse: judged(analyseDeletion),
            }),
            'delete message class',
          );
          expectResult(
            await msag.unlock(),
            'unlock message class after delete',
          );
          // B4 r2-m12-rawdel-lock, r2-m12-rawDELETE (the library's delete
          // sends that request since Task 2), r2-m12-rawdel-unlock.
          const [, deleted] = expectSent(recorder, mark, [
            [`POST ${uri} LOCK`, 200],
            [`DELETE ${uri}`, 200],
            [`POST ${uri} UNLOCK`, 200],
          ]);
          expect(queryOf(deleted, 'lockHandle') === handle).toBe(true);

          mark = at();
          const after = expectResult(
            await msag.handler.readMetadata(config, {
              analyse: analyseException,
            }),
            'readMetadata after delete',
          );
          // B4 r2-m12-read404: 200 with an empty body, as measured.
          expectSent(recorder, mark, [[`GET ${uri}`, 200]]);
          expect(String(after ?? '').trim()).toBe('');
        });
      }, 900000);
    });
  },
);
