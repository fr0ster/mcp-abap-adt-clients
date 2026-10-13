/**
 * One ABAP session for the whole run.
 *
 * The trial grants **two concurrent sessions** — measured: held open without
 * releasing, the third is refused with "the server authenticated the request
 * but opened no ABAP session". A suite that took one session per test reached
 * roughly a hundred and produced twenty setup failures carrying exactly that
 * message, in files whose tests had nothing wrong with them. Beyond the hard
 * ceiling, multiplying sessions is what makes a loaded system throttle you.
 *
 * jest gives every test file its own module registry and its own global, so a
 * shared connection OBJECT cannot survive between files — measured too:
 * `globalThis` set in one file reads back `null` in the next, `--runInBand` or
 * not. What can cross is the session itself.
 *
 * `@mcp-abap-adt/connection` says it plainly: the wire holds the cookie jar.
 * So `globalSetup` opens one session and writes its material here; every file
 * adopts it and connects onto the session that already exists rather than
 * asking for another. Verified against the trial — a second connector handed
 * the first one's cookies reports the SAME `SAP_SESSIONID` and answers `200`
 * over it.
 *
 * The seams used are `protected`: a consumer of the library should not need
 * them, and a test harness is the one place where sharing a session is the
 * point. They are reached on the instance `createConnection` built, which is
 * why this attaches to an instance rather than subclassing a connector — the
 * factory builds the connectors itself (connection 16).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * A connection that can hand its session to another, and take one.
 *
 * The test harness's own contract, not the library's: `IAbapConnection` says
 * nothing about sharing a session, and should not.
 */
export interface ISessionSharing {
  exportSession(): ISessionMaterial;
  adoptSession(material: ISessionMaterial): void;
}

/** What one session is, as far as another connector needs to know. */
export interface ISessionMaterial {
  cookies: string | null;
  csrf: string | null;
  /** The conversation id, so the server sees one caller rather than many. */
  id: string | null;
}

/** Where globalSetup leaves it for the test files to find. */
export const SHARED_SESSION_FILE = path.resolve(
  __dirname,
  '../../../.jest-shared-session.json',
);

/** The protected members, reached the only way they can be. */
interface ISessionSeams {
  getCookies(): string | null;
  setInitialCookies(cookies: string): void;
  getCsrfToken(): string | null;
  setCsrfToken(token: string | null): void;
}

function exportFrom(conn: ISessionSeams & { getSessionId(): string | null }) {
  return {
    cookies: conn.getCookies(),
    csrf: conn.getCsrfToken(),
    id: conn.getSessionId(),
  };
}

function adoptInto(
  conn: ISessionSeams & { setSessionId(id: string): void },
  material: ISessionMaterial,
) {
  if (material.cookies) conn.setInitialCookies(material.cookies);
  conn.setCsrfToken(material.csrf);
  if (material.id) conn.setSessionId(material.id);
}

/**
 * The same connection, able to hand its session to another and take one.
 *
 * `adoptSession` goes before the instance's one `connect()`: it lands that
 * connect on the session that exists instead of opening a new one.
 */
export function withSessionSharing<
  T extends { getSessionId(): string | null; setSessionId(id: string): void },
>(connection: T): T & ISessionSharing {
  const seams = connection as unknown as ISessionSeams & T;
  return Object.assign(connection, {
    exportSession: (): ISessionMaterial => exportFrom(seams),
    adoptSession: (material: ISessionMaterial): void =>
      adoptInto(seams, material),
  });
}

export function publishSessionMaterial(material: ISessionMaterial): void {
  fs.writeFileSync(SHARED_SESSION_FILE, `${JSON.stringify(material)}\n`);
}

/**
 * The material, or `null` when nobody published any.
 *
 * `null` is an ordinary answer, not a fault: a single test file run on its own
 * has no globalSetup session to join and opens its own, which is correct.
 */
export function readSessionMaterial(): ISessionMaterial | null {
  try {
    if (!fs.existsSync(SHARED_SESSION_FILE)) return null;
    return JSON.parse(fs.readFileSync(SHARED_SESSION_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Refuse to start a standalone script while a run owns the session.
 *
 * `createTestConnection()` adopts the session a run published, and
 * `releaseTestConnection()` then deliberately does NOT end it — the run owns
 * it. A script going through both would take somebody's session and give
 * nothing back. Probes exhausting a system's pool is not hypothetical: two runs
 * of the ATC probe did it to the on-premise system, and the next four test runs died in
 * globalSetup with no session available.
 *
 * The two cases the file cannot tell apart are both named in the message,
 * because the right action differs: wait, or delete a file a killed run left
 * behind.
 */
export function refuseWhileRunOwnsSession(): void {
  if (!fs.existsSync(SHARED_SESSION_FILE)) return;
  throw new Error(
    `${SHARED_SESSION_FILE} exists, so either a test run is in flight — in ` +
      'which case wait, one SAP-touching run at a time — or a previous run ' +
      'was killed before its teardown. If nothing is running, delete it and ' +
      'try again.',
  );
}

export function forgetSessionMaterial(): void {
  try {
    fs.rmSync(SHARED_SESSION_FILE, { force: true });
  } catch {
    // Nothing to clean up is not a problem worth raising in a teardown.
  }
}
