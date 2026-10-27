/**
 * The legacy clients' corpus pairs, for the header probe (moved from the root
 * package's `tools/header-probe/pairs.ts` at 7879dd0c, where they sat beside
 * the modern table).
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';

/**
 * The legacy client's pairs (`AdtClientLegacy`, handler `legacy get…()`),
 * from MIGRATION-36 "The pairs 35.0.0 sent", with the direct `DELETE`s taken
 * from "The completed pairs, measured". A header the table names none for is
 * left out. Change it only together with that document.
 */
export const LEGACY_PAIRS: readonly {
  handler: string;
  member: string;
  accept?: string;
  contentType?: string;
}[] = [
  ...[
    'legacy getClass()',
    'legacy getDdl()',
    'legacy getFunctionGroup()',
    'legacy getFunctionModule()',
    'legacy getInterface()',
    'legacy getProgram()',
  ].map((handler) => ({
    handler,
    member: 'delete',
    accept: 'application/xml',
    contentType: 'application/xml',
  })),
  {
    handler: 'legacy getClass()',
    member: 'create',
    accept: 'application/vnd.sap.adt.oo.classes+xml',
    contentType: 'application/vnd.sap.adt.oo.classes+xml',
  },
  ...[
    'legacy getClass()',
    'legacy getFunctionModule()',
    'legacy getInterface()',
  ].map((handler) => ({
    handler,
    member: 'update',
    accept: 'text/plain',
    contentType: 'text/plain',
  })),
  {
    handler: 'legacy getFunctionGroup()',
    member: 'create',
    contentType: 'application/vnd.sap.adt.functions.groups+xml',
  },
  {
    handler: 'legacy getFunctionGroup()',
    member: 'updateMetadata',
    accept: 'application/vnd.sap.adt.functions.groups+xml',
    contentType: 'application/vnd.sap.adt.functions.groups+xml; charset=utf-8',
  },
  ...[
    'legacy getLocalDefinitions()',
    'legacy getLocalMacros()',
    'legacy getLocalTestClass()',
    'legacy getLocalTypes()',
  ].flatMap((handler) =>
    ['delete', 'update'].map((member) => ({
      handler,
      member,
      accept: 'text/plain',
      contentType: 'text/plain',
    })),
  ),
  {
    handler: 'legacy getProgram()',
    member: 'create',
    accept: 'application/vnd.sap.adt.programs.programs+xml',
    contentType: 'application/vnd.sap.adt.programs.programs+xml',
  },
  {
    handler: 'legacy getUtils()',
    member: 'activateObjectsGroup',
    accept: 'application/xml',
    contentType: 'application/xml',
  },
];

/** The legacy client's pair of `handler.member`, or `undefined`. */
export function legacyPair(
  handler: string,
  member: string,
): Partial<IAdtHeaders> | undefined {
  const row = LEGACY_PAIRS.find(
    (pair) => pair.handler === handler && pair.member === member,
  );
  if (!row) return undefined;
  const pair: Partial<IAdtHeaders> = {};
  if (row.accept) pair.accept = row.accept;
  if (row.contentType) pair.contentType = row.contentType;
  return pair;
}
