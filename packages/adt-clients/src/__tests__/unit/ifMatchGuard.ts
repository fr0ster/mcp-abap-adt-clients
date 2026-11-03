/**
 * The table and the checks of `ifMatch.test.ts`: every update member of every
 * handler sends `If-Match` with the caller's `ifMatch` on its write, exactly
 * when `ifMatch` is given (interfaces-adt 25.2.0, `IAdtUpdateOptions`), and no
 * other member sends it. Shared so a package that builds on these handlers
 * holds its subclasses to the same claim, by importing this module by relative
 * path (test-only source in this repository).
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { HANDLERS, type HandlerEntry } from './capabilities/manifest';
import {
  CHAIN_MAIN_WRITE,
  m,
  ownerOf,
  pairFor,
  type Recorded,
  recordingConnection,
  valuesOf,
} from './requestHeadersGuard';

/** The members whose options are `IAdtUpdateOptions`. */
export const UPDATE_MEMBERS = ['update', 'updateMetadata'] as const;

/**
 * Update members that write no document, so there is nothing for `If-Match`
 * to guard: they never send it, even when a caller outside the type system
 * passes `ifMatch`.
 */
export const NOT_A_DOCUMENT_WRITE: Record<string, string> = {
  'AdtServiceBinding.update':
    'the publication job, POST …/publishjobs — it changes the binding’s state and writes no document',
};

/** One update member of one handler. */
export interface UpdateRow {
  /** How the row is named in a failure. */
  name: string;
  member: (typeof UPDATE_MEMBERS)[number];
  build: (connection: IAbapConnection) => unknown;
  config: Record<string, unknown>;
}

/** Whether `value` has a method `member`. */
export function hasMethod(value: unknown, member: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, member) === 'function'
  );
}

/**
 * Every update member of every handler `handlerOf` builds from the manifest,
 * named `<prefix><handler>`.
 */
export function updateRows(
  handlerOf: (connection: IAbapConnection, entry: HandlerEntry) => unknown,
  prefix = '',
): UpdateRow[] {
  const rows: UpdateRow[] = [];
  for (const [name, entry] of Object.entries(HANDLERS)) {
    const build = (connection: IAbapConnection) => handlerOf(connection, entry);
    const probe = build(recordingConnection().connection);
    for (const member of UPDATE_MEMBERS) {
      if (!hasMethod(probe, member)) continue;
      rows.push({
        name: `${prefix}${name}`,
        member,
        build,
        config: entry.config,
      });
    }
  }
  return rows;
}

/** `<class>.<member>`: the class that owns the row's member. */
export function ownerOfUpdateRow(row: UpdateRow): string {
  const handler = row.build(recordingConnection().connection);
  const owner =
    typeof handler === 'object' && handler !== null
      ? ownerOf(handler, row.member)
      : '(none)';
  return `${owner}.${row.member}`;
}

/** The ETag a row passes: a value no implementation could hold. */
export function etagFor(row: UpdateRow): string {
  return `"guard-etag-${row.name}.${row.member}"`;
}

/** Call the row's member, with `ifMatch` when given and without the key otherwise. */
async function callRow(
  row: UpdateRow,
  ifMatch: string | undefined,
): Promise<{ owner: string; calls: Recorded[] }> {
  const { connection, calls } = recordingConnection();
  const handler = row.build(connection);
  const owner =
    typeof handler === 'object' && handler !== null
      ? ownerOf(handler, row.member)
      : '(none)';
  try {
    await m(handler, row.member)(row.config, {
      headers: pairFor(`${row.name}.${row.member}`),
      source: String(row.config.source ?? '" guard'),
      lockHandle: 'GUARD-LOCK',
      ...(ifMatch === undefined ? {} : { ifMatch }),
    });
  } catch {
    // What the member answered is another test's subject; what it sent is
    // this one's.
  }
  return { owner, calls };
}

/** The `If-Match` values a request carried, whatever the header's case. */
function ifMatchOf(call: Recorded): unknown[] {
  return valuesOf(call.headers, 'if-match');
}

/**
 * The row's member sends `If-Match: <ifMatch>` on its write when `ifMatch` is
 * given, on that request only, and sends none when it is not. A member in
 * `sendsNoRequest` (`<class>.<member>`), or an own property of a plain-object
 * handler, answers before any request; a member in
 * {@link NOT_A_DOCUMENT_WRITE} never sends it.
 */
export async function expectIfMatchExactlyWhenGiven(
  row: UpdateRow,
  sendsNoRequest: ReadonlySet<string>,
): Promise<void> {
  const etag = etagFor(row);
  const given = await callRow(row, etag);
  const absent = await callRow(row, undefined);
  const key = `${given.owner}.${row.member}`;

  if (given.owner === '(own property)' || sendsNoRequest.has(key)) {
    // A refusal: it answers before any request is built.
    expect(given.calls).toEqual([]);
    expect(absent.calls).toEqual([]);
    return;
  }

  // Without `ifMatch`, no request carries the header.
  expect(absent.calls.length).toBeGreaterThan(0);
  expect(absent.calls.flatMap(ifMatchOf)).toEqual([]);

  if (key in NOT_A_DOCUMENT_WRITE) {
    expect(given.calls.length).toBeGreaterThan(0);
    expect(given.calls.flatMap(ifMatchOf)).toEqual([]);
    return;
  }

  // With it, the write carries exactly the value given, and nothing else does.
  const mainVerb = CHAIN_MAIN_WRITE[key];
  const main = mainVerb
    ? given.calls.filter((c) => c.method === mainVerb)
    : given.calls;
  expect(main).toHaveLength(1);
  const [write] = main;
  expect(write?.method).toBe('PUT');
  expect(write === undefined ? [] : ifMatchOf(write)).toEqual([etag]);
  expect(given.calls.filter((c) => c !== write).flatMap(ifMatchOf)).toEqual([]);
}

/**
 * A member that is not an update, called with `ifMatch` in its options as a
 * caller outside the type system would: none of its requests carries
 * `If-Match`. The reads and the creates of every handler.
 */
export async function expectNoIfMatchOutsideUpdates(
  build: (connection: IAbapConnection) => unknown,
  config: Record<string, unknown>,
  member: 'create' | 'read' | 'readMetadata',
): Promise<Recorded[]> {
  const { connection, calls } = recordingConnection();
  const handler = build(connection);
  const fn = m(handler, member);
  const options = {
    headers: pairFor(`no-if-match.${member}`),
    ifMatch: '"guard-etag-not-an-update"',
  };
  try {
    if (member === 'read') await fn(config, undefined, options);
    else await fn(config, options);
  } catch {
    // A refusal sent nothing, which is what is asserted.
  }
  expect(calls.flatMap(ifMatchOf)).toEqual([]);
  return calls;
}
