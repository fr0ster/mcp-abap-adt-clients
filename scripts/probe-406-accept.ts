/**
 * Ask the publish/unpublish job endpoint what it will answer with.
 *
 * A 406 names the acceptable content types in its own body — the ADT text
 * outranks the status — so the way to learn the right `Accept` is to send a
 * wrong one and read what comes back, rather than to guess between the two
 * spellings this file already contains.
 *
 * `publishByServiceType` POSTs with `application/vnd.sap.as+xml`;
 * `publishODataV2` GETs the same family with
 * `application/vnd.sap.adt.businessservices.odatav2.v3+xml`. They cannot both
 * be right.
 *
 *   npx ts-node scripts/probe-406-accept.ts ZAC_SRVB01 ZAC_SRVD01 odatav4 0001
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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
    const url =
      `/sap/bc/adt/businessservices/${serviceType}/unpublishjobs` +
      `?servicename=${encodeURIComponent(serviceName)}&serviceversion=${encodeURIComponent(serviceVersion)}`;
    const bindingUri = `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}`;
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">' +
      `<adtcore:objectReference adtcore:uri="${bindingUri}" adtcore:name="${name.toUpperCase()}"/>` +
      '</adtcore:objectReferences>';

    // Deliberately a type no ADT resource serves, so the refusal is about the
    // representation and names the ones it would have served.
    const started = Date.now();
    try {
      const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: 300000,
        data: body,
        headers: {
          Accept: 'application/x-nonsense-to-force-406',
          'Content-Type': 'application/xml',
        },
      });
      say(`answered ${response.status} after ${Date.now() - started}ms`);
      say(String(response.data));
    } catch (error) {
      const e = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      say(
        `threw after ${Date.now() - started}ms: ${e.response?.status} ${e.message}`,
      );
      say('--- body ---');
      say(String(e.response?.data ?? '(none)'));
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
