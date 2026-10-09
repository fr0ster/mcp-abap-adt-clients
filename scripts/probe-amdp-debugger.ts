/**
 * One AMDP debug cycle on the raw protocol, as Eclipse ADT sends it.
 *
 * The AMDP debugger is not the ABAP one: no listener, no attach, nothing on
 * /sap/bc/adt/debugger. Read from Eclipse's ABAP Communication Log on premise
 * (S/4HANA, 2026-10-09):
 *
 * - a stateful session starts it: `POST /amdp/debugger/main?stopExisting=…
 *   &requestUser=…&cascadeMode=NONE`, answered with `Location: …/main/{mainId}`
 *   and the HANA session id;
 * - every command — breakpoint sync, a step, the stop — goes from another
 *   session and is answered at once with `Location: {requestId}` only;
 * - what the commands did arrives as events: `GET /amdp/debugger/main/{mainId}`
 *   on the starting session waits until there is one and answers a
 *   `mainResponseList` — `SYNC_BREAKPOINTS`, `ON_BREAK` (position, variables,
 *   call stack), `STOP`.
 *
 * Breakpoints are the debug session's, given as the class's source URI with
 * `#start=<line>` of a SQLScript statement; this probe finds the lines in the
 * class's source as the system has it.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-amdp-debugger.ts
 *   PROBE_FINISH=1     at the first break: clear the breakpoints and continue
 *   PROBE_RELEASE=1    at the first break: delete the debuggee (cancels it)
 *   PROBE_HARD_STOP=1  at the first break: stop the session with hardStop=true
 *
 * The class (scripts/probe-amdp.ts --deploy) must exist and be active.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { ClassExecutor } from '../src/executors/class/ClassExecutor';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

type Connection = IAbapConnection & ISessionLifecycleAware;
const CLASS_NAME = 'ZAC_DBG_AMDP';
const AMDP = '/sap/bc/adt/amdp/debugger/main';
const MAIN_ACCEPT = [4, 3, 2, 1]
  .map((v) => `application/vnd.sap.adt.amdp.dbg.main.v${v}+xml`)
  .join(', ');
const STEPS_OVER = Number(process.env.PROBE_STEPS ?? '4');
const VERBOSE = process.env.PROBE_VERBOSE === '1';
const quiet = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as ILogger;

const started = Date.now();
function out(line = ''): void {
  const s = ((Date.now() - started) / 1000).toFixed(1).padStart(6);
  process.stdout.write(`${s}s  ${line}\n`);
}

interface IAnswer {
  status: number;
  headers: Record<string, unknown>;
  data: string;
}

async function send(
  label: string,
  connection: IAbapConnection,
  options: IAbapRequestOptions,
): Promise<IAnswer> {
  const t0 = Date.now();
  let answer: IAnswer;
  try {
    const r = await connection.makeAdtRequest(options);
    answer = {
      status: r.status,
      headers: r.headers as Record<string, unknown>,
      data: typeof r.data === 'string' ? r.data : String(r.data ?? ''),
    };
  } catch (error) {
    // biome-ignore lint/suspicious/noExplicitAny: an axios-shaped error, read defensively
    const r = (error as any)?.response;
    answer = {
      status: r?.status ?? 0,
      headers: r?.headers ?? {},
      data: String(r?.data ?? (error as Error).message),
    };
  }
  out(
    `${label.padEnd(12)} ${options.method} ${options.url.replace(AMDP, '…/main')} → ${answer.status} in ${Date.now() - t0} ms`,
  );
  if (VERBOSE && answer.data) out(`             ${answer.data.slice(0, 1500)}`);
  return answer;
}

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function decode(text: string): string {
  return text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

interface IEvent {
  kind: string;
  requestId: string;
  debuggeeId: string;
  body: string;
}

function events(xml: string): IEvent[] {
  return [
    ...xml.matchAll(
      /<amdpdbg:mainResponse\b([^>]*)>([\s\S]*?)<\/amdpdbg:mainResponse>/g,
    ),
  ].map((m) => ({
    kind: attr(m[1], 'amdpdbg:kind') ?? '?',
    requestId: attr(m[1], 'amdpdbg:requestId') ?? '',
    debuggeeId: attr(m[1], 'amdpdbg:debuggeeId') ?? '',
    body: m[2],
  }));
}

/** A stop drawn: where in ABAP and in HANA, and every variable by scope. */
function showBreak(event: IEvent, source: string[]): void {
  const abap = /<amdpdbg:abapPosition\b[^>]*>/.exec(event.body)?.[0] ?? '';
  const native = /<amdpdbg:nativePosition\b[^>]*>/.exec(event.body)?.[0] ?? '';
  const line = Number(
    /#start=(\d+)/.exec(attr(abap, 'adtcore:uri') ?? '')?.[1],
  );
  out(
    `   ON_BREAK in ${decode(attr(abap, 'amdpdbg:procedureName') ?? '?')} — class line ${line}, HANA line ${attr(native, 'amdpdbg:line')}`,
  );
  if (line) out(`     ➜ ${line} │${source[line - 1] ?? ''}`);
  for (const v of event.body.matchAll(
    /<amdpdbg:variable\b([^>]*?)(?:\/>|>([\s\S]*?)<\/amdpdbg:variable>)/g,
  )) {
    const scope = attr(v[1], 'amdpdbg:scope');
    if (scope === 'system' && !VERBOSE) continue;
    const isNull = attr(v[1], 'amdpdbg:isNullValue') === 'true';
    const table = Number(attr(v[1], 'amdpdbg:tableLength') ?? '0');
    const value = isNull ? 'NULL' : decode(v[2] ?? '');
    out(
      `     ${String(scope).padEnd(7)} ${String(attr(v[1], 'amdpdbg:name')).padEnd(12)} ${String(attr(v[1], 'amdpdbg:type')).padEnd(10)} ${value}${table ? ` (table, ${table} rows, handle ${attr(v[1], 'amdpdbg:tableHandle')})` : ''}`,
    );
  }
}

