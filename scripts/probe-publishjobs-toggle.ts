/**
 * Does `publishjobs` drive both directions?
 *
 * Eclipse posts `…/odatav4/publishjobs` for publish AND for unpublish — the
 * same URL — and does not wait for it. This library posts `…/unpublishjobs`
 * for the second direction, which is where its unpublish has been hanging for
 * 130s and settling unpredictably.
 *
 * So: fire `publishjobs` at a binding that is currently PUBLISHED and watch
 * `srvb:published`. If it flips to false, the endpoint is driven by the
 * object's state, not by the URL, and `unpublishjobs` is the wrong address.
 *
 *   npx ts-node scripts/probe-publishjobs-toggle.ts ZAC_SRVB01 ZAC_SRVD01 odatav4 0001
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
): Promise<string> {
  const response = await connection.makeAdtRequest({
    url: `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}`,
    method: 'GET',
    timeout: 30000,
    headers: { Accept: ACCEPT_BINDING },
  });
  const xml = String(response.data);
  return (
    `published=${/srvb:published="([^"]*)"/.exec(xml)?.[1]} ` +
    `allowedAction=${/srvb:allowedAction="([^"]*)"/.exec(xml)?.[1]}`
  );
}

async function main(): Promise<void> {
  const [name, serviceName, serviceType, serviceVersion] =
    process.argv.slice(2);
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const say = (line: string): void => {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(line);
  };

  try {
    say(`before: ${await state(connection, name)}`);

    const bindingUri = `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}`;
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">' +
      `<adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${name.toUpperCase()}"/>` +
      '</adtcore:objectReferences>';
    const url =
      `/sap/bc/adt/businessservices/${serviceType}/publishjobs` +
      `?servicename=${encodeURIComponent(serviceName)}&serviceversion=${encodeURIComponent(serviceVersion)}`;

    const started = Date.now();
    say(`POST ${url}  (fire and forget, as Eclipse does)`);
    // Not awaited: the point is the object's state, and Eclipse does not wait
    // for this either.
    void connection
      .makeAdtRequest({
        url,
        method: 'POST',
        timeout: 600000,
        data: body,
        headers: {
          Accept: 'application/vnd.sap.as+xml',
          'Content-Type': 'application/xml',
        },
      })
      .then(
        (r) =>
          say(
            `  POST answered ${r.status} after ${Date.now() - started}ms: ${String(r.data).slice(0, 300)}`,
          ),
        (e: { response?: { status?: number }; message?: string }) =>
          say(
            `  POST threw after ${Date.now() - started}ms: ${e.response?.status} ${e.message}`,
          ),
      );

    for (let attempt = 1; attempt <= 24; attempt += 1) {
      await new Promise((r) => setTimeout(r, 5000));
      const now = await state(connection, name);
      say(`  +${Math.round((Date.now() - started) / 1000)}s  ${now}`);
      if (/published=false/.test(now)) {
        say(
          'UNPUBLISHED by publishjobs — the URL does not carry the direction',
        );
        break;
      }
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
