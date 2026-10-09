/**
 * address-matrix — read every registry address on real systems, in the case
 * the registry sends (lowercase, through `seg`) and in the case a caller gives
 * (as written), and say whether the two answers agree.
 *
 *   npx ts-node scripts/address-matrix.ts --objects <file.json> \
 *     --to e19-tunnel --to trial:cloud --out address-matrix.md
 *
 * The objects file names real objects on concrete systems, so it lives outside
 * the repository.
 */
import * as fs from 'node:fs';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { RECORDS, sourceUri, versionsUri } from '../src/endpoints/objects';
import { addressFor } from './lib/addressMatrix';
import { answerOf, connectionFor, resolveTarget } from './lib/adtTarget';

type Args = string[];
type Objects = Record<string, Record<string, Args[]>>;

/**
 * Each kind's readable resources, exactly as its module builds them — they are
 * not uniform: a function include has `/versions` on the include itself, a class
 * keeps versions per include (`/includes/<kind>/versions`), a program include
 * has none. Read from `src/core/<kind>/versions.ts` and `read.ts` on 2026-10-01.
 */
const RESOURCES: Record<
  string,
  { source?: (u: string) => string; versions?: (u: string) => string }
> = {
  PROGRAM: { source: sourceUri, versions: (u) => versionsUri(sourceUri(u)) },
  PROGRAM_INCLUDE: { source: sourceUri },
  CLASS: {
    source: sourceUri,
    versions: (u) => versionsUri(`${u}/includes/implementations`),
  },
  CLASS_INCLUDE: { versions: versionsUri },
  INTERFACE: { source: sourceUri, versions: (u) => versionsUri(sourceUri(u)) },
  FUNCTION_MODULE: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  // ADT's own `rel=versions` link, not what the module built until this branch
  // (`<include>/versions`, "No suitable resource found" on an on-premise and a cloud system).
  FUNCTION_INCLUDE: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  // `<object>/versions` is ADT's own link; `/source/main/versions` answered
  // "No suitable resource found" on both systems (2026-10-01).
  DDL_SOURCE: { source: sourceUri, versions: versionsUri },
  TABLE: { source: sourceUri, versions: (u) => versionsUri(sourceUri(u)) },
  STRUCTURE: { source: sourceUri, versions: (u) => versionsUri(sourceUri(u)) },
  // A classic table type has no `/source/main` and its versions are on the
  // object; a source-based one is unmeasured. Read the address only until a Z
  // table type is measured.
  TABLE_TYPE: {},
  BEHAVIOR_DEFINITION: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  SERVICE_DEFINITION: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  // `<object>/versions` is ADT's own link; `/source/main/versions` answered
  // "No suitable resource found" on both systems (2026-10-01).
  ACCESS_CONTROL: { source: sourceUri, versions: versionsUri },
  METADATA_EXTENSION: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  TRANSFORMATION: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  SCALAR_FUNCTION: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
  SCALAR_FUNCTION_IMPLEMENTATION: {
    source: sourceUri,
    versions: (u) => versionsUri(sourceUri(u)),
  },
};

/** Arguments that are names (lowercased by `seg`); the rest are kinds/subtypes. */
const NAME_ARGS: Record<string, number[]> = {
  CLASS_INCLUDE: [0],
  ENHANCEMENT: [1],
};

// A transport calls logger.debug() and friends unconditionally: an empty object
// fails with "this.logger?.debug is not a function".
const noop = () => undefined;
const silent: ILogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
} as ILogger;

function asGiven(uri: string, args: Args, kind: string): string {
  let out = uri;
  for (const i of NAME_ARGS[kind] ?? args.map((_, n) => n)) {
    const arg = args[i];
    out = out.replace(
      `/${encodeURIComponent(arg.toLowerCase())}`,
      `/${encodeURIComponent(arg)}`,
    );
  }
  return out;
}

