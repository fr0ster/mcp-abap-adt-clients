/**
 * Read feed catalog and feed entries from SAP system.
 *
 * Usage:
 *   npx ts-node scripts/read-feeds.ts                    # feed catalog
 *   npx ts-node scripts/read-feeds.ts dumps              # dumps feed
 *   npx ts-node scripts/read-feeds.ts systemMessages     # system messages feed
 *   npx ts-node scripts/read-feeds.ts gatewayErrors      # gateway error log feed
 *   npx ts-node scripts/read-feeds.ts <url>              # arbitrary feed URL
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

const TOPICS = ['dumps', 'systemMessages', 'gatewayErrors'] as const;
type Topic = (typeof TOPICS)[number];

function isTopic(value: string): value is Topic {
  return TOPICS.includes(value as Topic);
}

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
    // Feed catalog
    console.log('\n=== Feed Catalog ===\n');
    const catalog = await feeds.list();
    for (const entry of catalog) {
      console.log(`  ${entry.title}`);
      console.log(`    href: ${entry.href}`);
      console.log(`    category: ${entry.category}`);
      console.log();
    }
    return;
  }

  if (isTopic(topic)) {
    console.log(
      `\n=== ${topic} (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
    );
    const entries = await feeds[topic](options);
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

  // Arbitrary URL
  console.log(
    `\n=== Feed: ${topic} (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
  );
  const entries = await feeds.byUrl(topic, options);
  console.log(`Found ${entries.length} entries:\n`);
  for (const entry of entries) {
    console.log(`  [${entry.updated}] ${entry.title}`);
    if (entry.link) console.log(`    link: ${entry.link}`);
    console.log();
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
