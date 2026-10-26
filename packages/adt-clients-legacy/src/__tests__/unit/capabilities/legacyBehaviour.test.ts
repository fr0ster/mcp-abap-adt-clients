/**
 * The behaviour guard of the root package (`behaviour.test.ts` there), held
 * against the legacy client: every capability the manifest names is either
 * the request the guard checks, or a refusal the inventory decided.
 */

import {
  AdtObjectErrorCodes,
  type IAdtError,
} from '@mcp-abap-adt/interfaces-adt';
import {
  ACTIVATION_OK,
  assertIssuesItsRequest,
  factoryOf,
  invoke,
  recordingClient,
} from '../../../../../adt-clients/src/__tests__/unit/capabilities/behaviourGuard';
import {
  ATOM_METHODS,
  type Atom,
  HANDLERS,
  type HandlerEntry,
} from '../../../../../adt-clients/src/__tests__/unit/capabilities/manifest';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { LEGACY_REFUSED, LEGACY_SENDS } from '../../helpers/legacyMembers';

/**
 * The legacy client's handlers, held to the same claims (spec §11.1
 * "Capabilities").
 *
 * A capability the manifest names is one `AdtClientLegacy` hands out too —
 * the same getter, the same member — so each is either a request, checked
 * exactly as above, or a refusal the inventory decided: a `LEGACY_REFUSED`
 * row (`helpers/legacyMembers.ts`), answered without a request in the one
 * refusal shape. A member that is neither is a stub on 7.40.
 *
 * Where 7.40 is asked another request than the manifest names, the request is
 * the inventory's (`LEGACY_SENDS`), and the member is listed here with why —
 * so the manifest's claim is not loosened for the modern client.
 */
const LEGACY_REQUESTS: Record<string, string> = {
  // One DELETE on the object's URI with the caller's lock handle: 7.40 has no
  // deletion service (spec §4.2).
  'class.delete': 'DELETE on the object, spec §4.2',
  'program.delete': 'as class',
  'interface.delete': 'as class',
  'functionGroup.delete': 'as class',
  'functionModule.delete': 'as class',
  'ddl.delete': 'as class',
  // Measured on 7.40 SP04 (B4-cycles-20261026-2019).
  'include.delete': 'as class',
  'messageClass.delete': 'as class',
  // Below 7.50 the CTS endpoint sits outside /sap/bc/adt/ (spec §7.2).
  'transport.readMetadata': 'GET /sap/bc/cts/transportrequests, spec §7.2',
};

/** The entry with the inventory's request for a {@link LEGACY_REQUESTS} member. */
function legacyEntry(
  name: string,
  getter: string,
  entry: HandlerEntry,
  method: string,
): HandlerEntry {
  if (!(`${name}.${method}` in LEGACY_REQUESTS)) return entry;
  const row = LEGACY_SENDS[getter]?.[method];
  if (!row) throw new Error(`No LEGACY_SENDS row ${getter}.${method}`);
  return {
    ...entry,
    requests: {
      ...entry.requests,
      [method]: row.sends.map((r) => ({ method: r.method, path: r.path })),
    },
  };
}

describe('capability guard — legacy behaviour', () => {
  it('every listed request deviation is one the legacy pass reaches', () => {
    const reached = Object.entries(HANDLERS as Record<string, HandlerEntry>)
      .flatMap(([name, entry]) =>
        entry.capabilities.flatMap((atom) =>
          ATOM_METHODS[atom as Atom].map((method) => `${name}.${method}`),
        ),
      )
      .filter((key) => key in LEGACY_REQUESTS);
    expect(reached.sort()).toEqual(Object.keys(LEGACY_REQUESTS).sort());
  });

  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    const getter = factoryOf(entry);
    describe(name, () => {
      for (const atom of entry.capabilities) {
        for (const method of ATOM_METHODS[atom as Atom]) {
          const refused = LEGACY_REFUSED[getter]?.[method] !== undefined;
          it(`${atom}: ${method} ${refused ? 'is refused without a request' : 'issues a request'}`, async () => {
            const { client, calls, sessionTypes } = recordingClient(
              ACTIVATION_OK,
              AdtClientLegacy,
            );
            const handler = entry.factory(client) as unknown as Record<
              string,
              unknown
            >;

            expect(typeof handler[method]).toBe('function');

            if (refused) {
              const answer = (await invoke(handler, method, entry.config)) as {
                ok: boolean;
                getError: () => IAdtError;
              };
              expect(answer.ok).toBe(false);
              expect(answer.getError().origin).toBe('refusal');
              expect(answer.getError().code).toBe(
                AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
              );
              expect(calls).toEqual([]);
              expect(sessionTypes).toEqual([]);
              return;
            }

            let refusal: unknown;
            try {
              await invoke(handler, method, entry.config);
            } catch (error) {
              refusal = error;
            }

            assertIssuesItsRequest(
              name,
              legacyEntry(name, getter, entry, method),
              method,
              calls,
              refusal,
            );
          });
        }
      }
    });
  }
});
