/**
 * Where a request keeps its object entries: on the request, or on its tasks.
 *
 * `removeObject` needs a `tm:position`, and the entry it belongs to sits on a
 * task on an on-premise system — the request above it shows the same entries
 * and refuses to detach one, saying it "does not exist" there. Whether the
 * same holds on BTP ABAP was never measured, and a live test that walks only
 * the tasks reports "no entry" either way.
 *
 * Read-only. Prints what each level lists.
 *
 *   MCP_ENV_PATH=… npx ts-node scripts/probe-request-entries.ts <REQUEST>
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

// biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
const say = (line: string) => console.log(line);

async function main(): Promise<void> {
  const number = process.argv[2];
  if (!number) {
    say('usage: probe-request-entries.ts <REQUEST NUMBER>');
    return;
  }
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const request = new AdtClient(connection, logger).getRequest();

    const listed = await request.readObjects(number);
    say(`\n${number} — readObjects on the REQUEST`);
    if (!listed.ok) say(`  refused: ${listed.getError().message}`);
    else {
      const entries = listed.getResult().value;
      say(`  ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
      for (const e of entries)
        say(
          `    ${e.pgmid ?? '?'} ${e.type} ${e.name}  position=${e.position ?? '(none)'}`,
        );
    }

    const metadata = await request.readMetadata({ transportNumber: number });
    const document = metadata.ok
      ? String(metadata.getResult().value ?? '')
      : '';
    const tasks = (document.match(/<tm:task\s[^>]*?>/g) ?? [])
      .map((t) => t.match(/tm:number="([^"]*)"/)?.[1])
      .filter((n): n is string => Boolean(n));
    say(`\n${number} — ${tasks.length} task(s) in the request document`);
    say(
      `  document carries ${(document.match(/<tm:abap_object\s/g) ?? []).length} tm:abap_object element(s)`,
    );

    for (const task of tasks) {
      const onTask = await request.readObjects(task);
      if (!onTask.ok) {
        say(`  ${task}: refused: ${onTask.getError().message}`);
        continue;
      }
      const entries = onTask.getResult().value;
      say(
        `  ${task}: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`,
      );
      for (const e of entries)
        say(
          `    ${e.pgmid ?? '?'} ${e.type} ${e.name}  position=${e.position ?? '(none)'}`,
        );
    }
  } finally {
    await releaseTestConnection(connection as never);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error);
  process.exit(1);
});
