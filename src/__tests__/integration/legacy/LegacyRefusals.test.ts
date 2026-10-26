/**
 * What the legacy client refuses sends nothing — on a real 7.40 SP04
 * connection over RFC (spec §11.2).
 *
 * Every row of `LEGACY_REFUSED` (`helpers/legacyMembers.ts`) is called on the
 * handler the legacy client or executor hands out — `checkDeletion` on every
 * type, the `absentOnLegacy` handlers, the transport, package, utility, runner
 * and executor refusals, and each refused type of `readObjectMetadata` /
 * `readObjectSource` — and must answer the refusal (`origin: 'refusal'`,
 * `UNSUPPORTED_OPERATION`) with nothing on the recorder: no request, no session
 * type. Those calls go through a recorder in deny mode, on a client of their
 * own: a request is recorded and refused there, never forwarded, so a member
 * that regressed into sending fails here without reaching the system. The
 * cases of those two members that send (program, class, in each spelling)
 * are read for real objects, on a forwarding recorder, and answer `200`.
 *
 * Nothing is created: the class and program read are the fixtures `npm run
 * legacy:setup` creates. Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_refusals_send_nothing` enabled:
 * npm run test:detached -- integration/legacy/LegacyRefusals
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import {
  AdtObjectErrorCodes,
  type AdtObjectType,
  type AdtSourceObjectType,
} from '@mcp-abap-adt/interfaces-adt';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { expectResult } from '../../helpers/contract';
import {
  closeLegacySession,
  type LegacySession,
  legacyClientsOn,
  lineOf,
  openLegacySession,
  param,
  sentSince,
  withLegacyCase,
} from '../../helpers/legacyLive';
import {
  ARGUMENT_DEPENDENT,
  LEGACY_REFUSED,
} from '../../helpers/legacyMembers';
import { describeLegacyRfc } from '../../helpers/legacyRfc';

/** The handler `getter` hands out, from the client or the executor. */
function handlerFor(
  session: LegacySession,
  getter: string,
): Record<string, unknown> {
  for (const owner of [session.client, session.executor]) {
    const make = (owner as unknown as Record<string, unknown>)[getter];
    if (typeof make === 'function')
      return make.call(owner) as Record<string, unknown>;
  }
  throw new Error(`No legacy getter ${getter}`);
}

const refusedRows = Object.entries(LEGACY_REFUSED).flatMap(([getter, rows]) =>
  Object.entries(rows).map(([member, row]) => ({ getter, member, row })),
);

/** Which configured object a sending case reads, by its type's spelling. */
function kindOf(objectType: string): 'program' | 'class' {
  const type = objectType.toLowerCase();
  if (type === 'program' || type === 'prog/p') return 'program';
  if (type === 'class' || type === 'clas/oc') return 'class';
  throw new Error(`No configured object for a ${objectType} read`);
}

/** The sending cases of the argument-dependent members, and what they read. */
const servedCases = Object.entries(ARGUMENT_DEPENDENT).flatMap(([key, cases]) =>
  Object.entries(cases)
    .filter(([, c]) => c.expect === 'sends')
    .map(([name, c]) => ({
      member: key.slice(key.indexOf('.') + 1) as
        | 'readObjectMetadata'
        | 'readObjectSource',
      name,
      objectType: c.objectType,
      kind: kindOf(c.objectType),
    })),
);

describeLegacyRfc(
  'Legacy 7.40 SP04 over RFC — refused members send nothing',
  () => {
    withLegacyCase('legacy_refusals_send_nothing', (params) => {
      let session: LegacySession | undefined;
      /** The same connection, behind a recorder that forwards nothing. */
      let denying: LegacySession | undefined;
      const current = () => session as LegacySession;
      const guarded = () => denying as LegacySession;

      beforeAll(async () => {
        session = await openLegacySession();
        denying = await legacyClientsOn(session.connection, { deny: true });
      }, 120000);

      afterAll(async () => {
        await closeLegacySession(session);
      });

      for (const { getter, member, row } of refusedRows) {
        it(`${getter}.${member} (${row.section}) answers the refusal and sends nothing`, async () => {
          const { recorder } = guarded();
          const mark = recorder.requests.length;
          const types = recorder.sessionTypes.length;

          const answer = (await row.call(
            handlerFor(guarded(), getter),
            integrationHeadersOf,
          )) as {
            ok: boolean;
            getError: () => { origin: string; code?: string };
          };

          expect(answer.ok).toBe(false);
          expect(answer.getError().origin).toBe('refusal');
          expect(answer.getError().code).toBe(
            AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
          );
          expect(sentSince(recorder, mark)).toEqual([]);
          expect(recorder.sessionTypes.slice(types)).toEqual([]);
        }, 60000);
      }

      /**
       * The class metadata Accept the legacy server sends on 7.40. Measured
       * over RFC on 7.40 SP04 (2026-10-26): only the unversioned type answers
       * `200`; every list naming a version answers `400`
       * ExceptionContentHandlerNotFound. The library passes the caller's
       * `accept` through; choosing it is the legacy server's.
       */
      const CLASS_METADATA_ON_740 = 'application/vnd.sap.adt.oo.classes+xml';

      for (const { member, name, objectType, kind } of servedCases) {
        it(`getUtils.${member}[${name}] reads the ${kind} and answers 200`, async () => {
          const { recorder, client } = current();
          const objectName = param(
            params,
            kind === 'program' ? 'program_name' : 'class_name',
          );
          const utils = client.getUtils();
          const mark = recorder.requests.length;

          const answer =
            member === 'readObjectMetadata'
              ? await utils.readObjectMetadata(
                  objectType as AdtObjectType,
                  objectName,
                  undefined,
                  kind === 'class'
                    ? {
                        accept: CLASS_METADATA_ON_740,
                        analyse: analyseException,
                      }
                    : { analyse: analyseException },
                )
              : await utils.readObjectSource(
                  objectType as AdtSourceObjectType,
                  objectName,
                  undefined,
                  undefined,
                  { analyse: analyseException },
                );

          expectResult(answer, `${member}(${objectType}, ${objectName})`);
          const sent = sentSince(recorder, mark);
          expect(sent.map(lineOf)).toEqual([expect.stringMatching(/^GET /)]);
          expect(sent[0]?.status).toBe(200);
          if (member === 'readObjectMetadata' && kind === 'class')
            expect(sent[0]?.headers?.Accept).toBe(CLASS_METADATA_ON_740);
        }, 60000);
      }
    });
  },
);
