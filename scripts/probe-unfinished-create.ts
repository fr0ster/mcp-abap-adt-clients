/**
 * What does a `create()` that was never followed by an `update()` leave behind?
 *
 * A bare POST makes a repository entry with no version in it. For a class that
 * is survivable — SAP generates a skeleton, and activation works. For other
 * types the entry is reported to be invalid or absent by everything that reads
 * it, while still holding the name against a second create.
 *
 * That combination is the trap: nothing can see the object, and nothing can
 * have the name either. This asks each question in turn, for a domain, a data
 * element and a DDL source, and prints what the server said to each.
 *
 * Creates ZAC_UNFIN_* in the default package and tries to delete them again;
 * whether that succeeds is one of the things being measured, so check the
 * package afterwards.
 *
 *   npx ts-node scripts/probe-unfinished-create.ts
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

// biome-ignore lint/suspicious/noExplicitAny: a probe reads whatever came back
function report(label: string, answer: any) {
  if (answer?.ok) {
    const value = String(answer.getResult().value ?? '');
    say(`  ${label.padEnd(22)} ok${value ? `, ${value.length} bytes` : ''}`);
  } else {
    const f = answer.getError();
    say(
      `  ${label.padEnd(22)} [${f.origin}] ${f.message.replace(/\s+/g, ' ').slice(0, 100)}`,
    );
  }
}

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);

  // biome-ignore lint/suspicious/noExplicitAny: three handlers, three configs
  const cases: Array<{ name: string; handler: any; config: any }> = [
    {
      name: 'domain ZAC_UNFIN_DOM',
      handler: client.getDomain(),
      config: {
        domainName: 'ZAC_UNFIN_DOM',
        packageName: PACKAGE,
        description: 'unfinished create probe',
        dataType: 'CHAR',
        length: 10,
      },
    },
    {
      name: 'interface ZAC_UNFIN_INTF',
      handler: client.getInterface(),
      config: {
        interfaceName: 'ZAC_UNFIN_INTF',
        packageName: PACKAGE,
        description: 'unfinished create probe',
      },
    },
    {
      name: 'ddl ZAC_UNFIN_DDLS',
      handler: client.getDdl(),
      config: {
        ddlName: 'ZAC_UNFIN_DDLS',
        packageName: PACKAGE,
        description: 'unfinished create probe',
      },
    },
    {
      name: 'serviceDefinition ZAC_UNFIN_SRVD',
      handler: client.getServiceDefinition(),
      config: {
        serviceDefinitionName: 'ZAC_UNFIN_SRVD',
        packageName: PACKAGE,
        description: 'unfinished create probe',
      },
    },
    {
      name: 'class ZAC_UNFIN_CLS',
      handler: client.getClass(),
      config: {
        className: 'ZAC_UNFIN_CLS',
        packageName: PACKAGE,
        description: 'unfinished create probe',
      },
    },
    {
      name: 'program ZAC_UNFIN_PROG',
      handler: client.getProgram(),
      config: {
        programName: 'ZAC_UNFIN_PROG',
        packageName: PACKAGE,
        description: 'unfinished create probe',
      },
    },
  ];

  try {
    for (const c of cases) {
      say(`\n### ${c.name}`);
      report('create', await c.handler.create(c.config));
      report('read (default)', await c.handler.read(c.config));
      report('read active', await c.handler.read(c.config, 'active'));
      report('read inactive', await c.handler.read(c.config, 'inactive'));
      report('validate again', await c.handler.validate(c.config));
      report('create again', await c.handler.create(c.config));
      report('delete', await c.handler.delete(c.config));
      report('read after delete', await c.handler.read(c.config));
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
