/**
 * Objects to debug AMDP with: a class with an AMDP procedure and the AMDP
 * method of a CDS table function, and the table function's DDL.
 *
 * The class and the DDL name each other — the method is declared `FOR TABLE
 * FUNCTION <ddl>`, the DDL is `implemented by method <class>=><method>` — so
 * neither activates alone; both are written inactive and activated in one
 * group run.
 *
 * Both database methods loop in SQLScript over nothing but their own
 * variables, so there is something to step through without any table. The
 * class's `main` (IF_OO_ADT_CLASSRUN) calls the procedure and selects from
 * the table function, so one classrun enters both.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-amdp.ts --deploy
 *   ... --run      run the class once (for a debugger listening elsewhere)
 *   ... --delete   remove both objects
 *
 * AMDP needs SAP HANA. Package and transport come from the test
 * configuration (a local package takes none).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { AdtClient } from '../src/clients/AdtClient';
import { AdtUtils } from '../src/core/shared/AdtUtils';
import { utilDocuments } from '../src/core/shared/utilResultSet';
import { ClassExecutor } from '../src/executors/class/ClassExecutor';
import { wireItself } from '../src/utils/resultStrategy';

const {
  getDefaultPackage,
  getDefaultTransport,
} = require('../src/__tests__/helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const CLASS_NAME = 'ZAC_DBG_AMDP';
const DDL_NAME = 'ZAC_DBG_TF';
const quiet = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as ILogger;

const DDL_SOURCE = `@EndUserText.label: 'Debugger probe table function'
@ClientHandling.type: #CLIENT_INDEPENDENT
@AccessControl.authorizationCheck: #NOT_REQUIRED
define table function ZAC_DBG_TF
  with parameters
    p_limit : abap.int4
  returns {
    n      : abap.int4;
    square : abap.int4;
  }
  implemented by method zac_dbg_amdp=>tf;
`;

const CLASS_SOURCE = `CLASS zac_dbg_amdp DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.
    INTERFACES if_oo_adt_classrun.
    METHODS sum_to AMDP OPTIONS READ-ONLY CLIENT INDEPENDENT
      IMPORTING VALUE(iv_limit) TYPE i
      EXPORTING VALUE(ev_total) TYPE i
                VALUE(ev_steps) TYPE i.
    CLASS-METHODS tf FOR TABLE FUNCTION zac_dbg_tf.
ENDCLASS.

CLASS zac_dbg_amdp IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    sum_to( EXPORTING iv_limit = 3
            IMPORTING ev_total = DATA(lv_total)
                      ev_steps = DATA(lv_steps) ).
    SELECT * FROM zac_dbg_tf( p_limit = 3 ) INTO TABLE @DATA(lt_rows).
    out->write( |total { lv_total } steps { lv_steps } rows { lines( lt_rows ) }| ).
  ENDMETHOD.

  METHOD sum_to BY DATABASE PROCEDURE FOR HDB LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY.
    DECLARE lv_i INTEGER;
    ev_total = 0;
    ev_steps = 0;
    FOR lv_i IN 1..:iv_limit DO
      ev_total = :ev_total + :lv_i;
      ev_steps = :ev_steps + 1;
    END FOR;
  ENDMETHOD.

  METHOD tf BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY.
    DECLARE lt_rows TABLE ( n INTEGER, square INTEGER );
    DECLARE lv_i INTEGER;
    FOR lv_i IN 1..:p_limit DO
      :lt_rows.INSERT( ( :lv_i, :lv_i * :lv_i ) );
    END FOR;
    RETURN SELECT n, square FROM :lt_rows;
  ENDMETHOD.
ENDCLASS.
`;

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function verdict(answer: IAdtResponse<unknown>): string {
  if (answer.ok) return 'ok';
  const error = answer.getError();
  const body = String(error.response?.data ?? '');
  const message = /<(?:[a-z]+:)?message[^>]*>([^<]*)</.exec(body)?.[1];
  return `${error.response?.status ?? '?'} ${message ?? error.message}`;
}

function textOf(answer: IAdtResponse<unknown>): string {
  return answer.ok
    ? String(answer.getResult().value ?? '')
    : String(answer.getError().response?.data ?? '');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // PROBE_PACKAGE overrides the configured package (e.g. a local one).
  const packageName: string =
    process.env.PROBE_PACKAGE?.trim() || getDefaultPackage();
  const transportRequest: string | undefined = packageName.startsWith('$')
    ? undefined
    : getDefaultTransport() || undefined;
  const connection = await createTestConnection(quiet, { ownSession: true });
  const adt = new AdtClient(connection, quiet);
  const transport = transportRequest ? { transportRequest } : {};
  const classConfig = {
    className: CLASS_NAME,
    packageName,
    description: 'AMDP debugger probe',
    ...transport,
  };
  const ddlConfig = {
    ddlName: DDL_NAME,
    packageName,
    description: 'AMDP debugger probe table function',
    ...transport,
  };

  try {
    if (args.includes('--run')) {
      const t0 = Date.now();
      out(`running ${CLASS_NAME}…`);
      const ran = await new ClassExecutor(connection, quiet).run({
        className: CLASS_NAME,
      });
      out(
        `returned after ${Math.round((Date.now() - t0) / 1000)} s: ${ran.ok ? textOf(ran).trim() : verdict(ran)}`,
      );
      return;
    }

    if (args.includes('--delete')) {
      out(
        `delete ${CLASS_NAME}: ${verdict(await adt.getClass().delete(classConfig))}`,
      );
      out(
        `delete ${DDL_NAME}: ${verdict(await adt.getDdl().delete(ddlConfig))}`,
      );
      return;
    }

    out(
      `package ${packageName}${transportRequest ? ` on ${transportRequest}` : ''}`,
    );

    // Shells first, then the bodies: neither source compiles without the other.
    const ddl = adt.getDdl();
    out(`create ${DDL_NAME}: ${verdict(await ddl.create(ddlConfig))}`);
    const ddlLock = await ddl.lock(ddlConfig);
    if (!ddlLock.ok) throw new Error(`lock ${DDL_NAME}: ${verdict(ddlLock)}`);
    const ddlHandle = String(ddlLock.getResult().value ?? '');
    out(
      `write ${DDL_NAME}: ${verdict(await ddl.update(ddlConfig, { source: DDL_SOURCE, lockHandle: ddlHandle }))}`,
    );
    await ddl.unlock(ddlConfig, ddlHandle);

    const cls = adt.getClass();
    out(`create ${CLASS_NAME}: ${verdict(await cls.create(classConfig))}`);
    const clsLock = await cls.lock(classConfig);
    if (!clsLock.ok) throw new Error(`lock ${CLASS_NAME}: ${verdict(clsLock)}`);
    const clsHandle = String(clsLock.getResult().value ?? '');
    out(
      `write ${CLASS_NAME}: ${verdict(await cls.update(classConfig, { source: CLASS_SOURCE, lockHandle: clsHandle }))}`,
    );
    await cls.unlock(classConfig, clsHandle);

    // One group run for both.
    // The run id comes back in Location, so the activation answer is read whole.
    const utils = new AdtUtils(connection, quiet, {
      ...utilDocuments,
      activation: wireItself,
    });
    const started = await utils.activateObjectsGroup([
      { type: 'DDLS/DF', name: DDL_NAME },
      { type: 'CLAS/OC', name: CLASS_NAME },
    ]);
    const wire = started.ok ? started.getResult().value : undefined;
    const location = String(
      wire?.headers?.location ?? wire?.headers?.Location ?? '',
    );
    const runId = /runs\/([^/?]+)/.exec(location)?.[1];
    out(`activation run: ${verdict(started)} ${runId ?? '(no run id)'}`);
    if (!runId) return;

    for (let i = 0; i < 10; i++) {
      const run = await utils.getActivationRun(runId, {
        withLongPolling: true,
      });
      const status = /status="([^"]*)"/.exec(textOf(run))?.[1];
      out(`  run status: ${status ?? verdict(run)}`);
      if (status && status !== 'running' && status !== 'waiting') break;
    }
    const results = textOf(await utils.getActivationResults(runId));
    const messages = [
      ...results.matchAll(/<msg\b([^>]*)>[\s\S]*?<txt>([^<]*)<\/txt>/g),
    ].map((m) => `${/type="([^"]*)"/.exec(m[1])?.[1] ?? '?'}: ${m[2]}`);
    out(
      messages.length
        ? messages.map((m) => `  ${m}`).join('\n')
        : `  results: ${results.slice(0, 600) || '(empty)'}`,
    );
  } finally {
    await closeOwnTestConnection(connection);
  }
}

main().catch((error) => {
  out(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
