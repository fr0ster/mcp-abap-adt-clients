/**
 * Does the debugger see memory change, and where do memory snapshots go?
 *
 * A class fills an internal table between two breakpoints. At each stop the
 * probe reads the debuggee's memory sizes (/debugger/memorysizes — what
 * Eclipse's "ABAP Memory (Debugger)" view shows) and takes a memory snapshot
 * (the memorySnapshot debugger action); at the end it lists the snapshots
 * ADT knows (/runtime/memory/snapshots).
 *
 * Measured before (on premise, 2026-10-09): the action answers
 * "Memory Snapshot abDbgMemory_… created … Use transaction S_MEMORY_INSPECTOR",
 * and the ADT list stays empty.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-memory.ts [--keep]
 *
 * The class is created in PROBE_PACKAGE (default: the configured package)
 * and deleted at the end unless --keep is given.
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
const CLASS_NAME = 'ZAC_DBG_MEM';
const quiet = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as ILogger;

const SOURCE = `CLASS zac_dbg_mem DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS zac_dbg_mem IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lt_rows TYPE STANDARD TABLE OF string WITH EMPTY KEY.
    DATA(lv_count) = lines( lt_rows ). "BP:before
    DO 100000 TIMES.
      APPEND |row { sy-index } { repeat( val = 'x' occ = 100 ) }| TO lt_rows.
    ENDDO.
    lv_count = lines( lt_rows ). "BP:after
    out->write( |rows { lv_count }| ).
  ENDMETHOD.
ENDCLASS.
`;

const LINE: Record<string, number> = {};
SOURCE.split('\n').forEach((text, index) => {
  const marker = /"BP:(\w+)/.exec(text);
  if (marker) LINE[marker[1]] = index + 1;
});

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function documentOf(answer: IAdtResponse<unknown>): string {
  return answer.ok
    ? String(answer.getResult().value ?? '')
    : String(answer.getError().response?.data ?? '');
}

async function raw(
  connection: IAbapConnection,
  label: string,
  method: string,
  url: string,
  accept: string,
): Promise<string> {
  try {
    const r = await connection.makeAdtRequest({
      url,
      method,
      timeout: 120_000,
      headers: { Accept: accept },
    });
    const body =
      typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? '');
    out(`   ${label}: ${r.status}`);
    out(`     ${body.replace(/\s+/g, ' ').slice(0, 1500)}`);
    return body;
  } catch (error) {
    // biome-ignore lint/suspicious/noExplicitAny: an axios-shaped error, read defensively
    const r = (error as any)?.response;
    out(
      `   ${label}: ${r?.status ?? 'no answer'} ${String(
        r?.data ?? (error as Error).message,
      )
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 400)}`,
    );
    return '';
  }
}

async function main(): Promise<void> {
  const keep = process.argv.includes('--keep');
  const packageName: string =
    process.env.PROBE_PACKAGE?.trim() || getDefaultPackage();
  const transportRequest = packageName.startsWith('$')
    ? undefined
    : getDefaultTransport() || undefined;
  const transport = transportRequest ? { transportRequest } : {};

  // --run: only run the class, for a debugger listening elsewhere (an IDE);
  // the call waits while that debugger holds the program.
  if (process.argv.includes('--run')) {
    const only = await createTestConnection(quiet, { ownSession: true });
    const t0 = Date.now();
    out(`running ${CLASS_NAME}…`);
    const ran = await new ClassExecutor(only, quiet).run({
      className: CLASS_NAME,
    });
    out(
      `returned after ${Math.round((Date.now() - t0) / 1000)} s: ${documentOf(ran).trim()}`,
    );
    await closeOwnTestConnection(only);
    return;
  }

  const listener = (await createTestConnection(quiet, {
    ownSession: true,
  })) as Connection;
  const trigger = (await createTestConnection(quiet, {
    ownSession: true,
  })) as Connection;
  let session: Connection | undefined;

  // Basic authentication names the user; with a token (the cloud) the system is asked.
  let user = String(process.env.SAP_USERNAME ?? '').toUpperCase();
  if (!user) {
    const info = await listener.makeAdtRequest({
      url: '/sap/bc/adt/core/http/systeminformation',
      method: 'GET',
      timeout: 30_000,
      headers: {
        Accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
      },
    });
    const data =
      typeof info.data === 'string' ? JSON.parse(info.data) : info.data;
    user = String(data.userName ?? '').toUpperCase();
  }
  const id = (part: string) =>
    createHash('sha256')
      .update(`${process.env.SAP_URL}:${user}:${part}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  const identity: IDebuggerIdentity = {
    requestUser: user,
    terminalId: id('terminalId'),
    ideId: id('ideId'),
  };
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Memory probe',
    ...transport,
  };
  const cls = new AdtClient(listener, quiet).getClass();
  // --take-over: displace another debugger of the user (an IDE kept open to
  // watch the snapshots).
  const onListener = new AbapDebugger(listener, quiet, abapDebuggerDocuments, {
    onConflict: process.argv.includes('--take-over') ? 'takeOver' : 'refuse',
  });
  const armed: string[] = [];

  try {
    await cls.create(config);
    const lock = await cls.lock(config);
    const handle = String(lock.ok ? lock.getResult().value : '');
    await cls.update(config, { source: SOURCE, lockHandle: handle });
    await cls.unlock(config, handle);
    const activated = await cls.activate(config);
    out(
      `${CLASS_NAME} in ${packageName}: activate ${activated.ok ? 'ok' : 'FAILED'}`,
    );
    if (!activated.ok) return;

    listener.setSessionType('stateful');
    const uri = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;
    const set = await onListener.setBreakpoints(identity, [
      { kind: 'line', uri: `${uri}#start=${LINE.before}` },
      { kind: 'line', uri: `${uri}#start=${LINE.after}` },
    ]);
    for (const m of documentOf(set).matchAll(/\bid="([^"]*)"/g))
      armed.push(m[1]);
    out(
      `breakpoints on lines ${LINE.before} and ${LINE.after}: ${armed.length} armed`,
    );

    const listening = onListener.listen(identity, { holdSeconds: 60 });
    // A refused listener answers 409 within the delay: then whoever holds the
    // user's debugging would catch the run, so it is not started.
    const early = await Promise.race([
      listening,
      new Promise<undefined>((r) => setTimeout(() => r(undefined), 2000)),
    ]);
    if (early && !early.ok) {
      out(
        `listener refused (${early.getError().response?.status}): another debugger holds ${user}'s debugging — the class is not run`,
      );
      return;
    }
    const run = new ClassExecutor(trigger, quiet).run({
      className: CLASS_NAME,
    });
    const caught = documentOf(await listening);
    const debuggeeId = /<DEBUGGEE_ID>([^<]*)</.exec(caught)?.[1];
    if (!debuggeeId) {
      out(`nothing caught: ${caught.slice(0, 300)}`);
      return;
    }

    session = (await createTestConnection(quiet, {
      ownSession: true,
    })) as Connection;
    session.setSessionType('stateful');
    const onSession = new AbapDebugger(session, quiet, abapDebuggerDocuments);
    const server = /<INSTANCE_NAME>([^<]*)</.exec(caught)?.[1];
    const attached = await onSession.attach(user, debuggeeId, { server });
    out(`attach: ${attached.ok ? 'ok' : documentOf(attached).slice(0, 300)}`);

    for (const stop of ['before', 'after'] as const) {
      const stack = documentOf(await onSession.getStack());
      out(`\n== stop "${stop}" — line ${/line="(\d+)"/.exec(stack)?.[1]}`);
      await raw(
        session,
        'memory sizes',
        'GET',
        '/sap/bc/adt/debugger/memorysizes?includeAbap=true',
        'application/vnd.sap.adt.debugger.memory.sizes.v1+xml',
      );
      await raw(
        session,
        'snapshot',
        'POST',
        '/sap/bc/adt/debugger/actions?action=memorySnapshot',
        'application/xml',
      );
      if (stop === 'before') await onSession.step('stepContinue');
    }
    // PROBE_HOLD=<seconds>: keep the debuggee suspended — and its debug
    // session open — while the snapshots are looked for elsewhere.
    const hold = Number(process.env.PROBE_HOLD ?? '0');
    for (let left = hold; left > 0; left -= 30) {
      out(`holding the debuggee: ${left} s left`);
      // Asked from another session, and from the debug session itself.
      for (const [label, from] of [
        ['list (other session)', listener],
        ['list (debug session)', session],
      ] as const) {
        await raw(
          from,
          label,
          'GET',
          `/sap/bc/adt/runtime/memory/snapshots?user=${user}`,
          'application/vnd.sap.adt.runtime.memory.snapshots.v1+xml',
        );
      }
      await new Promise((r) => setTimeout(r, Math.min(30, left) * 1000));
    }
    await onSession.step('stepContinue');
    const ran = await run;
    out(`\nrun returned: ${documentOf(ran).trim()}`);

    out('\n== ADT snapshot list');
    await raw(
      trigger,
      'list',
      'GET',
      `/sap/bc/adt/runtime/memory/snapshots?user=${user}`,
      'application/vnd.sap.adt.runtime.memory.snapshots.v1+xml',
    );
  } finally {
    for (const bp of armed) await onListener.deleteBreakpoint(identity, bp);
    await onListener.stopListener(identity);
    listener.setSessionType('stateless');
    if (!keep) await cls.delete(config);
    if (session) {
      session.setSessionType('stateless');
      await closeOwnTestConnection(session);
    }
    await closeOwnTestConnection(trigger);
    await closeOwnTestConnection(listener);
  }
}

main().catch((error) => {
  out(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
