/**
 * Read feed catalog and feed entries from SAP system.
 *
 * Usage:
 *   npx ts-node scripts/read-feeds.ts                    # feed catalog
 *   npx ts-node scripts/read-feeds.ts dumps              # dumps feed
 *   npx ts-node scripts/read-feeds.ts systemMessages     # system messages feed
 *   npx ts-node scripts/read-feeds.ts gatewayErrors      # gateway error log feed
 *
 * Options (env vars):
 *   FEED_USER=CB9980000974     — filter by user
 *   FEED_MAX=10                — max results
 *   MCP_ENV_PATH=trial.env     — switch SAP system
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtRuntimeClient } from '../src/clients/AdtRuntimeClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const sessionConfigPath = path.resolve(
  __dirname,
  '../src/__tests__/helpers/sessionConfig',
);
const { getConfig } = require(sessionConfigPath);

async function main() {
  const config = getConfig();
  const topic = process.argv[2];

  const options = {
    user: process.env.FEED_USER || undefined,
    maxResults: process.env.FEED_MAX
      ? Number.parseInt(process.env.FEED_MAX, 10)
      : 20,
  };

  console.log(`Connecting to ${config.url}...`);
  const connection: IAbapConnection = createAbapConnection(config);
  await (connection as any).connect();

  const runtime = new AdtRuntimeClient(connection, undefined, {
    enableAcceptCorrection: true,
  });
  const feeds = runtime.getFeeds();

  if (!topic) {
    console.log('\n=== Feed Catalog ===\n');
    const catalog = await feeds.list();
    for (const entry of catalog) {
      console.log(`  ${entry.title}`);
      console.log(`    url: ${entry.url}`);
      if (entry.category) console.log(`    category: ${entry.category}`);
      console.log();
    }
    return;
  }

  if (topic === 'dumps') {
    console.log(
      `\n=== Dumps Feed (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
    );
    const entries = await feeds.dumps(options);
    console.log(`Found ${entries.length} entries:\n`);
    for (const entry of entries) {
      console.log(`  [${entry.updated}] ${entry.title}`);
      if (entry.link) console.log(`    link: ${entry.link}`);
      if (entry.author) console.log(`    author: ${entry.author}`);
      if (entry.content) {
        const preview = String(entry.content).slice(0, 120);
        console.log(
          `    content: ${preview}${entry.content.length > 120 ? '...' : ''}`,
        );
      }
      console.log();
    }
    return;
  }

  if (topic === 'systemMessages') {
    console.log(
      `\n=== System Messages Feed (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
    );
    const entries = await feeds.systemMessages(options);
    console.log(`Found ${entries.length} entries:\n`);
    for (const entry of entries) {
      console.log(`  [${entry.id}] ${entry.title}`);
      console.log(`    severity: ${entry.severity}`);
      console.log(`    text: ${entry.text}`);
      console.log(`    created by: ${entry.createdBy}`);
      console.log(`    valid: ${entry.validFrom} — ${entry.validTo}`);
      console.log();
    }
    return;
  }

  if (topic === 'gatewayErrors') {
    console.log(
      `\n=== Gateway Errors Feed (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
    );
    const entries = await feeds.gatewayErrors(options);
    console.log(`Found ${entries.length} entries:\n`);
    for (const entry of entries) {
      console.log(`  [${entry.type}] ${entry.shortText}`);
      console.log(`    dateTime: ${entry.dateTime}`);
      console.log(`    username: ${entry.username}`);
      console.log(`    requestKind: ${entry.requestKind}`);
      console.log(`    transactionId: ${entry.transactionId}`);
      console.log();
    }
    return;
  }

  console.error(`Unknown topic: ${topic}`);
  console.error('Available: dumps, systemMessages, gatewayErrors');
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
