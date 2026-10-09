/**
 * How long after an unpublish does a service binding actually report it?
 *
 * `AdtServiceBinding.delete` unpublishes and then deletes, and the delete keeps
 * coming back "has published local service endpoint(s)". Whether that is a lag
 * or a refusal is a fact about the server, so it gets measured rather than
 * covered with a sleep somebody guessed.
 *
 *   npx ts-node scripts/probe-unpublish-lag.ts ZAC_SRVB01 ZAC_SRVD01 odatav4 0001
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

const published = (document: string): string => {
  const m = /(?:srvb:)?published="([^"]*)"/.exec(document);
  const a = /(?:srvb:)?allowedAction="([^"]*)"/.exec(document);
  return `published=${m?.[1] ?? '—'} allowedAction=${a?.[1] ?? '—'}`;
};

async function main(): Promise<void> {
  const [bindingName, serviceName, serviceType, serviceVersion] =
    process.argv.slice(2);
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const bindings = new AdtClient(connection, logger).getServiceBinding();

    const before = await bindings.read({ bindingName }, 'active');
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(
      `before: ${before.ok ? published(String(before.getResult().value)) : before.getError().message}`,
    );

    const started = Date.now();
    const answer = await bindings.update({
      bindingName,
      desiredPublicationState: 'unpublished',
      serviceType: serviceType as 'odatav2' | 'odatav4',
      serviceName,
      serviceVersion,
    });
    // biome-ignore lint/suspicious/noConsole: same
    console.log(
      `unpublish answered after ${Date.now() - started}ms: ` +
        (answer.ok ? 'ok' : answer.getError().message),
    );

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await new Promise((r) => setTimeout(r, 5000));
      const now = await bindings.read({ bindingName }, 'active');
      const state = now.ok
        ? published(String(now.getResult().value))
        : `read failed: ${now.getError().message}`;
      // biome-ignore lint/suspicious/noConsole: same
      console.log(`  +${(Date.now() - started) / 1000}s  ${state}`);
      if (now.ok && /published=false/.test(state)) break;
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
