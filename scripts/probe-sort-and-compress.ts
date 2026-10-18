/**
 * Sort and compress tasks, and see what it did to their object lists.
 *
 * For each task in TASKS: list the entries, report those held more than once,
 * `sortAndCompress`, list again. With MOVE_TO set to a task and NAMES to the
 * object names, each named entry still on a listed task is then removed from it
 * and added to MOVE_TO — the case a duplicate used to block (TR292).
 *
 *   MCP_ENV_PATH=… TASKS=T1,T2 npx ts-node scripts/probe-sort-and-compress.ts
 *   MCP_ENV_PATH=… TASKS=T1 NAMES=A,B MOVE_TO=T9 npx ts-node scripts/probe-sort-and-compress.ts
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
import { AdtClient } from '../src/clients/AdtClient';
import { transportDocuments } from '../src/core/transport/types';
import { wireItself } from '../src/utils/resultStrategy';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

// biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
const say = (...args: unknown[]) => console.log(...args);

async function main(): Promise<void> {
  const tasks = list(process.env.TASKS);
  const names = list(process.env.NAMES);
  const moveTo = process.env.MOVE_TO?.trim().toUpperCase();
  if (!tasks.length) throw new Error('TASKS is required');

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const request = new AdtClient(connection, logger).getRequest({
      ...transportDocuments,
      objects: transportObjectEntries,
      // Status and headers too: the measurement is what the answer was.
      sortedAndCompressed: wireItself,
    });

    const entries = async (task: string) => {
      const read = await request.readObjects(task);
      if (!read.ok) throw new Error(`${task}: ${read.getError().message}`);
      return read.getResult().value;
    };
    const duplicates = (list: { type: string; name: string }[]) => {
      const seen = new Map<string, number>();
      for (const e of list) {
        const key = `${e.type} ${e.name}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      return [...seen].filter(([, n]) => n > 1);
    };

    for (const task of tasks) {
      const before = await entries(task);
      say(`${task}: ${before.length} entries, duplicated:`, duplicates(before));

      const sorted = await request.sortAndCompress(task);
      if (sorted.ok) {
        const wire = sorted.getResult().value;
        say(
          `${task}: sortAndCompress ${wire.status} headers ${JSON.stringify(wire.headers)} body ${JSON.stringify(String(wire.data ?? '')).slice(0, 300)}`,
        );
      } else {
        say(`${task}: sortAndCompress refused: ${sorted.getError().message}`);
      }

      const after = await entries(task);
      say(`${task}: ${after.length} entries, duplicated:`, duplicates(after));

      if (!moveTo) continue;
      for (const entry of after.filter((e) => names.includes(e.name))) {
        if (!entry.position) {
          say(`${task}: ${entry.type} ${entry.name} has no position`);
          continue;
        }
        const removed = await request.removeObject(
          task,
          {
            ...entry,
            position: entry.position,
          },
          { headers: headersOf(request, 'removeObject') },
        );
        say(
          `${task}: remove ${entry.type} ${entry.name}@${entry.position}:`,
          removed.ok ? 'ok' : removed.getError().message,
        );
        if (!removed.ok) continue;
        const added = await request.addObject(
          moveTo,
          {
            name: entry.name,
            type: entry.type,
            pgmid: entry.pgmid,
          },
          { headers: headersOf(request, 'addObject') },
        );
        say(
          `${moveTo}: add ${entry.type} ${entry.name}:`,
          added.ok ? 'ok' : added.getError().message,
        );
      }
      const left = (await entries(task)).filter((e) => names.includes(e.name));
      say(
        `${task}: named entries left:`,
        left.map((e) => `${e.type} ${e.name}`),
      );
    }
    if (moveTo) {
      const target = (await entries(moveTo)).filter((e) =>
        names.includes(e.name),
      );
      say(
        `${moveTo}: named entries:`,
        target.map((e) => `${e.type} ${e.name}`),
      );
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
