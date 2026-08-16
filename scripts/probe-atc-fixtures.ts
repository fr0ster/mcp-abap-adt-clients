/**
 * Create the objects the ATC probe needs, so `AtcObjectType` can be measured.
 *
 * `scripts/probe-atc.ts` measures which object types ATC will check by running
 * one representative of each. It can only measure the types a package actually
 * holds, and it exits non-zero naming the ones it could not reach. This script
 * makes those representatives.
 *
 * **It creates objects in a real SAP system.** The target package is named on
 * the command line or defaults to `ZBASE_PROBE01`, and every object carries a
 * prefix so it is obvious where it came from.
 *
 * What it makes, in dependency order — the table must be active before the CDS
 * view over it compiles, and the view before the behavior definition on it:
 *
 *   ZOK_IF_PROBE   interface            INTF/OI
 *   ZOK_T_PROBE    table                TABL/DT
 *   ZOK_I_PROBE    CDS view entity      DDLS/DF   (over the table, root)
 *   ZOK_I_PROBE    behavior definition  BDEF/BDO  (over the CDS root view)
 *   ZOK_R_PROBE    program              PROG/P
 *   ZOK_N_PROBE    include              PROG/I
 *   ZOK_FG_PROBE   function group       FUGR/F
 *
 * `PROG/P` and `PROG/I` are refused on ABAP Cloud — classic programs are not
 * part of the cloud development model. A refusal is not a failure of this
 * script: it is the finding that those types cannot be measured on this system
 * at all, and it is reported as such rather than retried or worked around.
 *
 * ## Why this uses `BaseTester` rather than calling the handlers
 *
 * Creating an object is not one request. It is
 * **validate → create → lock → check → update → unlock → activate**, with
 * per-type nuances, and `create` alone leaves a *shell*: passing `sourceCode`
 * (or `ddlCode`, or `ddlSource`) to it does not put the source in the object.
 * An earlier version of this script called `create` and believed it, and left
 * behind an interface with no method, a CDS view with an empty source and a
 * behavior definition holding `unmanaged; define behavior … {}` — none of which
 * was what the script reported, and all of which ATC would have been asked
 * about.
 *
 * That chain is already implemented, tested and maintained in
 * `src/__tests__/helpers/BaseTester.ts`, which every integration test uses.
 * This script uses the same one. `skip_cleanup` keeps the objects afterwards,
 * which is the one thing it wants differently from a test.
 *
 * Usage:
 *   MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/trial.env \
 *     npx ts-node scripts/probe-atc-fixtures.ts --package=ZBASE_PROBE01
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

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const IF_NAME = 'ZOK_IF_PROBE';
const TABLE_NAME = 'ZOK_T_PROBE';
const VIEW_NAME = 'ZOK_I_PROBE';
const PROGRAM_NAME = 'ZOK_R_PROBE';
const INCLUDE_NAME = 'ZOK_N_PROBE';
const FUGR_NAME = 'ZOK_FG_PROBE';

const INTERFACE_SOURCE = `INTERFACE ${IF_NAME.toLowerCase()} PUBLIC.
  METHODS probe RETURNING VALUE(result) TYPE string.
ENDINTERFACE.`;

const TABLE_SOURCE = `@EndUserText.label : 'ATC probe table'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table ${TABLE_NAME.toLowerCase()} {
  key client : abap.clnt not null;
  key id     : abap.char(10) not null;
  name       : abap.char(30);
}`;

const VIEW_SOURCE = `@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'ATC probe view'
define root view entity ${VIEW_NAME}
  as select from ${TABLE_NAME.toLowerCase()}
{
  key id   as Id,
      name as Name
}`;

// `managed;` with no implementation class: nothing here needs implementing, and
// naming a class that does not exist gives an object that creates fine and
// never activates — worse than useless for a probe, since ATC would then be
// asked about something inactive.
// No create/update/delete: SAP refuses `managed` with write operations unless
// an implementation class is named, and naming one that does not exist gives an
// object that never activates. A read-only behavior needs no implementation and
// is a real BDEF, which is all ATC has to be asked about.
const BDEF_SOURCE = `managed;
strict ( 2 );

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

const PROGRAM_SOURCE = `REPORT ${PROGRAM_NAME.toLowerCase()}.

DATA text TYPE string.
text = 'ATC probe'.`;

const INCLUDE_SOURCE = `*&---------------------------------------------------------------------*
*& Include ${INCLUDE_NAME}
*&---------------------------------------------------------------------*
DATA probe_value TYPE string.`;

interface IOutcome {
  name: string;
  type: string;
  /**
   * `refused` means the system said no — a finding about the type.
   * `not attempted` means the request never got a verdict (a dropped
   * connection). Collapsing the two would report an infrastructure problem as
   * "this type cannot exist here", which is how a probe lies.
   */
  action: 'made' | 'refused' | 'not attempted';
  detail?: string;
}