async function main(): Promise<void> {
  const M = (await createTestConnection(quiet, {
    ownSession: true,
  })) as Connection;
  const C = (await createTestConnection(quiet, {
    ownSession: true,
  })) as Connection;
  const T = (await createTestConnection(quiet, {
    ownSession: true,
  })) as Connection;
  const user = String(process.env.SAP_USERNAME ?? '').toUpperCase();
  let mainId: string | undefined;
  let run: Promise<unknown> | undefined;
  let hardStop = false;

  try {
    // Where to break: lines of SQLScript statements in the class as it is.
    const read = await send('source', C, {
      url: `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`,
      method: 'GET',
      timeout: 30_000,
      headers: { Accept: 'text/plain' },
    });
    const source = read.data.split(/\r?\n/);
    const lineOf = (needle: string) =>
      source.findIndex((l) => l.includes(needle)) + 1;
    const loopLine = lineOf('ev_total = :ev_total + :lv_i');
    const tfLine = lineOf(':lt_rows.INSERT');
    out(`breakpoints: SUM_TO loop line ${loopLine}, TF loop line ${tfLine}`);

    // The debug session: stateful, started here, and every event read here.
    M.setSessionType('stateful');
    const start = await send('start', M, {
      url: `${AMDP}?${new URLSearchParams({ stopExisting: 'false', requestUser: user, cascadeMode: 'NONE' })}`,
      method: 'POST',
      timeout: 60_000,
      headers: { Accept: 'application/vnd.sap.adt.amdp.dbg.startmain.v1+xml' },
    });
    const location = String(
      start.headers.location ?? start.headers.Location ?? '',
    );
    mainId = /\/main\/([^/?]+)/.exec(location)?.[1];
    out(
      `   main ${mainId ?? '(none)'}, HANA session ${attr(start.data, 'amdpdbg:value') ?? '?'}`,
    );
    if (!mainId) {
      out(`   ${start.data.slice(0, 800)}`);
      return;
    }
    const mainUrl = `${AMDP}/${mainId}`;
    const nextEvents = async (label: string): Promise<IEvent[]> => {
      const answer = await send(label, M, {
        url: mainUrl,
        method: 'GET',
        timeout: 180_000,
        headers: { Accept: MAIN_ACCEPT },
      });
      const list = events(answer.data);
      if (answer.status !== 200 || list.length === 0) {
        out(`   ${answer.data.slice(0, 600)}`);
      }
      return list;
    };

    const sync = await send('breakpoints', C, {
      url: `${mainUrl}/breakpoints`,
      method: 'POST',
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/vnd.sap.adt.amdp.dbg.bpsync.v1+xml',
      },
      data:
        '<?xml version="1.0" encoding="UTF-8"?><amdpdbg:breakpointsSyncRequest xmlns:amdpdbg="http://www.sap.com/adt/amdp/debugger" amdpdbg:syncMode="FULL" amdpdbg:clearCache="false">\n' +
        '  <amdpdbg:breakpoints>\n' +
        [loopLine, tfLine]
          .map(
            (line) =>
              `    <amdpdbg:breakpoint xmlns:adtcore="http://www.sap.com/adt/core" amdpdbg:clientId="${randomUUID()}" adtcore:uri="/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main#start=${line}"/>`,
          )
          .join('\n') +
        '\n  </amdpdbg:breakpoints>\n</amdpdbg:breakpointsSyncRequest>',
    });
    out(
      `   request ${String(sync.headers.location ?? sync.headers.Location ?? '?')}`,
    );

    for (const e of await nextEvents('events')) {
      out(`   ${e.kind}`);
      for (const bp of e.body.matchAll(/<amdpdbg:breakpoint\b[^>]*>/g)) {
        out(
          `     line ${/#start=(\d+)/.exec(attr(bp[0], 'adtcore:uri') ?? '')?.[1]} ${attr(bp[0], 'amdpdbg:state')} ${attr(bp[0], 'amdpdbg:errorMessage') ?? ''}`,
        );
      }
    }

    out(`run ${CLASS_NAME} on its own session`);
    let runDone = false;
    run = new ClassExecutor(T, quiet)
      .run({ className: CLASS_NAME })
      .finally(() => {
        runDone = true;
      });

    let debuggeeId = '';
    let stopped = false;
    let atBreak = false;

    /**
     * Read events until the debuggee stands somewhere or the session ends.
     * A breakpoint turning active (ON_TOGGLE_BREAKPOINTS) or a command's own
     * answer is an event too, and the wait goes on after it.
     */
    const awaitStop = async (): Promise<void> => {
      atBreak = false;
      for (let reads = 0; reads < 20 && !atBreak && !stopped; reads++) {
        for (const e of await nextEvents('events')) {
          if (e.kind === 'ON_BREAK') {
            debuggeeId = e.debuggeeId;
            atBreak = true;
            showBreak(e, source);
          } else {
            out(
              `   ${e.kind}${e.requestId ? ` (request ${e.requestId})` : ''}`,
            );
            for (const bp of e.body.matchAll(/<amdpdbg:breakpoint\b[^>]*>/g)) {
              out(
                `     line ${/#start=(\d+)/.exec(attr(bp[0], 'adtcore:uri') ?? '')?.[1]} ${attr(bp[0], 'amdpdbg:state') ?? ''} ${attr(bp[0], 'amdpdbg:errorMessage') ?? ''}`,
              );
            }
            if (VERBOSE || !e.body.includes('breakpoint')) {
              const text = e.body.replace(/\s+/g, ' ').trim();
              if (text && text !== '<amdpdbg:value/>')
                out(`     ${text.slice(0, 400)}`);
            }
            if (e.kind === 'STOP') stopped = true;
            if (e.kind === 'ON_EXECUTION_END') {
              await Promise.race([
                run,
                new Promise((r) => setTimeout(r, 5000)),
              ]);
              if (runDone) stopped = true;
            }
          }
        }
      }
    };

    await awaitStop();
    // PROBE_HARD_STOP=1: stop hard while the debuggee stands on its first
    // break, and see what becomes of the run.
    // PROBE_FINISH=1: let the debuggee run to its end — clear the breakpoints
    // (a FULL sync with none), continue, and wait for the method to end.
    if (process.env.PROBE_FINISH === '1' && atBreak) {
      await send('clear bps', C, {
        url: `${mainUrl}/breakpoints`,
        method: 'POST',
        timeout: 30_000,
        headers: {
          'Content-Type': 'application/vnd.sap.adt.amdp.dbg.bpsync.v1+xml',
        },
        data: '<?xml version="1.0" encoding="UTF-8"?><amdpdbg:breakpointsSyncRequest xmlns:amdpdbg="http://www.sap.com/adt/amdp/debugger" amdpdbg:syncMode="FULL" amdpdbg:clearCache="false"><amdpdbg:breakpoints/></amdpdbg:breakpointsSyncRequest>',
      });
      await send('step continue', C, {
        url: `${mainUrl}/debuggees/${encodeURIComponent(debuggeeId)}?step=continue`,
        method: 'POST',
        timeout: 30_000,
      });
      await awaitStop();
      return;
    }
    // PROBE_RELEASE=1: let the debuggee go through the deleteDebuggee link the
    // ON_BREAK event carries, then end the session the ordinary way.
    if (process.env.PROBE_RELEASE === '1' && atBreak) {
      await send('release', C, {
        url: `${mainUrl}/debuggees/${encodeURIComponent(debuggeeId)}`,
        method: 'DELETE',
        timeout: 30_000,
      });
      await awaitStop();
      return;
    }
    if (process.env.PROBE_HARD_STOP === '1' && atBreak) {
      hardStop = true;
      return;
    }
    const plan = [
      ...Array<string>(STEPS_OVER).fill('over'),
      ...Array<string>(8).fill('continue'),
    ];
    for (const step of plan) {
      if (!atBreak || stopped) break;
      await send(`step ${step}`, C, {
        url: `${mainUrl}/debuggees/${encodeURIComponent(debuggeeId)}?step=${step}`,
        method: 'POST',
        timeout: 30_000,
      });
      await awaitStop();
    }
    // Still standing on a breakpoint: the stop must release the debuggee.
    hardStop = atBreak && !stopped;
  } finally {
    if (mainId) {
      await send('stop', C, {
        url: `${AMDP}/${mainId}?hardStop=${hardStop}`,
        method: 'DELETE',
        timeout: 30_000,
      });
    }
    if (run) {
      const settled = await Promise.race([
        run,
        new Promise((r) => setTimeout(() => r(undefined), 30_000)),
      ]);
      // biome-ignore lint/suspicious/noExplicitAny: the executor's answer, read for its text
      const answer = settled as any;
      out(
        `run returned: ${answer ? (answer.ok ? String(answer.getResult().value).trim() : answer.getError().message) : 'not within 30 s'}`,
      );
    }
    M.setSessionType('stateless');
    await closeOwnTestConnection(T);
    await closeOwnTestConnection(C);
    await closeOwnTestConnection(M);
  }
}

main().catch((error) => {
  out(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