async function get(
  connection: ReturnType<typeof connectionFor>,
  url: string,
  accept: string,
) {
  try {
    const r = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: 60_000,
      headers: { Accept: accept },
    });
    return { status: r.status, body: String(r.data ?? '') };
  } catch (error) {
    const a = answerOf(error);
    return 'status' in a
      ? { status: a.status, body: String(a.data ?? '') }
      : { status: 0, body: a.error };
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const opt = (k: string) => argv[argv.indexOf(k) + 1];
  const objects = JSON.parse(
    fs.readFileSync(opt('--objects'), 'utf8'),
  ) as Objects;
  const targets = argv.flatMap((a, i) => (a === '--to' ? [argv[i + 1]] : []));
  const lines: string[] = [
    '| target | kind | request | status | agrees |',
    '|---|---|---|---|---|',
  ];
  let failed = false;

  for (const spec of targets) {
    const target = resolveTarget(spec);
    const connection = connectionFor(target, silent);
    await connection.connect();
    try {
      for (const [kind, argLists] of Object.entries(objects[spec] ?? {})) {
        // Keys that are not records (SERVICE_BINDING_ODATA) have their own loop
        // below; RECORDS[kind] would be undefined here.
        if (!(kind in RECORDS)) continue;
        const record = RECORDS[kind as keyof typeof RECORDS];
        for (const args of argLists) {
          const address = addressFor(record, args);
          if (!address) {
            failed = true;
            lines.push(
              `| ${target.label} | ${kind} | — | no address this record builds | |`,
            );
            continue;
          }
          if (!address.byName) {
            const c = await get(connection, address.url, '*/*');
            if (c.status !== 200) failed = true;
            lines.push(
              `| ${target.label} | ${kind} | GET ${address.url} | ${c.status} | no name in the address |`,
            );
            continue;
          }
          const lower = address.url;
          const upper = asGiven(lower, args, kind);
          const a = await get(connection, lower, '*/*');
          const b = await get(connection, upper, '*/*');
          // Case-insensitive: a feed echoes the request's own spelling in its links.
          const agrees =
            a.status === b.status &&
            a.body.toLowerCase() === b.body.toLowerCase();
          if (a.status !== 200 || !agrees) failed = true;
          lines.push(
            `| ${target.label} | ${kind} | GET ${lower} | ${a.status} | ${agrees ? 'yes' : `NO — as given: ${b.status}`} |`,
          );
          // Every resource in both cases, not only the address: the switch
          // changes the case of all of them.
          const res = RESOURCES[kind] ?? {};
          const pairs: [string, string | undefined, string][] = [
            ['source', res.source?.(lower), 'text/plain'],
            [
              'versions',
              res.versions?.(lower),
              'application/atom+xml;type=feed',
            ],
          ];
          for (const [what, url, accept] of pairs) {
            if (!url) continue;
            const l = await get(connection, url, accept);
            const u = await get(connection, asGiven(url, args, kind), accept);
            const same =
              l.status === u.status &&
              l.body.toLowerCase() === u.body.toLowerCase();
            if (l.status !== 200 || !same) failed = true;
            lines.push(
              `| ${target.label} | ${kind} ${what} | GET ${url} | ${l.status} | ${same ? 'yes' : `NO — as given: ${u.status}`} |`,
            );
          }
        }
      }
      // The OData service a binding exposes is sent UPPERCASE today
      // (AdtService.ts:966, :1010). Measured in both cases here; until this says
      // they agree, odataService keeps the uppercase (Step 4).
      for (const [type, name] of objects[spec]?.SERVICE_BINDING_ODATA ?? []) {
        const t = type as 'odatav2' | 'odatav4';
        const up = `${RECORDS.SERVICE_BINDING.root}/${t}/${encodeURIComponent(name.toUpperCase())}`;
        const lo = `${RECORDS.SERVICE_BINDING.root}/${t}/${encodeURIComponent(name.toLowerCase())}`;
        const accept = `application/vnd.sap.adt.businessservices.${t}.v1+xml, application/vnd.sap.adt.businessservices.${t}.v2+xml`;
        const a = await get(connection, up, accept);
        const b = await get(connection, lo, accept);
        const same = a.status === b.status && a.body === b.body;
        if (a.status !== 200 || !same) failed = true;
        lines.push(
          `| ${target.label} | SERVICE_BINDING odata | GET ${up} | ${a.status} | ${same ? 'yes' : `NO — lowercase: ${b.status}`} |`,
        );
      }
      for (const kind of Object.keys(RECORDS)) {
        if (!objects[spec]?.[kind]) {
          lines.push(`| ${target.label} | ${kind} | — | not measured here | |`);
        }
      }
    } finally {
      void Promise.resolve(connection.disconnect()).catch(() => undefined);
    }
  }
  fs.writeFileSync(opt('--out'), `${lines.join('\n')}\n`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
  process.stderr.write(`address-matrix: ${String(error)}\n`);
  process.exitCode = 2;
});
