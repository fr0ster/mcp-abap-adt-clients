/**
 * What publish and unpublish actually answer, in full.
 *
 * Both are POSTs to `…/publishjobs` and `…/unpublishjobs` — jobs by name — and
 * this library reads neither body. So "it answered ok" has never meant "the job
 * ran": measured once, an unpublish answered ok in 1.3s and the binding was
 * still published 72s later; measured again, the same call hung for 120s.
 *
 * Two things this prints that were never looked at: the whole response body,
 * and the binding's own state before and after, so a job that reports something
 * about itself can be seen reporting it.
 *
 *   npx ts-node scripts/probe-publication.ts state ZAC_SRVB01
 *   npx ts-node scripts/probe-publication.ts unpublish ZAC_SRVB01 ZAC_SRVD01 odatav4 0001
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

/** Every `srvb:` attribute on the root, so nothing is filtered out by guesswork. */
function bindingState(xml: string): string {
  const root = /<srvb:serviceBinding[^>]*>/.exec(xml)?.[0] ?? '';
  const attrs = [...root.matchAll(/([\w:]+)="([^"]*)"/g)]
    .filter(([, k]) => k.startsWith('srvb:') || k === 'adtcore:version')
    .map(([, k, v]) => `${k}=${v}`);
  return attrs.join('  ') || '(no srvb:serviceBinding root)';
}

async function readBinding(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive',
): Promise<string> {
  try {
    const response = await connection.makeAdtRequest({
      url: `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}?version=${version}`,
      method: 'GET',
      timeout: 30000,
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.servicebinding.v1+xml, ' +
          'application/vnd.sap.adt.businessservices.servicebinding.v2+xml',
      },
    });
    return `${version}: ${bindingState(String(response.data))}`;
  } catch (error) {
    const e = error as { response?: { status?: number }; message?: string };
    return `${version}: read failed ${e.response?.status ?? ''} ${e.message ?? ''}`;
  }
}

async function main(): Promise<void> {
  const [action, name, serviceName, serviceType, serviceVersion] =
    process.argv.slice(2);
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const say = (line: string): void => {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(line);
  };

  try {
    say(await readBinding(connection, name, 'active'));
    say(await readBinding(connection, name, 'inactive'));
    if (action === 'state') return;

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

    say(`\nPOST ${url}`);
    const started = Date.now();
    try {
      const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: 180000,
        data: xml,
        headers: {
          Accept: 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      say(`answered ${response.status} after ${Date.now() - started}ms`);
      say(`headers: ${JSON.stringify(response.headers)}`);
      say(`body (${String(response.data).length} bytes):`);
      say(String(response.data).replace(/></g, '>\n<'));
    } catch (error) {
      const e = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      say(`threw after ${Date.now() - started}ms: ${e.message}`);
      if (e.response) {
        say(`status ${e.response.status}, body: ${String(e.response.data)}`);
      }
    }

    say('');
    say(await readBinding(connection, name, 'active'));
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
