/**
 * adt-nc — netcat for ADT: send one request, print the whole answer.
 *
 * The same request goes to every system named with `--to`, one after another,
 * and each answer is printed in full — status, headers, body — whatever the
 * status was. Nothing is read, judged or retried: this is for finding out what
 * SAP says, before anything in the library decides what it means.
 *
 *   npx ts-node scripts/adt-nc.ts --to e19-tunnel --to trial:cloud \
 *     GET '/sap/bc/adt/programs/includes/ZINCL?version=active' \
 *     -H 'Accept: application/vnd.sap.adt.programs.includes.v2+xml'
 *
 *   npx ts-node scripts/adt-nc.ts --to e19-tunnel POST /sap/bc/adt/atc/runs \
 *     -H 'Content-Type: application/xml' -d @atc-run.xml --out ./probe
 *
 * `--to <name>[:onprem|cloud|legacy]` — a session file
 * `~/.config/mcp-abap-adt/sessions/<name>.env`, or a path to an env file. The
 * system kind is stated, never inferred from the URL or the authentication: the
 * suffix, or `SAP_SYSTEM_TYPE` in the file. A target that states neither is
 * refused before anything is sent.
 *
 * Each target gets a connection of its own built from its file alone — the
 * files are parsed, not loaded into `process.env`, so two systems in one run
 * cannot leak into each other — and the connection is closed after its answer.
 * `test-config.yaml` is not read.
 *
 * Options:
 *   -H 'Name: value'   request header, repeatable
 *   -d <body>|@file    request body
 *   --stateful         send this request stateful (as LOCK/UNLOCK are)
 *   --timeout <ms>     default 60000
 *   --out <dir>        also write each exchange to <dir>/<target>.txt
 *   -v                 connector debug output on stderr
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  answerOf,
  clean,
  connectionFor,
  fail,
  type ITarget,
  loggerFor,
  resolveTarget,
} from './lib/adtTarget';

interface IRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: string;
  stateful: boolean;
  timeout: number;
}

function parseArgs(argv: string[]) {
  const targets: string[] = [];
  const headers: Record<string, string> = {};
  const positional: string[] = [];
  let data: string | undefined;
  let stateful = false;
  let timeout = 60_000;
  let out: string | undefined;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i] ?? fail(`${arg} needs a value`);
    if (arg === '--to') targets.push(next());
    else if (arg === '-H') {
      const header = next();
      const sep = header.indexOf(':');
      if (sep <= 0) fail(`not a header: ${header}`);
      headers[header.slice(0, sep).trim()] = header.slice(sep + 1).trim();
    } else if (arg === '-d') {
      const value = next();
      data = value.startsWith('@')
        ? fs.readFileSync(value.slice(1), 'utf8')
        : value;
    } else if (arg === '--stateful') stateful = true;
    else if (arg === '--timeout') timeout = Number(next());
    else if (arg === '--out') out = next();
    else if (arg === '-v') verbose = true;
    else if (arg.startsWith('-')) fail(`unknown option ${arg}`);
    else positional.push(arg);
  }

  const [method, url] = positional;
  if (!targets.length || !method || !url || positional.length > 2) {
    fail(
      'usage: adt-nc.ts --to <env>[:onprem|cloud|legacy] [--to …] <METHOD> <URL> [-H h]… [-d body|@file] [--stateful] [--out dir] [-v]',
    );
  }
  if (!url.startsWith('/')) fail(`the URL is a path on the system: ${url}`);

  const request: IRequest = {
    method: method.toUpperCase(),
    url,
    headers,
    data,
    stateful,
    timeout,
  };
  return { targets: targets.map(resolveTarget), request, out, verbose };
}

function render(
  target: ITarget,
  request: IRequest,
  answer: IAdtWireResponse | { error: string; stack?: string },
  ms: number,
): string {
  const lines = [
    `=== ${target.label} (${target.kind}) — ${clean(target.env.SAP_URL)} — ${ms} ms`,
    `> ${request.method} ${request.url}${request.stateful ? '   [stateful]' : ''}`,
    ...Object.entries(request.headers).map(([k, v]) => `> ${k}: ${v}`),
  ];
  if (request.data !== undefined) lines.push('>', request.data);
  lines.push('');

  if ('error' in answer) {
    lines.push(`! no answer arrived: ${answer.error}`);
    if (answer.stack) lines.push(answer.stack);
    return `${lines.join('\n')}\n`;
  }
  lines.push(`< ${answer.status} ${answer.statusText ?? ''}`.trimEnd());
  for (const [k, v] of Object.entries(answer.headers ?? {})) {
    lines.push(`< ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  }
  lines.push('<');
  const body = answer.data;
  lines.push(
    typeof body === 'string' ? body : (JSON.stringify(body, null, 2) ?? ''),
  );
  return `${lines.join('\n')}\n`;
}

async function exchange(
  target: ITarget,
  request: IRequest,
  logger: ILogger,
): Promise<{ text: string; status?: number }> {
  // TLS_REJECT_UNAUTHORIZED from the target's own file, and only for this
  // target: the transports read it from the process, so it is put back after.
  const tlsBefore = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  const tls = clean(target.env.TLS_REJECT_UNAUTHORIZED);
  if (tls !== undefined) process.env.NODE_TLS_REJECT_UNAUTHORIZED = tls;
  else delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  const connection = connectionFor(target, logger);
  const started = Date.now();
  let answer: IAdtWireResponse | { error: string; stack?: string };
  try {
    await connection.connect();
    if (request.stateful) connection.setSessionType('stateful');
    try {
      answer = await connection.makeAdtRequest({
        url: request.url,
        method: request.method,
        timeout: request.timeout,
        headers: request.headers,
        data: request.data,
      });
    } finally {
      if (request.stateful) connection.setSessionType('stateless');
    }
  } catch (error: unknown) {
    answer = answerOf(error);
  }
  const ms = Date.now() - started;
  if (tlsBefore === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  else process.env.NODE_TLS_REJECT_UNAUTHORIZED = tlsBefore;
  // The logoff is dispatched and its answer not awaited: the next target does
  // not wait on this one's session ending — when the server frees it is the
  // server's affair.
  void Promise.resolve(connection.disconnect?.()).catch(() => undefined);
  return {
    text: render(target, request, answer, ms),
    status: 'status' in answer ? answer.status : undefined,
  };
}

async function main(): Promise<void> {
  const { targets, request, out, verbose } = parseArgs(process.argv.slice(2));
  const logger = loggerFor(verbose);
  if (out) fs.mkdirSync(out, { recursive: true });

  const summary: string[] = [];
  for (const target of targets) {
    const { text, status } = await exchange(target, request, logger);
    process.stdout.write(`${text}\n`);
    if (out) fs.writeFileSync(path.join(out, `${target.label}.txt`), text);
    summary.push(`${target.label}: ${status ?? 'no answer'}`);
  }
  if (targets.length > 1) process.stdout.write(`--- ${summary.join(' | ')}\n`);
}

// No process.exit() on success: the logoffs are dispatched without waiting for
// their answer, and exiting at once could cut one before it leaves the process.
// Node ends on its own once they are sent.
main().then(
  () => undefined,
  (error: unknown) =>
    fail(error instanceof Error ? error.message : String(error)),
);
