/**
 * The root package's `If-Match` claim (`ifMatch.test.ts` there), held against
 * the legacy classes: every update member a legacy client's handler has sends
 * `If-Match` with the caller's `ifMatch` on its write exactly when it is
 * given, or answers a refusal before any request. The legacy classes override
 * no update that writes: what they send is the root member's, inherited.
 *
 * 7.40 does not act on `If-Match` (measured on 7.40 over RFC, 2026-11-03: a
 * stale or an arbitrary `If-Match` on a source write answered `200` and the
 * write took place; docs/LEGACY.md). The header is sent as given all the same:
 * the request is the caller's, and SAP's answer is the verdict.
 */

import { join } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { createLibraryLogger } from '../../../../adt-clients/src/__tests__/helpers/testLogger';
import { factoryOf } from '../../../../adt-clients/src/__tests__/unit/capabilities/behaviourGuard';
import type { HandlerEntry } from '../../../../adt-clients/src/__tests__/unit/capabilities/manifest';
import {
  expectIfMatchExactlyWhenGiven,
  ownerOfUpdateRow,
  UPDATE_MEMBERS,
  updateRows,
} from '../../../../adt-clients/src/__tests__/unit/ifMatchGuard';
import { scanImplementations } from '../../../../adt-clients/src/__tests__/unit/requestHeadersGuard';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';

/**
 * The legacy update members that answer a refusal and send nothing: the
 * metadata writes not served or not measured on 7.40.
 */
const SENDS_NO_REQUEST: ReadonlySet<string> = new Set([
  'AdtPackageLegacy.updateMetadata',
  'AdtRequestLegacy.updateMetadata',
  'AdtMessageClassLegacy.updateMetadata',
  'AdtClassLegacy.updateMetadata',
  'AdtProgramLegacy.updateMetadata',
  'AdtInterfaceLegacy.updateMetadata',
  'AdtFunctionModuleLegacy.updateMetadata',
  'AdtDdlLegacy.updateMetadata',
  'AdtIncludeLegacy.updateMetadata',
]);

/** The handler the legacy client's getter of this manifest entry hands out. */
function legacyHandler(
  connection: IAbapConnection,
  entry: HandlerEntry,
): unknown {
  const client = new AdtClientLegacy(connection, createLibraryLogger());
  const getter: unknown = Reflect.get(client, factoryOf(entry));
  if (typeof getter !== 'function') {
    throw new Error(`AdtClientLegacy has no ${factoryOf(entry)}`);
  }
  return Reflect.apply(getter, client, []);
}

const ROWS = updateRows(legacyHandler, 'legacy ');

let scanned: ReturnType<typeof scanImplementations> | undefined;

/** The update members this package's `src` implements, as `<class>.<member>`. */
function UPDATE_IMPLEMENTATIONS(): string[] {
  scanned ??= scanImplementations(join(__dirname, '..', '..'));
  return scanned.found.filter((impl) =>
    UPDATE_MEMBERS.some((member) => impl.endsWith(`.${member}`)),
  );
}

describe('a legacy update sends If-Match exactly when ifMatch is given', () => {
  for (const row of ROWS) {
    it(`${row.name}.${row.member}`, async () => {
      await expectIfMatchExactlyWhenGiven(row, SENDS_NO_REQUEST);
    });
  }
});

describe('the table covers every legacy update implementation', () => {
  it('every legacy class implementing update or updateMetadata is reached by a row', () => {
    const reached = new Set(ROWS.map(ownerOfUpdateRow));
    const found = UPDATE_IMPLEMENTATIONS();
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((impl) => !reached.has(impl))).toEqual([]);
  });

  it('every refusal still names a declared method', () => {
    const declared = new Set(UPDATE_IMPLEMENTATIONS());
    for (const name of SENDS_NO_REQUEST) expect(declared).toContain(name);
  });
});
