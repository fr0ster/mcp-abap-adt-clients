/**
 * The objects the debugger tests run under the debugger.
 *
 * The debugger changes no code, so a debugger test needs no object of its
 * own: its target is a shared dependency (`shared_dependencies` in
 * test-config.yaml), created once if missing in the shared package and
 * transport, brought to the configured source and activated by
 * `ensureSharedDependency`, and never deleted by a test. The lines a test
 * stops at are read from that configured source, by their `BP:<name>`
 * markers, so the source and the test cannot drift apart.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from '../../clients/AdtClient';

const { ensureSharedDependency, resolveSharedDependency } =
  require('./test-helper');

export type SharedType = 'classes' | 'views';

/** The configured source of a shared object, or '' when there is none. */
export function sharedSource(type: SharedType, name: string): string {
  const entry = resolveSharedDependency(type, name) as {
    source?: unknown;
  } | null;
  return typeof entry?.source === 'string' ? entry.source : '';
}

/**
 * Marker name → line number (1-based) of every line that carries `marker`
 * followed by a name: `"BP:` in ABAP, `-- BP:` in SQLScript.
 */
export function markerLines(
  source: string,
  marker: string,
): Record<string, number> {
  const lines: Record<string, number> = {};
  source.split('\n').forEach((text, index) => {
    const at = text.indexOf(marker);
    if (at < 0) return;
    let end = at + marker.length;
    while (end < text.length && /\w/.test(text[end] ?? '')) end++;
    const name = text.slice(at + marker.length, end);
    if (name) lines[name] = index + 1;
  });
  return lines;
}

/**
 * Make sure a debug target is there, at its configured source and active.
 * Fails naming what is missing: the shared entry, its source, or a marker the
 * test stops at. Answers whether this call wrote it.
 */
export async function ensureDebugTarget(
  connection: IAbapConnection,
  type: SharedType,
  name: string,
  required: { marker: string; names: readonly string[] } | undefined,
  logger?: ILogger,
): Promise<{ changed: boolean }> {
  const source = sharedSource(type, name);
  if (!source) {
    throw new Error(
      `shared_dependencies.${type} has no entry ${name} with a source; add it to test-config.yaml (see test-config.yaml.template)`,
    );
  }
  if (required) {
    const lines = markerLines(source, required.marker);
    const missing = required.names.filter((n) => !lines[n]);
    if (missing.length) {
      throw new Error(
        `the source of shared ${type} ${name} has no ${missing.map((n) => `${required.marker}${n}`).join(', ')} marker`,
      );
    }
  }
  const result = (await ensureSharedDependency(
    new AdtClient(connection, logger),
    type,
    name,
    logger,
  )) as { changed?: boolean };
  // `changed`: written by this call. A target already at its source and
  // active is left as it is — no lock, no write.
  return { changed: result.changed !== false };
}
