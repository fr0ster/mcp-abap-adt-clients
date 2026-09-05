/**
 * How does a class that exists only as an inactive version answer a metadata
 * read?
 *
 * The master-language test reads one back right after `create()` and retries
 * eight times over sixteen seconds, on the belief that a freshly created object
 * is "not immediately readable". Every attempt in a full run answered
 * `400 ExceptionResourceWrongData`, which is not a not-ready-yet shape — so the
 * belief is worth testing rather than waiting on.
 *
 * Creates ZAC_PROBE_INACT in the default package and deletes it again.
 *
 *   npx ts-node scripts/probe-inactive-metadata.ts
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

const NAME = 'ZAC_PROBE_INACT';
const PACKAGE = 'ZADT_BLD_PKG03';

// biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
const say = (line: string) => console.log(line);

// biome-ignore lint/suspicious/noExplicitAny: a probe reads whatever came back
function report(label: string, answer: any) {
  if (answer.ok) {
    const value = String(answer.getResult().value ?? '');
    const lang = /adtcore:masterLanguage="([^"]*)"/.exec(value)?.[1];
    say(
      `${label.padEnd(34)} ok, ${value.length} bytes${lang ? `, masterLanguage=${lang}` : ''}`,
    );
  } else {
    const f = answer.getError();
    say(`${label.padEnd(34)} [${f.origin}] ${f.message.slice(0, 95)}`);
  }
}

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);
  const cls = client.getClass();
  try {
    await cls.delete({ className: NAME }).catch(() => undefined);

    report(
      'create',
      await cls.create({
        className: NAME,
        packageName: PACKAGE,
        description: 'inactive metadata probe',
      }),
    );

    report('metadata, no version', await cls.readMetadata({ className: NAME }));
    report(
      'metadata, inactive',
      await cls.readMetadata({ className: NAME }, { version: 'inactive' }),
    );
    report(
      'metadata, active',
      await cls.readMetadata({ className: NAME }, { version: 'active' }),
    );
    report('source, inactive', await cls.read({ className: NAME }, 'inactive'));

    report('activate', await cls.activate({ className: NAME }));

    report(
      'metadata after activate',
      await cls.readMetadata({ className: NAME }),
    );
  } finally {
    await cls.delete({ className: NAME }).catch(() => undefined);
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error);
  process.exit(1);
});
