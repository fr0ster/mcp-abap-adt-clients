/**
 * A write guarded by the ETag of a read (interfaces-adt 25.2.0).
 *
 * `IAdtUpdateOptions.ifMatch` is the ETag a read answered for the document an
 * update replaces. Every update member that writes a document sends it as
 * `If-Match` on its write — the value as given — exactly when it is given, and
 * sends no `If-Match` otherwise; SAP then refuses the write (`412`) when the
 * document changed since that read (measured on premise and on the cloud,
 * 2026-11-03). Nothing else sends it: not a read, not a create, and not a
 * member that writes no document.
 *
 * The table is closed: every class method in `src` named `update` or
 * `updateMetadata` is found with the TypeScript parser and must be reached by
 * a row.
 */

import { join } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../clients/AdtClient';
import { createLibraryLogger } from '../helpers/testLogger';
import { HANDLERS, type HandlerEntry } from './capabilities/manifest';
import {
  expectIfMatchExactlyWhenGiven,
  expectNoIfMatchOutsideUpdates,
  hasMethod,
  NOT_A_DOCUMENT_WRITE,
  ownerOfUpdateRow,
  UPDATE_MEMBERS,
  updateRows,
} from './ifMatchGuard';
import {
  recordingConnection,
  scanImplementations,
} from './requestHeadersGuard';

const modern = (connection: IAbapConnection, entry: HandlerEntry) =>
  entry.factory(new AdtClient(connection, createLibraryLogger()));

const ROWS = updateRows(modern);

let scanned: ReturnType<typeof scanImplementations> | undefined;

/** The update members this package's `src` implements, as `<class>.<member>`. */
function UPDATE_IMPLEMENTATIONS(): string[] {
  scanned ??= scanImplementations(join(__dirname, '..', '..'));
  return scanned.found.filter((impl) =>
    UPDATE_MEMBERS.some((member) => impl.endsWith(`.${member}`)),
  );
}

describe('an update sends If-Match exactly when ifMatch is given', () => {
  for (const row of ROWS) {
    it(`${row.name}.${row.member}`, async () => {
      await expectIfMatchExactlyWhenGiven(row, new Set());
    });
  }
});

describe('the table covers every update implementation', () => {
  it('every class implementing update or updateMetadata is reached by a row', () => {
    const reached = new Set(ROWS.map(ownerOfUpdateRow));
    const found = UPDATE_IMPLEMENTATIONS();
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((impl) => !reached.has(impl))).toEqual([]);
  });

  it('every member that writes no document still names a declared method', () => {
    const declared = new Set(UPDATE_IMPLEMENTATIONS());
    for (const name of Object.keys(NOT_A_DOCUMENT_WRITE)) {
      expect(declared).toContain(name);
    }
  });
});

describe('a read or a create sends no If-Match', () => {
  for (const [name, entry] of Object.entries(HANDLERS)) {
    const build = (connection: IAbapConnection) => modern(connection, entry);
    const probe = build(recordingConnection().connection);
    for (const member of ['create', 'read', 'readMetadata'] as const) {
      if (!hasMethod(probe, member)) continue;
      it(`${name}.${member}`, async () => {
        await expectNoIfMatchOutsideUpdates(build, entry.config, member);
      });
    }
  }
});
