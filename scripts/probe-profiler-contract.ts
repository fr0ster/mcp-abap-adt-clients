/**
 * The two measurements interfaces 22.0.0 waits on.
 *
 * Run on a system that HAS cross traces — the BTP trial has none, and its
 * parameters endpoint refuses GET, which is why this exists. See
 * fr0ster/mcp-abap-adt-interfaces#46 and the plan's Tasks 0.1 / 0.2.
 *
 *   npx ts-node scripts/probe-profiler-contract.ts
 *   npx ts-node scripts/probe-profiler-contract.ts --write   # also POSTs one
 *                                                            # parameters resource
 *
 * Credentials and target come from the same place the tests use, so whatever
 * `.env` and `test-config.yaml` point at is what gets measured. Nothing here is
 * destructive: every request is a GET unless `--write` is given, and the one
 * write is the same POST `createParameters()` already makes.
 *
 * Output goes to `profiler-probe/` as raw bodies. Raw, because the last two
 * fields that changed this contract — `state` and `expiration` — were ones
 * nobody would have thought to summarise.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { SHARED_SESSION_FILE } from '../src/__tests__/helpers/sharedSession';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';

// A script has no jest bootstrap to load this for it.
const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const OUT = path.resolve(__dirname, '..', 'profiler-probe');
const WRITE = process.argv.includes('--write');

interface Probe {
  label: string;
  url: string;
  accept?: string;
  method?: 'GET' | 'POST';
  body?: string;
}

/** What the server said, kept whole. */
async function ask(connection: IAbapConnection, probe: Probe) {
  const file = path.join(OUT, `${probe.label}.xml`);
  try {
    const response = await connection.makeAdtRequest({
      url: probe.url,
      method: probe.method ?? 'GET',
      timeout: 120000,
      ...(probe.accept ? { headers: { Accept: probe.accept } } : {}),
      ...(probe.body ? { data: probe.body } : {}),
    });
    const body = String(response.data ?? '');
    fs.writeFileSync(file, body);
    // The Location header is the answer for Task 0.2(a), not the body.
    const headers = response.headers as Record<string, string> | undefined;
    const location = headers?.location ?? headers?.['content-location'];
    return {
      label: probe.label,
      status: response.status,
      bytes: body.length,
      location,
    };
  } catch (error) {
    const e = error as {
      message?: string;
      response?: { status?: number; data?: unknown };
    };
    const body = String(e.response?.data ?? e.message ?? '');
    fs.writeFileSync(file, body);
    // A 406 names the type it wants — that is an answer, not a failure.
    const accepted = /Accepted content types?: ([^<]*)/.exec(body)?.[1];
    return {
      label: probe.label,
      status: e.response?.status ?? 0,
      bytes: body.length,
      accepted,
    };
  }
}

