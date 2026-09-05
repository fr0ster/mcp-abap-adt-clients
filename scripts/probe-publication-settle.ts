/**
 * How long publish and unpublish take to settle, and what they answer.
 *
 * Both are POSTs to `…/publishjobs` / `…/unpublishjobs` — jobs by name — and
 * this library reads neither body and waits for neither to finish. Measured on
 * the trial: an unpublish "timed out" at the client's 120s and the binding was
 * unpublished when looked at afterwards. So the job runs; the client gave up.
 *
 * This fires one transition and polls the binding's own `srvb:published` until
 * it flips, printing the elapsed time. That is the number the library needs in
 * order to stop deleting a binding that is still publishing.
 *
 *   npx ts-node scripts/probe-publication-settle.ts publish   ZAC_SRVB01 ZAC_SRVD01 odatav4 0001
 *   npx ts-node scripts/probe-publication-settle.ts unpublish ZAC_SRVB01 ZAC_SRVD01 odatav4 0001
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const ACCEPT_BINDING =
  'application/vnd.sap.adt.businessservices.servicebinding.v1+xml, ' +
  'application/vnd.sap.adt.businessservices.servicebinding.v2+xml';

async function state(
  connection: IAbapConnection,
  name: string,
): Promise<{ published?: string; allowedAction?: string }> {
  const response = await connection.makeAdtRequest({
    url: `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}`,
    method: 'GET',
    timeout: 30000,
    headers: { Accept: ACCEPT_BINDING },
  });
  const xml = String(response.data);
  return {
    published: /srvb:published="([^"]*)"/.exec(xml)?.[1],
    allowedAction: /srvb:allowedAction="([^"]*)"/.exec(xml)?.[1],
  };
}

async function main(): Promise<void> {
  const [action, name, serviceName, serviceType, serviceVersion] =
    process.argv.slice(2);
  const want = action === 'publish' ? 'true' : 'false';
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const say = (line: string): void => {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(line);
  };

  try {
    say(`before: ${JSON.stringify(await state(connection, name))}`);

    const bindingUri = `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}`;
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">' +
      `<adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${name.toUpperCase()}"/>` +
      '</adtcore:objectReferences>';
    const job = action === 'publish' ? 'publishjobs' : 'unpublishjobs';
    const url =
      `/sap/bc/adt/businessservices/${serviceType}/${job}` +
      `?servicename=${encodeURIComponent(serviceName)}&serviceversion=${encodeURIComponent(serviceVersion)}`;

    const started = Date.now();
    // Fire and do NOT wait on the POST: the point is to watch the state, and a
    // client timeout on the POST says nothing about whether the job ran.
    const posted = connection
      .makeAdtRequest({
        url,
        method: 'POST',
        timeout: 600000,
        data: xml,
        headers: {
          Accept: process.env.PROBE_ACCEPT ?? 'application/xml',
          'Content-Type': 'application/xml',
        },
      })
      .then(
        (r) => {
          say(
            `  POST answered ${r.status} after ${Date.now() - started}ms, ` +
              `${String(r.data).length} bytes: ${String(r.data).slice(0, 400)}`,
          );
        },
        (e: {
          message?: string;
          response?: { status?: number; data?: unknown };
        }) => {
          say(
            `  POST threw after ${Date.now() - started}ms: ` +
              `${e.response?.status ?? ''} ${e.message}`,
          );
          // A 406 names the types it would have accepted, in its own body —
          // which is the whole reason to print it rather than the status alone.
          say(`  body: ${String(e.response?.data ?? '(none)').slice(0, 700)}`);
        },
      );

    for (let attempt = 1; attempt <= 60; attempt += 1) {
      await new Promise((r) => setTimeout(r, 10000));
      const now = await state(connection, name);
      say(
        `  +${Math.round((Date.now() - started) / 1000)}s  published=${now.published} allowedAction=${now.allowedAction}`,
      );
      if (now.published === want) {
        say(`SETTLED after ${Math.round((Date.now() - started) / 1000)}s`);
        break;
      }
    }
    await posted;
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