/** Did the request fail before the server could judge it? */
function isTransportFailure(error: unknown, detail: string): boolean {
  const e = error as { response?: { status?: number } };
  if (e.response?.status) return false; // the server answered — that is a verdict
  return /ECONN|ETIMEDOUT|socket|network/i.test(detail);
}

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

/** The message worth printing from whatever the chain threw. */
function reason(error: unknown): string {
  const e = error as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const status = e.response?.status;
  const body = typeof e.response?.data === 'string' ? e.response.data : '';
  // ADT puts the useful sentence in <message>; the rest is namespaces.
  const message = body.match(/<message[^>]*>([^<]+)<\/message>/)?.[1];
  return [status ? `HTTP ${status}` : null, message ?? e.message]
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
  logger.info(
    `Making ATC probe fixtures in package ${args.packageName}${
      args.transportRequest ? ` (transport ${args.transportRequest})` : ''
    }`,
  );

  const client = new AdtClient(connection, logger);
  const outcomes: IOutcome[] = [];

  const common = {
    packageName: args.packageName,
    ...(args.transportRequest
      ? { transportRequest: args.transportRequest }
      : {}),
  };

  /**
   * Run one object through the full creation chain.
   *
   * `flowTest` is validate → create → lock → check → update → unlock →
   * activate, the same path the integration tests take. `skip_cleanup` is the
   * one deviation: a test deletes what it made, and these have to survive for
   * the probe to run against them.
   */
  const make = async (
    name: string,
    type: string,
    // biome-ignore lint/suspicious/noExplicitAny: one tester per object type
    handler: any,
    label: string,
    config: Record<string, unknown>,
    /** The object's own source, where it has one. */
    source?: string,
  ): Promise<void> => {
    logger.info(`--- ${type} ${name}`);

    // Delete first, as the integration tests do: `flowTest` starts with create,
    // and create refuses an object that already exists. The alternative —
    // skipping what is there — is what left half-made objects in place, since
    // "it exists" says nothing about what is in it.
    try {
      await handler.delete({ ...config });
      logger.info(`${name} existed and was deleted, so it can be remade whole`);
    } catch {
      // Absent, or not deletable this way. Either is fine; create decides.
    }

    const tester = new BaseTester(
      handler,
      label,
      `atc_probe_${label}`,
      name,
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
      // The source has to travel twice, and the integration tests do the same:
      // `sourceCode` is the flow option the update step reads, and
      // `updateConfig` is what reaches the handler — which wants it under its
      // own key (`ddlSource`, `ddlCode`, `sourceCode`). Passing the config
      // alone leaves the update writing nothing, which is how a table came
      // back as its own template and a CDS view came back empty while the
      // script reported both as made.
      await tester.flowTest(
        // biome-ignore lint/suspicious/noExplicitAny: per-type config shapes
        config as any,
        { skip_cleanup: true },
        source
          ? // biome-ignore lint/suspicious/noExplicitAny: per-type config shapes
            { sourceCode: source, updateConfig: config as any }
          : undefined,
      );
      logger.info(`${name} made and activated`);
      outcomes.push({ name, type, action: 'made' });
    } catch (error: unknown) {
      const detail = reason(error);
      const transport = isTransportFailure(error, detail);
      logger.warn(
        `${name} ${transport ? 'could not be attempted' : 'refused'}: ${detail}`,
      );
      outcomes.push({
        name,
        type,
        action: transport ? 'not attempted' : 'refused',
        detail,
      });
    }
  };

  await make(
    IF_NAME,
    'INTF/OI',
    client.getInterface(),
    'Interface',
    {
      ...common,
      interfaceName: IF_NAME,
      description: 'ATC probe interface',
      sourceCode: INTERFACE_SOURCE,
    },
    INTERFACE_SOURCE,
  );

  await make(
    TABLE_NAME,
    'TABL/DT',
    client.getTable(),
    'Table',
    {
      ...common,
      tableName: TABLE_NAME,
      description: 'ATC probe table',
      ddlCode: TABLE_SOURCE,
    },
    TABLE_SOURCE,
  );

  await make(
    VIEW_NAME,
    'DDLS/DF',
    client.getDdl(),
    'View',
    {
      ...common,
      ddlName: VIEW_NAME,
      description: 'ATC probe view',
      ddlSource: VIEW_SOURCE,
    },
    VIEW_SOURCE,
  );

  await make(
    VIEW_NAME,
    'BDEF/BDO',
    client.getBehaviorDefinition(),
    'BehaviorDefinition',
    {
      ...common,
      name: VIEW_NAME,
      description: 'ATC probe behavior',
      implementationType: 'Managed',
      rootEntity: VIEW_NAME,
      sourceCode: BDEF_SOURCE,
    },
    BDEF_SOURCE,
  );

  await make(FUGR_NAME, 'FUGR/F', client.getFunctionGroup(), 'FunctionGroup', {
    ...common,
    functionGroupName: FUGR_NAME,
    description: 'ATC probe function group',
  });

  // The two below are the cloud development model's blind spot. Asked anyway,
  // because "refused" is the answer AtcObjectType needs — and since 4.0.0 of
  // the connector that refusal arrives as the 403 it is, naming S_DEVELOP,
  // rather than as a claim that the token expired.
  const program = client.getProgram();
  await make(
    PROGRAM_NAME,
    'PROG/P',
    program,
    'Program',
    {
      ...common,
      programName: PROGRAM_NAME,
      description: 'ATC probe report',
      programType: 'executable',
      sourceCode: PROGRAM_SOURCE,
    },
    PROGRAM_SOURCE,
  );

  await make(
    INCLUDE_NAME,
    'PROG/I',
    program,
    'Include',
    {
      ...common,
      programName: INCLUDE_NAME,
      description: 'ATC probe include',
      programType: 'include',
      sourceCode: INCLUDE_SOURCE,
    },
    INCLUDE_SOURCE,
  );

  logger.info('');
  logger.info('=== fixtures ===');
  for (const o of outcomes) {
    logger.info(
      `${o.type.padEnd(9)} ${o.name.padEnd(14)} ${o.action}${o.detail ? ` — ${o.detail}` : ''}`,
    );
  }
  // An authorization refusal is a fact about the type: this system will not
  // hold one. Anything else is a fact about this attempt — a name in the way, a
  // source the checker rejected — and saying "cannot exist here" about it would
  // be reading a local failure as a system limit. An earlier version of this
  // summary did exactly that with "already exists".
  const unauthorized = outcomes.filter(
    (o) => o.action === 'refused' && /403|not authorized/i.test(o.detail ?? ''),
  );
  const otherwiseRefused = outcomes.filter(
    (o) => o.action === 'refused' && !unauthorized.includes(o),
  );
  if (unauthorized.length) {
    logger.warn(
      `The system will not hold ${unauthorized.length} type(s): ${unauthorized.map((o) => o.type).join(', ')}. That is a finding — ATC cannot check here what cannot exist here.`,
    );
  }
  if (otherwiseRefused.length) {
    logger.error(
      `${otherwiseRefused.length} type(s) failed for a reason that is about this attempt, not about the type: ${otherwiseRefused.map((o) => `${o.type} (${o.detail})`).join('; ')}. Nothing is proven about them.`,
    );
    process.exitCode = 1;
  }
  const stalled = outcomes.filter((o) => o.action === 'not attempted');
  if (stalled.length) {
    logger.warn(
      `${stalled.length} type(s) never got a verdict: ${stalled.map((o) => o.type).join(', ')}. Nothing was learned about them — re-run.`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`probe-atc-fixtures failed: ${String(error)}\n`);
  process.exitCode = 1;
});
