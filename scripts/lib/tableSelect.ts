/**
 * The statement `getTableContents` used to build, as a consumer writes it.
 *
 * Until 19.0.0 the member read `/datapreview/ddic/{name}/metadata` itself,
 * took every column it found, and posted `SELECT T~A, T~B FROM T`. Two requests
 * in one member, and a statement nobody outside could change — not the column
 * list, not an ordering, not a `WHERE`.
 *
 * This reproduces exactly that statement, which is what a caller migrating
 * unchanged behaviour needs. A caller who wants something else writes something
 * else; that is the point of the split.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTableColumns } from '../../src/core/shared/tableContents';

/** Column names out of the metadata document. */
export function columnNamesIn(document: string): string[] {
  const names: string[] = [];
  for (const match of document.matchAll(/dataPreview:name="([^"]+)"/g)) {
    names.push(match[1]);
  }
  return names;
}

/** `SELECT T~A, T~B FROM T` over every column the entity has. */
export async function selectEveryColumn(
  connection: IAbapConnection,
  tableName: string,
): Promise<string> {
  const name = tableName.toUpperCase();
  const answer = await getTableColumns(connection, name);
  const columns = columnNamesIn(String(answer.data ?? ''));

  if (columns.length === 0) {
    throw new Error(
      `no columns in the metadata for ${name} — nothing to select`,
    );
  }

  return `SELECT ${columns.map((c) => `${name}~${c}`).join(', ')} FROM ${name}`;
}
