/**
 * The legacy clients as a client set of the root package's header probe
 * (`registerClientSet` in its `tools/header-probe/members.ts`): handlers
 * labelled `legacy get…()`, as MIGRATION-36 does, their pairs from
 * `legacyPairs.ts`. A legacy member the modern client does not send is not
 * sent either; a legacy write shares the modern handler's ledger entry, and
 * the write cycle leaves legacy writes as phase 1 left them.
 */

import {
  type IClientSet,
  registerClientSet,
} from '../../../adt-clients/tools/header-probe/members';
import { AdtClientLegacy } from '../../src/clients/AdtClientLegacy';
import { AdtExecutorLegacy } from '../../src/clients/AdtExecutorLegacy';
import { legacyPair } from './legacyPairs';

export const LEGACY_CLIENT_SET: IClientSet = {
  prefix: 'legacy ',
  build: (connection, options) => ({
    client: new AdtClientLegacy(connection, undefined, options),
    executor: new AdtExecutorLegacy(connection),
  }),
  pairOf: legacyPair,
  // On 7.40 the base client cannot remove what the probe makes (its deletion
  // endpoint is absent there), and an unknown `/sap/bc/adt/*` path answers
  // 200 with an empty body, so such a read finds nothing (measured 2026-10-28).
  // The legacy delete is made under the caller's lock (measured: lock, delete
  // with the handle, unlock).
  forTemporaryObjects: {
    client: (connection, options) =>
      new AdtClientLegacy(connection, undefined, options),
    deleteUnderLock: true,
    emptyBodyIsAbsent: true,
  },
};

/** Probe the legacy clients beside the modern ones, from now on. */
export function registerLegacyClients(): void {
  registerClientSet(LEGACY_CLIENT_SET);
}
