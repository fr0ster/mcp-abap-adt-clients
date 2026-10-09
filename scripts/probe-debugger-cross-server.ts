/**
 * Where must the attach go when the debuggee runs on another application
 * server?
 *
 * On a landscape with several application servers (the cloud's pods), the
 * listener's answer says whether the debuggee runs where the listener's
 * session lives (`IS_SAME_SERVER`). Measured on the cloud (2026-10-09): an
 * attach sent on the listener's own connection fails 500 `invalidDebuggee`
 * whenever `IS_SAME_SERVER` is false, although `CAN_ADT_CROSS_SERVER` is true.
 *
 * The question here: does an attach sent on a NEW connection — a session of
 * its own, opened after the catch, as a debugger with separate listener and
 * debug sessions would — succeed where the listener's own one fails? Each
 * round: listen on L, run on T, then attach on a fresh A; if A is refused,
 * attach on L too, for comparison. Then the debuggee is let go.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-debugger-cross-server.ts [rounds] [--take-over]
 *   ... --deploy   only create and activate the class, and leave it
 *   ... --run      only run the class once (for a debugger listening elsewhere)
 *
 * Package and transport come from the test configuration; the probe class is
 * created, and deleted at the end.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { AdtClient } from '../src/clients/AdtClient';
import { ClassExecutor } from '../src/executors/class/ClassExecutor';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../src/runtime/debugger/AbapDebugger';
import type { IDebuggerIdentity } from '../src/runtime/debugger/contracts';

const {
  getDefaultPackage,
  getDefaultTransport,
} = require('../src/__tests__/helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

type Connection = IAbapConnection & ISessionLifecycleAware;
const CLASS_NAME = 'ZAC_DBG_XSRV';
const quiet = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as ILogger;

const SOURCE = `CLASS zac_dbg_xsrv DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS zac_dbg_xsrv IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lv_total TYPE i.
    lv_total = lv_total + 1.
    out->write( |total { lv_total }| ).
  ENDMETHOD.
ENDCLASS.
`;
const BREAK_LINE =
  SOURCE.split('\n').findIndex((l) => l.includes('lv_total + 1')) + 1;

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

function documentOf(answer: IAdtResponse<unknown>): string {
  return answer.ok
    ? String(answer.getResult().value ?? '')
    : String(answer.getError().response?.data ?? '');
}

function verdict(answer: IAdtResponse<unknown>): string {
  if (answer.ok) return 'ok';
  const body = documentOf(answer);
  return `${answer.getError().response?.status ?? '?'} ${/subType">([^<]*)</.exec(body)?.[1] ?? answer.getError().message}`;
}

async function stateful(): Promise<Connection> {
  const c = await createTestConnection(quiet, { ownSession: true });
  c.setSessionType('stateful');
  return c;
}

async function release(c: Connection | undefined): Promise<void> {
  if (!c) return;
  c.setSessionType('stateless');
  await closeOwnTestConnection(c);
}

async function abapUser(c: IAbapConnection): Promise<string> {
  if (process.env.SAP_USERNAME?.trim()) return process.env.SAP_USERNAME.trim();
  const r = await c.makeAdtRequest({
    url: '/sap/bc/adt/core/http/systeminformation',
    method: 'GET',
    timeout: 30_000,
    headers: {
      Accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
    },
  });
  const info = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  return String(info.userName);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // --take-over: our listener displaces another debugger of the user (an IDE).
  const takeOver = args.includes('--take-over');
  const rounds = Number(args.find((a) => /^\d+$/.test(a)) ?? '6');
  const packageName: string = getDefaultPackage();
  const transportRequest: string | undefined = packageName.startsWith('$')
    ? undefined
    : getDefaultTransport() || undefined;

  // --run: one run of the class and nothing else — no listener of ours, so a
  // debugger listening elsewhere (an IDE) catches it. Waits until released.
  if (args.includes('--run')) {
    const T = await createTestConnection(quiet, { ownSession: true });
    const t0 = Date.now();
    out(`running ${CLASS_NAME}…`);
    const ran = await new ClassExecutor(T, quiet).run({
      className: CLASS_NAME,
    });
    out(
      `returned after ${Math.round((Date.now() - t0) / 1000)} s: ${ran.ok ? documentOf(ran).trim() : verdict(ran)}`,
    );
    await closeOwnTestConnection(T);
    return;
  }

  const setup = await createTestConnection(quiet, { ownSession: true });
  const user = (await abapUser(setup)).toUpperCase();
  const id = (suffix: string) =>
    createHash('sha256')
      .update(`${process.env.SAP_URL}:${user}:${suffix}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  const identity: IDebuggerIdentity = {
    requestUser: user,
    terminalId: id('terminalId'),
    ideId: id('ideId'),
  };
  out(
    `user ${user}, package ${packageName}${transportRequest ? ` on ${transportRequest}` : ''}, ${rounds} rounds`,
  );

  const cls = new AdtClient(setup, quiet).getClass();
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Debugger cross-server probe',
    ...(transportRequest ? { transportRequest } : {}),
  };
  await cls.create(config);
  const lock = await cls.lock(config);
  const lockHandle = String(lock.ok ? lock.getResult().value : '');
  await cls.update(config, { source: SOURCE, lockHandle });
  await cls.unlock(config, lockHandle);
  out(
    `probe ${CLASS_NAME} activate: ${(await cls.activate(config)).ok ? 'ok' : 'FAILED'}`,
  );

  // --deploy: leave the class in place for a breakpoint set elsewhere (an IDE).
  if (args.includes('--deploy')) {
    out(`${CLASS_NAME} stays in ${packageName}; breakpoint line ${BREAK_LINE}`);
    await closeOwnTestConnection(setup);
    return;
  }

  const armer = new AbapDebugger(setup, quiet, abapDebuggerDocuments);
  setup.setSessionType('stateful');
  const armed = await armer.setBreakpoints(identity, [
    {
      kind: 'line',
      uri: `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main#start=${BREAK_LINE}`,
    },
  ]);
  const bpId = /\bid="([^"]*)"/.exec(documentOf(armed))?.[1];
  out(`breakpoint at line ${BREAK_LINE}: ${bpId ?? verdict(armed)}`);

  const tally = { same: { a: 0, l: 0, n: 0 }, other: { a: 0, l: 0, n: 0 } };
  try {
    for (let round = 1; round <= rounds; round++) {
      let L: Connection | undefined;
      let A: Connection | undefined;
      let T: Connection | undefined;
      try {
        L = await stateful();
        T = await createTestConnection(quiet, { ownSession: true });
        const onL = new AbapDebugger(L, quiet, abapDebuggerDocuments, {
          onConflict: takeOver ? 'takeOver' : 'refuse',
        });
        const listening = onL.listen(identity, { holdSeconds: 30 });
        await new Promise((r) => setTimeout(r, 2000));
        const running = new ClassExecutor(T, quiet).run({
          className: CLASS_NAME,
        });
        const caught = await listening;
        const doc = documentOf(caught);
        const debuggeeId = tag(doc, 'DEBUGGEE_ID');
        if (!debuggeeId) {
          out(`round ${round}: nothing caught (${verdict(caught)})`);
          await running;
          continue;
        }
        const same = tag(doc, 'IS_SAME_SERVER') === 'true';
        const server = `${tag(doc, 'INSTANCE_NAME')} (${tag(doc, 'HOST')})`;

        A = await stateful();
        const onA = new AbapDebugger(A, quiet, abapDebuggerDocuments);
        // Routed to the debuggee's server, as Eclipse does (saplb).
        const instance = tag(doc, 'INSTANCE_NAME');
        const viaA = await onA.attach(user, debuggeeId, { server: instance });
        let viaL: IAdtResponse<unknown> | undefined;
        if (!viaA.ok) viaL = await onL.attach(user, debuggeeId);

        const bucket = same ? tally.same : tally.other;
        bucket.n++;
        if (viaA.ok) bucket.a++;
        if (viaL?.ok) bucket.l++;
        out(
          `round ${round}: debuggee on ${server} same=${same} — attach on a new session routed by saplb: ${verdict(viaA)}${viaL ? `; on the listener's: ${verdict(viaL)}` : ''}`,
        );

        const holder = viaA.ok ? onA : viaL?.ok ? onL : undefined;
        if (holder) await holder.step('stepContinue');
        await Promise.race([
          running,
          new Promise((r) => setTimeout(r, 35_000)),
        ]);
      } finally {
        await release(A);
        await release(L);
        await closeOwnTestConnection(T);
      }
    }
  } finally {
    if (bpId) await armer.deleteBreakpoint(identity, bpId);
    await armer.stopListener(identity);
    setup.setSessionType('stateless');
    await cls.delete(config);
    await closeOwnTestConnection(setup);
  }

  out();
  out(
    `same server : ${tally.same.n} caught, attached on a new session ${tally.same.a}, on the listener's ${tally.same.l}`,
  );
  out(
    `other server: ${tally.other.n} caught, attached on a new session ${tally.other.a}, on the listener's ${tally.other.l}`,
  );
}

main().catch((error) => {
  out(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
