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
import { updateRequestHeaders } from '../../utils/requestHeaders';
import { createLibraryLogger } from '../helpers/testLogger';
import { HANDLERS, type HandlerEntry } from './capabilities/manifest';
import {
  expectGuardedContentType,
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

/**
 * SAP builds the ETag of an XML document and of a DDIC source with the
 * media type, and on a write compares it with the write's `Content-Type`:
 * a domain `PUT` of `application/vnd.sap.adt.domains.v2+xml` with the read's
 * ETag answered `200`, the same with `; charset=utf-8` answered `412`; a
 * structure source read answered `…text/plain2`, and a write with
 * `text/plain; charset=utf-8` was compared with `…text/plain; charset=utf-82`
 * (`412`) while one with `text/plain` passed (measured on premise,
 * 2026-11-03). So a guarded write of those documents goes without the
 * charset, and every write keeps the caller's header byte for byte without
 * `ifMatch`. The other sources keep their charset: their ETags carry no media
 * type, and their guarded writes were measured passing with it.
 */
describe('a guarded write of an XML document or a DDIC source drops the charset', () => {
  const verdicts: string[] = [];
  for (const row of ROWS) {
    it(`${row.name}.${row.member} with the pair it sends`, async () => {
      verdicts.push(
        `${row.name}.${row.member}: ${await expectGuardedContentType(row, new Set())}`,
      );
    });
  }

  it('drops it exactly on the writes named, where the pair has one', () => {
    const stripped = verdicts
      .filter((v) => v.endsWith(': stripped'))
      .map((v) => v.slice(0, v.indexOf(':')))
      .sort();
    expect(stripped).toEqual(
      [
        'accessControl.updateMetadata',
        'appendStructure.update',
        'behaviorDefinition.updateMetadata',
        'class.updateMetadata',
        'dataElement.updateMetadata',
        'ddl.updateMetadata',
        'domain.updateMetadata',
        'functionGroup.updateMetadata',
        'functionModule.updateMetadata',
        'include.updateMetadata',
        'interface.updateMetadata',
        'messageClass.updateMetadata',
        'messageClassMessage.update',
        'metadataExtension.updateMetadata',
        'program.updateMetadata',
        'scalarFunction.updateMetadata',
        'scalarFunctionImplementation.updateMetadata',
        'serviceBinding.updateMetadata',
        'serviceDefinition.updateMetadata',
        'structure.update',
        'structure.updateMetadata',
        'table.update',
        'table.updateMetadata',
        'transformation.updateMetadata',
      ].sort(),
    );
  });
});

describe('updateRequestHeaders: the charset of a guarded write', () => {
  const domain = {
    accept: 'application/vnd.sap.adt.domains.v2+xml',
    contentType: 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
  };
  const source = {
    accept: 'text/plain',
    contentType: 'text/plain; charset=utf-8',
  };

  it('drops it when the writer says so and ifMatch is given', () => {
    expect(updateRequestHeaders(domain, '"e1"', 'dropped')).toEqual({
      Accept: 'application/vnd.sap.adt.domains.v2+xml',
      'Content-Type': 'application/vnd.sap.adt.domains.v2+xml',
      'If-Match': '"e1"',
    });
    expect(
      updateRequestHeaders(source, '"e2"', 'dropped')['Content-Type'],
    ).toBe('text/plain');
    expect(
      updateRequestHeaders(
        {
          accept: 'application/xml',
          contentType: 'application/xml;CHARSET=UTF-8',
        },
        '"e3"',
        'dropped',
      )['Content-Type'],
    ).toBe('application/xml');
  });

  it('keeps it when the writer keeps it', () => {
    expect(updateRequestHeaders(source, '"e4"', 'kept')).toEqual({
      Accept: 'text/plain',
      'Content-Type': 'text/plain; charset=utf-8',
      'If-Match': '"e4"',
    });
  });

  it('sends the pair byte for byte without ifMatch, whatever the writer says', () => {
    for (const charset of ['kept', 'dropped'] as const) {
      expect(updateRequestHeaders(domain, undefined, charset)).toEqual({
        Accept: 'application/vnd.sap.adt.domains.v2+xml',
        'Content-Type': 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
      });
    }
  });

  it('leaves a Content-Type without charset as it is', () => {
    expect(
      updateRequestHeaders(
        {
          accept: 'application/vnd.sap.adt.packages.v2+xml',
          contentType: 'application/vnd.sap.adt.packages.v2+xml',
        },
        '"e5"',
        'dropped',
      )['Content-Type'],
    ).toBe('application/vnd.sap.adt.packages.v2+xml');
  });
});
