/**
 * Which query parameters does each validation endpoint actually require?
 *
 * Eleven modules build their validation request with `packagename` appended
 * only `if (packageName)`. On `/programs/validation` that was measured wrong:
 * the server answers **400, "Parameter packagename could not be found."**
 * without it, so the conditional produced a request that could only fail. The
 * question this answers is which of the other ten share that defect.
 *
 * It is one script and one session on purpose. The first attempt at this was a
 * handful of ad-hoc `curl` calls, and it was worthless twice over: it guessed
 * URLs — `class` and `interface` post to `/oo/validation/objectname`, not
 * `/oo/validation`, so the `404`s it produced said nothing about parameters —
 * and roughly fifty authenticated one-off requests each left a server session
 * behind, which emptied E19's pool and stopped the next test run dead.
 *
 * **Every case below takes its URL, Accept and parameter names from the module
 * that builds them**, not from a convention. Where a module hardcodes `objtype`
 * the same value is used here; where it sends none, none is sent.
 *
 * Method: send the full parameter set first — that is the control, and it has
 * to succeed or the case proves nothing — then send it again once per
 * parameter with that one omitted. A parameter whose absence turns the answer
 * into an error is required. Nothing is created: validation is a question.
 *
 * Usage:
 *   npx ts-node scripts/probe-validation-params.ts
 *   npx ts-node scripts/probe-validation-params.ts --package=TEST_MCP --out=validation-probe
 *
 * Writes `DIR/manifest.json` and one raw body per request, and prints the
 * matrix. Exit code is 1 only if the probe could not ask at all.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { DefaultLogger } from '@mcp-abap-adt/logger';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  getConfig,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { refuseWhileRunOwnsSession } from '../src/__tests__/helpers/sharedSession';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const ACCEPT_VALIDATION = 'application/vnd.sap.as+xml';
const ACCEPT_VALIDATION_CLASS_NAME =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check';

const TIMEOUT = 60_000;

interface ICase {
  /** The module whose `validation.ts` this mirrors. */
  module: string;
  url: string;
  accept: string;
  /**
   * Every parameter that module sends, with a value valid for the type. The
   * package is filled in at run time; `description` is included because
   * several modules already treat it as mandatory and send `''` rather than
   * omitting it, which is itself a claim worth testing.
   */
  params: Record<string, string>;
}

function cases(pkg: string): ICase[] {
  const d = 'probe validation';
  return [
    {
      module: 'program (control, already fixed)',
      url: '/sap/bc/adt/programs/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objname: 'ZAC_VP_PROG01',
        objtype: 'PROG/P',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'class',
      url: '/sap/bc/adt/oo/validation/objectname',
      accept: ACCEPT_VALIDATION_CLASS_NAME,
      params: {
        objname: 'ZAC_VP_CLS01',
        objtype: 'CLAS/OC',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'behaviorImplementation',
      url: '/sap/bc/adt/oo/validation/objectname',
      accept: ACCEPT_VALIDATION_CLASS_NAME,
      params: {
        objname: 'ZAC_VP_BIMP01',
        objtype: 'CLAS/OC',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'interface',
      url: '/sap/bc/adt/oo/validation/objectname',
      accept: ACCEPT_VALIDATION_CLASS_NAME,
      params: {
        objname: 'ZAC_VP_IF01',
        objtype: 'INTF/OI',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'dataElement',
      url: '/sap/bc/adt/ddic/dataelements/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objtype: 'dtel',
        objname: 'ZAC_VP_DTEL01',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'ddl',
      url: '/sap/bc/adt/ddic/ddl/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objtype: 'ddls',
        objname: 'ZAC_VP_DDLS01',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'domain',
      url: '/sap/bc/adt/ddic/domains/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objtype: 'doma',
        objname: 'ZAC_VP_DOM01',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'functionGroup',
      url: '/sap/bc/adt/functions/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objtype: 'FUGR/F',
        objname: 'ZAC_VP_FGR01',
        packagename: pkg,
        description: d,
      },
    },
    {
      // No objtype: the endpoint is the type.
      module: 'accessControl',
      url: '/sap/bc/adt/acm/dcl/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objname: 'ZAC_VP_AC01',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'authorizationField',
      url: '/sap/bc/adt/aps/iam/auth/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objname: 'ZAC_VP_AF01',
        packagename: pkg,
        description: d,
      },
    },
    {
      module: 'transformation',
      url: '/sap/bc/adt/xslt/validation',
      accept: ACCEPT_VALIDATION,
      params: {
        objname: 'ZAC_VP_XSLT01',
        packagename: pkg,
        description: d,
      },
    },
  ];
}

interface IAttempt {
  module: string;
  url: string;
  /** Which parameter was left out, or null for the full-set control. */
  omitted: string | null;
  sent: Record<string, string>;
  status: number | null;
  /** The server's own words, which name the missing parameter. */
  message?: string;
  checkResult?: string;
  bodyFile: string;
}

/** ADT puts the reason in `<message>`; the success marker is CHECK_RESULT. */
function firstMessage(body: string): string | undefined {
  return body.match(/<message[^>]*>([^<]*)</)?.[1];
}
function checkResult(body: string): string | undefined {
  return body.match(/<CHECK_RESULT>([^<]*)</)?.[1];
}

async function ask(
  connection: IAbapConnection,
  outDir: string,
  n: number,
  c: ICase,
  omitted: string | null,
  logger: ILogger,
  override?: Record<string, string>,
): Promise<IAttempt> {
  const sent: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.params)) {
    if (k !== omitted) sent[k] = override && k in override ? override[k] : v;
  }
  const query = new URLSearchParams(sent).toString();

  let status: number | null = null;
  let body = '';
  try {
    const response = await connection.makeAdtRequest({
      url: `${c.url}?${query}`,
      method: 'POST',
      timeout: TIMEOUT,
      headers: { Accept: c.accept },
    });
    status = response.status;
    body =
      typeof response.data === 'string'
        ? response.data
        : String(response.data ?? '');
  } catch (error: unknown) {
    const e = error as {
      response?: { status?: number; data?: unknown };
    };
    status = e.response?.status ?? null;
    const data = e.response?.data;
    body = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
  }

  const label = omitted ?? (override ? 'empty-description' : 'full');
  const bodyFile = `${String(n).padStart(2, '0')}-${c.module.split(' ')[0]}-${label}.xml`;
  fs.writeFileSync(path.join(outDir, bodyFile), body, 'utf8');

  const attempt: IAttempt = {
    module: c.module,
    url: c.url,
    omitted,
    sent,
    status,
    message: firstMessage(body),
    checkResult: checkResult(body),
    bodyFile,
  };
  logger.info(
    `  ${label.replace('full', 'full set').padEnd(18)} → ${String(status).padEnd(4)} ${
      attempt.checkResult
        ? `CHECK_RESULT=${attempt.checkResult}`
        : (attempt.message ?? '')
    }`,
  );
  return attempt;
}

