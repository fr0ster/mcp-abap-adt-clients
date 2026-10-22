/**
 * Move entries between tasks, and see where they are before and after.
 *
 * Lists FROM and TO. With NAMES (entry names, compared without the padding a
 * method entry carries) and MOVE=1, moves the named entries of FROM to TO in
 * one call and lists both again.
 *
 *   MCP_ENV_PATH=… FROM=T1 TO=T2 node_modules/.bin/ts-node scripts/probe-move-objects.ts
 *   MCP_ENV_PATH=… FROM=T1 TO=T2 NAMES=A,B MOVE=1 node_modules/.bin/ts-node scripts/probe-move-objects.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { transportObjectEntries } from '@mcp-abap-adt/adt-strategies';
import * as dotenv from 'dotenv';
import { headersOf } from '../src/__tests__/helpers/adtHeaders';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtRequest } from '../src/core/transport/AdtRequest';
import { transportDocuments } from '../src/core/transport/types';
import { wireItself } from '../src/utils/resultStrategy';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const squeeze = (name: string): string =>
  name.replace(/\s+/g, ' ').trim().toUpperCase();

// biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
const say = (...args: unknown[]) => console.log(...args);

async function main(): Promise<void> {
  const from = process.env.FROM?.trim().toUpperCase();
  const to = process.env.TO?.trim().toUpperCase();
  if (!from || !to) throw new Error('FROM and TO are required');
  const names = (process.env.NAMES ?? '')
    .split(',')
    .map(squeeze)
    .filter(Boolean);

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const request = new AdtRequest(connection, logger, undefined, {
      ...transportDocuments,
      objects: transportObjectEntries,
      // Status, headers and body: the measurement is what the answer was.
      movedObjects: wireItself,
    });

    const show = async (task: string) => {
      const read = await request.readObjects(task);
      if (!read.ok) throw new Error(`${task}: ${read.getError().message}`);
      const list = read.getResult().value;
      say(
        `${task}: ${list.length} entries`,
        list.map(
          (e) => `${e.pgmid} ${e.type} ${squeeze(e.name)}@${e.position}`,
        ),
      );
      return list;
    };

    const source = await show(from);
    await show(to);
    if (process.env.MOVE !== '1') return;

    // NAMES may carry the type too ("CPUB ZCL_X") to pick one of a class's
    // entries, which all share its name.
    const picked = source.filter(
      (e) =>
        e.position &&
        (names.includes(squeeze(e.name)) ||
          names.includes(squeeze(`${e.type} ${e.name}`))),
    );
    if (!picked.length) throw new Error(`none of ${names} on ${from}`);

    const moved = await request.moveObjects(
      from,
      to,
      picked.map((e) => ({ ...e, position: e.position as string })),
      { headers: headersOf(request, 'moveObjects') },
    );
    if (moved.ok) {
      const wire = moved.getResult().value;
      say(
        `moveObjects ${wire.status} ${JSON.stringify(wire.headers)}\n${String(wire.data ?? '')}`,
      );
    } else {
      say(`moveObjects refused: ${moved.getError().message}`);
    }

    await show(from);
    await show(to);
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
