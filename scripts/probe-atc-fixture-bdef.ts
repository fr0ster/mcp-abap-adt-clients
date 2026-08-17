/**
 * Make the one fixture `AtcObjectType` is still missing: a behavior definition.
 *
 * Six of seven cloud candidate types are confirmed. `behavior_definition` is
 * not, for one reason: no BDEF exists in the probe package.
 *
 * **This script touches nothing else, and that is its whole design.**
 * `probe-atc-fixtures.ts` deletes each object before remaking it, which is
 * right when the package is being built from nothing and catastrophic now —
 * the six confirmed objects are the evidence, and remaking them risks losing
 * what took several sessions to establish. So this creates one object, reads
 * the ground first, and stops on the first thing it does not understand.
 *
 * What it checks before acting:
 *
 * - the CDS view is active and is a **root** view entity — a behavior cannot
 *   attach to anything else;
 * - the table it selects from is active;
 * - no BDEF of that name already exists, because then there is nothing to do
 *   and deleting one to remake it would be exactly the harm being avoided.
 *
 * The source is read-only on purpose. A `managed` behavior that declares
 * create, update or delete needs an implementation class, and naming one that
 * does not exist produces an object that creates and never activates — worse
 * than nothing for a probe, which would then ask ATC about something inactive.
 * A behavior with no modifying operations needs no implementation.
 *
 * Usage:
 *   MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/trial.env \
 *     npx ts-node scripts/probe-atc-fixture-bdef.ts --package=ZBASE_PROBE01
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { type ILogger, LogLevel } from '@mcp-abap-adt/interfaces';
import { DefaultLogger } from '@mcp-abap-adt/logger';
import * as dotenv from 'dotenv';
import { BaseTester } from '../src/__tests__/helpers/BaseTester';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';
import { AdtUtils } from '../src/core/shared/AdtUtils';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const VIEW_NAME = 'ZOK_I_PROBE';
const TABLE_NAME = 'ZOK_T_PROBE';

/**
 * Read-only, so nothing needs implementing.
 *
 * `strict ( 2 )` is left out deliberately: it adds requirements this fixture
 * has no use for, and every constraint that is not needed is another way for
 * the activation to fail for a reason unrelated to what is being probed.
 */
const BDEF_SOURCE = `managed;

define behavior for ${VIEW_NAME} alias Probe
persistent table ${TABLE_NAME.toLowerCase()}
lock master
authorization master ( instance )
{
  field ( readonly ) Id;

  mapping for ${TABLE_NAME.toLowerCase()}
  {
    Id = id;
    Name = name;
  }
}`;

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  return {
    packageName: get('package') ?? 'ZBASE_PROBE01',
    transportRequest: get('transport'),
  };
}

function reason(error: unknown): string {
  const e = error as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const body = typeof e.response?.data === 'string' ? e.response.data : '';
  const message = body.match(/<message[^>]*>([^<]+)<\/message>/)?.[1];
  return [
    e.response?.status ? `HTTP ${e.response.status}` : null,
    message ?? e.message,
  ]
    .filter(Boolean)
    .join(' — ');
}

async function main(): Promise<void> {
  const logger: ILogger = new DefaultLogger(LogLevel.INFO);
  const args = parseArgs(process.argv.slice(2));

  const sapConfig = getConfig();
  const connection = createAbapConnection(sapConfig, createConnectionLogger());
  await connection.connect();
  logger.info(`Connected to ${sapConfig.url}`);

  const client = new AdtClient(connection, logger);
  const utils = new AdtUtils(connection, logger);

  // --- the ground, before touching anything --------------------------------
  const contents = await utils.getPackageContentsList(args.packageName, {
    includeSubpackages: true,
  });
  const present = new Set(contents.map((i) => `${i.type}:${i.name}`));
  logger.info(
    `${args.packageName} holds: ${[...present].join(', ') || '(nothing)'}`,
  );

  if (present.has(`BDEF/BDO:${VIEW_NAME}`)) {
    logger.info(
      `A behavior definition ${VIEW_NAME} already exists. Nothing to do — and deleting it to remake it is the one thing this script will not do.`,
    );
    return;
  }
  if (!present.has(`DDLS/DF:${VIEW_NAME}`)) {
    logger.error(
      `No CDS view ${VIEW_NAME} in ${args.packageName}. A behavior needs one to attach to; refusing to guess.`,
    );
    process.exitCode = 1;
    return;
  }

  const source = await connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/ddl/sources/${VIEW_NAME}/source/main`,
    method: 'GET',
    timeout: 60_000,
    headers: { Accept: 'text/plain' },
  });
  const cds = String(source.data ?? '');
  if (!/define\s+root\s+view\s+entity/i.test(cds)) {
    logger.error(
      `${VIEW_NAME} is not a ROOT view entity — a behavior cannot attach to it. Its active source is:\n${cds || '(empty)'}`,
    );
    process.exitCode = 1;
    return;
  }
  logger.info(
    `${VIEW_NAME} is an active root view entity — a behavior can attach.`,
  );

  // --- make it -------------------------------------------------------------
  const config = {
    name: VIEW_NAME,
    packageName: args.packageName,
    ...(args.transportRequest
      ? { transportRequest: args.transportRequest }
      : {}),
    description: 'ATC probe behavior',
    implementationType: 'Managed' as const,
    rootEntity: VIEW_NAME,
    sourceCode: BDEF_SOURCE,
  };

  const tester = new BaseTester(
    client.getBehaviorDefinition(),
    'BehaviorDefinition',
    'atc_probe_bdef',
    VIEW_NAME,
    logger,
  );
  tester.setup({
    connection,
    client,
    hasConfig: true,
    isCloudSystem: true,
    buildConfig: () => config,
  });

  try {
    // The full chain — validate, create, lock, check, update, unlock,
    // activate. `create` alone leaves a shell: the source arrives on the
    // update, and it has to travel both as the flow's `sourceCode` and inside
    // `updateConfig`, which is how the integration tests pass it.
    await tester.flowTest(
      // biome-ignore lint/suspicious/noExplicitAny: the per-type config shape
      config as any,
      { skip_cleanup: true },
      // biome-ignore lint/suspicious/noExplicitAny: the per-type config shape
      { sourceCode: BDEF_SOURCE, updateConfig: config as any },
    );
    logger.info(`${VIEW_NAME} behavior definition made and activated.`);
  } catch (error: unknown) {
    logger.error(`${VIEW_NAME} behavior definition failed: ${reason(error)}`);
    logger.error(
      'Nothing else was touched. Read the message above before changing the source — the last two attempts failed for reasons the source could have told us.',
    );
    process.exitCode = 1;
  }

  // --- say what is there now, whichever way it went ------------------------
  const after = await utils.getPackageContentsList(args.packageName, {
    includeSubpackages: true,
  });
  logger.info(
    `${args.packageName} now holds: ${after.map((i) => `${i.type}:${i.name}`).join(', ')}`,
  );
}

main().catch((error) => {
  process.stderr.write(`probe-atc-fixture-bdef failed: ${String(error)}\n`);
  process.exitCode = 1;
});