function parseArgs(argv: string[]): { pkg?: string; out: string } {
  let pkg: string | undefined;
  let out = 'validation-probe';
  for (const a of argv) {
    if (a.startsWith('--package=')) pkg = a.slice('--package='.length);
    else if (a.startsWith('--out=')) out = a.slice('--out='.length);
  }
  return { pkg, out };
}

async function main(): Promise<void> {
  refuseWhileRunOwnsSession();

  const logger: ILogger = new DefaultLogger();
  const args = parseArgs(process.argv.slice(2));
  const pkg = args.pkg ?? process.env.SAP_PACKAGE ?? 'TEST_MCP';

  const outDir = path.resolve(process.cwd(), args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const sapConfig = getConfig();
  const connection = await createTestConnection(createConnectionLogger());
  try {
    await connection.connect();
    logger.info(`Connected to ${sapConfig.url}; package ${pkg}`);

    const attempts: IAttempt[] = [];
    let n = 0;

    for (const c of cases(pkg)) {
      logger.info(`${c.module} — POST ${c.url}`);
      n += 1;
      const full = await ask(connection, outDir, n, c, null, logger);
      attempts.push(full);
      for (const key of Object.keys(c.params)) {
        n += 1;
        attempts.push(await ask(connection, outDir, n, c, key, logger));
      }
      // Sent, but empty. Three modules pass `description || ''` rather than
      // omitting it, so this — not the omission above — is the request a caller
      // who gave no description actually produces.
      if ('description' in c.params) {
        n += 1;
        attempts.push(
          await ask(connection, outDir, n, c, null, logger, {
            description: '',
          }),
        );
      }
    }

    fs.writeFileSync(
      path.join(outDir, 'manifest.json'),
      JSON.stringify(
        { system: sapConfig.url, package: pkg, attempts },
        null,
        2,
      ),
      'utf8',
    );

    // The matrix, which is the point. A parameter is required when leaving it out
    // stops the endpoint answering the way the full set did.
    logger.info('');
    logger.info('module                          required parameters');
    for (const c of cases(pkg)) {
      const mine = attempts.filter((a) => a.module === c.module);
      const control = mine.find((a) => a.omitted === null);
      const required = mine
        .filter((a) => a.omitted !== null && a.status !== control?.status)
        .map((a) => a.omitted);
      logger.info(
        `${c.module.padEnd(31)} ${
          control?.status === 200
            ? required.length
              ? required.join(', ')
              : '(none — all optional)'
            : `control did not succeed (${control?.status}) — case proves nothing`
        }`,
      );
    }
  } finally {
    // In `finally`. A probe that throws part way through still owes the
    // session back: it was released on the success path only, so exactly the
    // run that fails — the one worth repeating — left one behind.
    await releaseTestConnection(connection);
  }
  logger.info(`Evidence written to ${outDir}`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`probe-validation-params failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
