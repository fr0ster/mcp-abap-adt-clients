/**
 * Does `validate()` report a name that is already taken — and how?
 *
 * A validation is a question about a name: is it admissible, and is something
 * already there. Measured, the answer arrives two different ways: a domain and
 * an interface refuse with `400`, and a DDL source answers `200` carrying
 * `<SEVERITY>ERROR</SEVERITY>` with the reason in `<SHORT_TEXT>` — a refusal
 * this library reads on exactly one type out of thirty-four.
 *
 * This validates a name that certainly exists, per type, and prints the status
 * beside what the body said. Creates nothing.
 *
 *   npx ts-node scripts/probe-validate-collision.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const PACKAGE = 'ZADT_BLD_PKG03';

// biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
const say = (line: string) => console.log(line);

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);
  const d = { packageName: PACKAGE, description: 'validate collision probe' };

  // biome-ignore lint/suspicious/noExplicitAny: several handlers, several configs
  const cases: Array<[string, any, any]> = [
    ['domain', client.getDomain(), { ...d, domainName: 'ZAC_SHR_GA_DOM' }],
    [
      'structure',
      client.getStructure(),
      { ...d, structureName: 'ZAC_SHR_STRU' },
    ],
    ['table', client.getTable(), { ...d, tableName: 'ZAC_SHR_VTABL' }],
    ['class', client.getClass(), { ...d, className: 'ZAC_SHR_RUN01' }],
    ['ddl', client.getDdl(), { ...d, ddlName: 'ZAC_SHR_BIMP_DDLS' }],
    [
      'functionGroup',
      client.getFunctionGroup(),
      { ...d, functionGroupName: 'ZAC_SHR_FUGR' },
    ],
    [
      'serviceDefinition',
      client.getServiceDefinition(),
      { ...d, serviceDefinitionName: 'ZAC_SRVD01' },
    ],
  ];

  try {
    for (const [name, handler, config] of cases) {
      const answer = await handler.validate(config);
      if (answer.ok) {
        const body = String(answer.getResult().value ?? '');
        const severity = /<SEVERITY>([^<]*)<\/SEVERITY>/.exec(body)?.[1];
        const text = /<SHORT_TEXT>([^<]*)<\/SHORT_TEXT>/.exec(body)?.[1];
        say(
          `${name.padEnd(19)} ok  ${severity ? `SEVERITY=${severity}  "${text ?? ''}"` : `(no severity, ${body.length} bytes)`}`,
        );
      } else {
        say(
          `${name.padEnd(19)} failure  ${answer.getError().message.replace(/\s+/g, ' ').slice(0, 80)}`,
        );
      }
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error);
  process.exit(1);
});
