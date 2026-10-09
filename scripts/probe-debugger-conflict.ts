/**
 * What happens to our listener while another debugger — Eclipse — already
 * listens for the same SAP user?
 *
 * Run it while Eclipse has a breakpoint set under the same user (Eclipse
 * keeps a user-mode listener open whenever it has one). Nothing is run, no
 * breakpoint of ours is armed: each variant only opens a listener, holds it a
 * few seconds, and prints what the server answered. Watch Eclipse between the
 * variants — whether its listener survived is half the answer.
 *
 * - A: AbapDebugger.listen with onConflict 'takeOver' — no conflict parameters.
 * - B: the listener as Eclipse sends it — checkConflict=true and
 *      isNotifiedOnConflict=true.
 *
 *   MCP_ENV_PATH=<session>.env npx ts-node scripts/probe-debugger-conflict.ts [A|B ...]
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import {
  closeOwnTestConnection,
  createTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { AbapDebugger } from '../src/runtime/debugger/AbapDebugger';
import type { IDebuggerIdentity } from '../src/runtime/debugger/contracts';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const HOLD_SECONDS = Number(process.env.PROBE_LISTEN_SECONDS ?? '10');
const BODY_CHARS = Number(process.env.PROBE_BODY_CHARS ?? '600');

const quietLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as ILogger;

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function identityFor(): IDebuggerIdentity {
  const requestUser = String(process.env.SAP_USERNAME ?? '').toUpperCase();
  const seed = `${process.env.SAP_URL}:${requestUser}`;
  const id = (suffix: string): string =>
    createHash('sha256')
      .update(`${seed}:${suffix}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  return { requestUser, terminalId: id('terminalId'), ideId: id('ideId') };
}

function clip(text: string): string {
  return text.length > BODY_CHARS
    ? `${text.slice(0, BODY_CHARS)}… [${text.length} chars]`
    : text;
}

function report(
  label: string,
  ms: number,
  status: number | undefined,
  body: string,
): void {
  const subtype = /subType">([^<]*)</.exec(body)?.[1];
  const message = /<message[^>]*>([^<]*)</.exec(body)?.[1];
  const t100 = [...body.matchAll(/key="(T100KEY-[A-Z]+)">([^<]*)</g)]
    .map((m) => `${m[1].replace('T100KEY-', '')}=${m[2]}`)
    .join(' ');
  out(`  ${label}: ${status ?? 'no answer'} in ${ms} ms`);
  if (subtype) out(`    subtype  ${subtype}`);
  if (message) out(`    message  ${message}`);
  if (t100) out(`    T100     ${t100}`);
  if (status === 200 && body === '')
    out('    (empty body: the hold expired, nothing caught)');
  if (body && !subtype) out(`    body     ${clip(body)}`);
}

async function variantA(
  debuggerApi: AbapDebugger,
  identity: IDebuggerIdentity,
): Promise<number | undefined> {
  const t0 = Date.now();
  const answer = await debuggerApi.listen(identity, {
    onConflict: 'takeOver',
    holdSeconds: HOLD_SECONDS,
  });
  const ms = Date.now() - t0;
  if (answer.ok) {
    const body = String(answer.getResult().value ?? '');
    report('A  listen (no conflict parameters)', ms, 200, body);
    return 200;
  }
  const error = answer.getError();
  report(
    'A  listen (no conflict parameters)',
    ms,
    error.response?.status,
    String(error.response?.data ?? error.message),
  );
  return error.response?.status;
}

async function variantB(
  connection: IAbapConnection,
  identity: IDebuggerIdentity,
): Promise<number | undefined> {
  const query = new URLSearchParams({
    debuggingMode: 'user',
    requestUser: identity.requestUser,
    terminalId: identity.terminalId,
    ideId: identity.ideId,
    timeout: String(HOLD_SECONDS),
    checkConflict: 'true',
    isNotifiedOnConflict: 'true',
  });
  const t0 = Date.now();
  try {
    const response = await connection.makeAdtRequest({
      url: `/sap/bc/adt/debugger/listeners?${query}`,
      method: 'POST',
      timeout: (HOLD_SECONDS + 60) * 1000,
      headers: { Accept: 'application/vnd.sap.as+xml' },
    });
    report(
      'B  listen (checkConflict, isNotifiedOnConflict)',
      Date.now() - t0,
      response.status,
      String(response.data ?? ''),
    );
    return response.status;
  } catch (error) {
    // biome-ignore lint/suspicious/noExplicitAny: an axios-shaped error, read defensively
    const response = (error as any)?.response;
    report(
      'B  listen (checkConflict, isNotifiedOnConflict)',
      Date.now() - t0,
      response?.status,
      String(response?.data ?? (error as Error).message),
    );
    return response?.status;
  }
}

async function main(): Promise<void> {
  const chosen = process.argv.slice(2).map((a) => a.toUpperCase());
  const variants = chosen.length ? chosen : ['A', 'B'];
  const identity = identityFor();
  out(
    `user ${identity.requestUser}, terminal ${identity.terminalId}, hold ${HOLD_SECONDS} s`,
  );

  const connection = await createTestConnection(quietLogger, {
    ownSession: true,
  });
  const debuggerApi = new AbapDebugger(connection, quietLogger);
  connection.setSessionType('stateful');
  try {
    for (const variant of variants) {
      out();
      const status =
        variant === 'A'
          ? await variantA(debuggerApi, identity)
          : await variantB(connection, identity);
      if (status === 200) {
        // Ours was accepted; take it back down before the next variant.
        const stopped = await debuggerApi.stopListener(identity);
        out(
          `    our listener deleted: ${stopped.ok ? 'ok' : stopped.getError().message}`,
        );
      }
      out('    → look at Eclipse now: is its listener still on?');
    }
  } finally {
    connection.setSessionType('stateless');
    await closeOwnTestConnection(connection);
  }
}

main().catch((error) => {
  out(`FAILED: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