async function main() {
  // Refuse to run alongside a jest run, and say which case it is.
  //
  // `createTestConnection()` adopts the session a run published, and
  // `releaseTestConnection()` then deliberately does NOT end it — the run owns
  // it. A script going through both would take somebody's session and give
  // nothing back. Probes exhausting a system's session pool is not
  // hypothetical: two runs of the ATC probe did it to E19, and the next four
  // test runs died in globalSetup with no session available.
  if (fs.existsSync(SHARED_SESSION_FILE)) {
    throw new Error(
      `${SHARED_SESSION_FILE} exists, so either a test run is in flight — in ` +
        'which case wait, one SAP-touching run at a time — or a previous run ' +
        'was killed before its teardown. If nothing is running, delete it and ' +
        'try again.',
    );
  }

  fs.mkdirSync(OUT, { recursive: true });
  const connection = await createTestConnection(createConnectionLogger());
  const results: Array<Record<string, unknown>> = [];

  try {
    // ---- Task 0.2: does anything read parameters, and where do the
    // catalogue choices go?
    results.push(
      await ask(connection, {
        label: '02-parameters-get',
        url: '/sap/bc/adt/runtime/traces/abaptraces/parameters',
        accept: 'application/xml',
      }),
    );
    results.push(
      await ask(connection, {
        label: '02-requests',
        url: '/sap/bc/adt/runtime/traces/abaptraces/requests',
        accept: 'application/xml',
      }),
    );
    for (const c of ['objecttypes', 'processtypes']) {
      results.push(
        await ask(connection, {
          label: `02-${c}`,
          url: `/sap/bc/adt/runtime/traces/abaptraces/${c}`,
          accept: 'application/xml',
        }),
      );
    }

    if (WRITE) {
      const created = await ask(connection, {
        label: '02-parameters-post',
        url: '/sap/bc/adt/runtime/traces/abaptraces/parameters',
        method: 'POST',
        accept: 'application/xml',
        body:
          '<?xml version="1.0" encoding="UTF-8"?>' +
          '<trc:parameters xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces">' +
          '<trc:description value="probe-task-0.2"/></trc:parameters>',
      });
      results.push(created);
      // The whole point: read back what the server stored under that id, and
      // see whether it has room for an object or process type.
      if (created.location) {
        results.push(
          await ask(connection, {
            label: '02-parameters-stored',
            url: String(created.location),
            accept: 'application/xml',
          }),
        );
      }
    }

    // ---- Task 0.1: what a cross trace looks like
    const list = await ask(connection, {
      label: '01-crosstrace-list',
      url: '/sap/bc/adt/crosstrace/traces',
      accept: 'application/vnd.sap.adt.crosstrace.traces.v1+xml',
    });
    results.push(list);
    results.push(
      await ask(connection, {
        label: '01-crosstrace-activations',
        url: '/sap/bc/adt/crosstrace/activations',
        accept: 'application/vnd.sap.adt.crosstrace.activations.v1+xml',
      }),
    );

    const listed = fs.readFileSync(
      path.join(OUT, '01-crosstrace-list.xml'),
      'utf8',
    );
    const id = /crosstrace\/traces\/([A-Za-z0-9_-]{8,})/.exec(listed)?.[1];
    if (id) {
      for (const [label, url] of [
        ['01-crosstrace-one', `/sap/bc/adt/crosstrace/traces/${id}`],
        [
          '01-crosstrace-records',
          `/sap/bc/adt/crosstrace/traces/${id}/records`,
        ],
        [
          '01-crosstrace-record-content',
          `/sap/bc/adt/crosstrace/traces/${id}/records/1/content`,
        ],
      ] as const) {
        results.push(
          await ask(connection, { label, url, accept: 'application/xml' }),
        );
      }
    }

    fs.writeFileSync(
      path.join(OUT, 'summary.json'),
      `${JSON.stringify({ takenAt: new Date().toISOString(), id, results }, null, 2)}\n`,
    );
  } finally {
    await releaseTestConnection(connection);
  }

  // This script IS its own output; there is no caller to inject a logger into.
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(`\nwrote ${OUT}\n`);
  for (const r of results) {
    // biome-ignore lint/suspicious/noConsole: same
    console.log(
      `  ${String(r.label).padEnd(30)} ${String(r.status).padEnd(5)} ${String(r.bytes).padStart(8)} bytes` +
        (r.accepted ? `   wants: ${r.accepted}` : '') +
        (r.location ? `   location: ${r.location}` : ''),
    );
  }
  // biome-ignore lint/suspicious/noConsole: same
  console.log(
    '\nAttach the whole directory to interfaces#46 — raw bodies, not summaries.\n',
  );
}

main().catch((error) => {
  // The message, not the object. A failed connect against SAP arrives with the
  // server's whole HTML error page attached — four kilobytes of markup around
  // the word "401" — and burying the reason is how a probe wastes the time of
  // the person who ran it.
  const e = error as { message?: string; response?: { status?: number } };
  const status = e.response?.status;
  // biome-ignore lint/suspicious/noConsole: a probe reports its own failure
  console.error(
    `\n${status ? `HTTP ${status}: ` : ''}${e.message ?? String(error)}\n` +
      (status === 401
        ? 'The credential was refused. Refresh it and run again.\n'
        : ''),
  );
  process.exit(1);
});
