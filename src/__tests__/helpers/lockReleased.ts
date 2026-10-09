/**
 * Proof that an UNLOCK released the lock, from a session that did not hold it.
 *
 * **An UNLOCK that answers 200 has not necessarily released anything.** Since
 * `@mcp-abap-adt/connection` 9.3.1 a stateless request goes without
 * `sap-contextid`, so an UNLOCK sent stateless runs in a fresh ABAP context,
 * answers 200 and leaves the enqueue entry where it was. Three handlers did
 * exactly that — include, service binding, message class — and the suites
 * passed, because all they asked of the UNLOCK was its status. What gave it
 * away, on-prem, was the next step: activation answered 403 EU/510 "currently
 * editing". On cloud there is no SM12 to look at.
 *
 * The observable proof is the one a colleague would get: LOCK the same object
 * from a DIFFERENT ABAP session. A lock still held is refused — 403, "currently
 * editing" / "is locked by" — and a released one is granted, and is then
 * released again here. The test's own session cannot answer the question: the
 * session holding a lock is granted it again.
 *
 * It costs one session logon per check, so `VERIFY_LOCK_RELEASED=false` turns
 * it off. The trial grants two sessions — the run's and this one — so the
 * session is always closed before this returns, and never two are open at once.
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtClient } from '../../clients/AdtClient';
import {
  closeOwnTestConnection,
  createTestAdtClient,
  createTestConnection,
} from './sessionConfig';
import { createConnectionLogger, emptyLogger } from './testLogger';

/** The lock window of a handler: the two members this check calls. */
export interface ILockWindow<TConfig> {
  lock(
    config: TConfig,
    options?: IAdtAnalyseOptions,
  ): Promise<IAdtResponse<string>>;
  unlock(
    config: TConfig,
    lockHandle: string,
    options?: IAdtAnalyseOptions,
  ): Promise<IAdtResponse<unknown>>;
}

/** A client on a session of its own, and the way to end that session. */
export interface IVerifierSession {
  client: AdtClient;
  close(): Promise<void>;
}

export type OpenVerifierSession = (
  logger?: ILogger,
) => Promise<IVerifierSession>;

/** On unless `VERIFY_LOCK_RELEASED=false`. Read at the call, like the rest. */
export function lockReleaseCheckEnabled(): boolean {
  return process.env.VERIFY_LOCK_RELEASED?.trim().toLowerCase() !== 'false';
}

/**
 * A second ABAP session: its own logon, its own client.
 *
 * Built the way a test builds its client, so a legacy system gets the legacy
 * client here too and the factory lookup in {@link factoryOf} matches.
 */
export const openOwnSession: OpenVerifierSession = async (logger) => {
  const connection = await createTestConnection(createConnectionLogger(), {
    ownSession: true,
  });
  try {
    const { client } = await createTestAdtClient(
      connection,
      logger ?? emptyLogger,
    );
    return { client, close: () => closeOwnTestConnection(connection) };
  } catch (error) {
    await closeOwnTestConnection(connection);
    throw error;
  }
};

/** SAP's own sentence, with the T100 key when the reading found one. */
function whatSapSaid(failure: IAdtError): string {
  const messages =
    (
      failure as IAdtError & {
        messages?: ReadonlyArray<{
          type?: string;
          text?: string;
          t100?: { id?: string; no?: string };
        }>;
      }
    ).messages ?? [];
  const said = messages
    .map(
      (m) =>
        `${m.type ?? ''} ${m.text ?? ''}`.trim() +
        (m.t100 ? ` [${m.t100.id}/${m.t100.no}]` : ''),
    )
    .filter(Boolean)
    .join('; ');
  return said || failure.message;
}

function statusOf(failure: IAdtError): string {
  const status = failure.response?.status;
  return status === undefined ? `[${failure.origin}]` : `HTTP ${status}`;
}

const NOT_VISIBLE_RETRIES = 3;
const NOT_VISIBLE_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** SAP says the object is not there: 404. Not a lock, whatever else it is. */
function isNotVisible(failure: IAdtError): boolean {
  return failure.response?.status === 404;
}

/**
 * SAP says someone holds the lock: 403, with EU/510 "currently editing" or a
 * "locked by" text. The one answer that means the UNLOCK released nothing.
 */
function isLockHeld(failure: IAdtError): boolean {
  if (failure.response?.status !== 403) return false;
  const said = whatSapSaid(failure);
  return /EU\/510|currently editing|locked by|is locked|enqueue/i.test(said);
}

/**
 * The check itself, with the session opener given — which is what lets it be
 * unit-tested without a system.
 */
export async function verifyLockReleased<TConfig>(
  open: OpenVerifierSession,
  openHandler: (client: AdtClient) => ILockWindow<TConfig>,
  config: TConfig,
  what: string,
  logger?: ILogger,
): Promise<void> {
  const session = await open(logger);
  let failure: unknown;
  try {
    const handler = openHandler(session.client);
    // A new session may land on another application server, where an object
    // created seconds ago is not visible yet: its LOCK answers 404 "does not
    // exist". Measured on the cloud trial — the same test passed alone. That is
    // not a lock at all, so it is retried, and if the object stays invisible
    // the check reports it cannot judge rather than claiming a held lock.
    let locked = await handler.lock(config, { analyse: analyseException });
    for (
      let attempt = 1;
      !locked.ok &&
      isNotVisible(locked.getError()) &&
      attempt <= NOT_VISIBLE_RETRIES;
      attempt++
    ) {
      await sleep(NOT_VISIBLE_DELAY_MS);
      locked = await handler.lock(config, { analyse: analyseException });
    }
    if (!locked.ok) {
      const refusal = locked.getError();
      const detail =
        `(${statusOf(refusal)}): ${whatSapSaid(refusal)}` +
        (refusal.request?.url ? ` (${refusal.request.url})` : '');
      if (isNotVisible(refusal)) {
        logger?.warn?.(
          `${what}: lock-release check inconclusive — the object is not ` +
            `visible from a second ABAP session ${detail}`,
        );
      } else if (isLockHeld(refusal)) {
        throw new Error(
          `${what}: the previous UNLOCK did not release the lock — a second ` +
            `ABAP session was refused it ${detail}`,
        );
      } else {
        throw new Error(
          `${what}: the lock-release check could not be made — a second ABAP ` +
            `session's LOCK was refused for another reason ${detail}`,
        );
      }
    } else {
      const handle = locked.getResult().value;
      if (!handle) {
        throw new Error(
          `${what}: a second ABAP session's LOCK answered without a lock ` +
            'handle, so whether the previous UNLOCK released anything cannot ' +
            'be told — and there is nothing to release this lock with.',
        );
      }
      const released = await handler.unlock(config, handle, {
        analyse: analyseException,
      });
      if (!released.ok) {
        const refusal = released.getError();
        throw new Error(
          `${what}: the verifying session took the lock but could not release ` +
            `it (${statusOf(refusal)}): ${whatSapSaid(refusal)}`,
        );
      }
      logger?.debug?.(`${what}: lock released — a second session took it`);
    }
  } catch (error) {
    failure = error;
  }
  // Closed whatever happened above: the trial has two sessions, and this is
  // the second. A close that fails is reported, but never over the finding.
  try {
    await session.close();
  } catch (closeError) {
    if (failure === undefined) throw closeError;
    logger?.warn?.(`${what}: closing the verifying session failed`, {
      closeError,
    });
  }
  if (failure !== undefined) throw failure;
}

/**
 * Fail the test when the object is still locked after its UNLOCK.
 *
 * @param openHandler the handler whose lock the test took, built on the given
 *   client — a class include passes `getClass()` or its own factory, both of
 *   which lock the CLASS, which is the lock ADT checks the include write against
 * @param config the object, as the test's LOCK was given it
 * @param what names the object in the failure
 */
export async function expectLockReleased<TConfig>(
  openHandler: (client: AdtClient) => ILockWindow<TConfig>,
  config: TConfig,
  what: string,
  logger?: ILogger,
): Promise<void> {
  if (!lockReleaseCheckEnabled()) {
    logger?.debug?.(`${what}: lock-release check off (VERIFY_LOCK_RELEASED)`);
    return;
  }
  await verifyLockReleased(openOwnSession, openHandler, config, what, logger);
}

/**
 * The `AdtClient` factory that builds handlers of the same class as `handler`.
 *
 * `BaseTester` is handed a handler already built on the test's connection,
 * and some thirty files construct it. The check needs the same handler on another
 * connection, and the same class means the same lock target — for a class
 * include that is the class. Found by building each zero-argument `get…` of
 * the client (every factory only constructs) and comparing constructors;
 * `undefined` when none matches, which the caller must report rather than
 * treat as released.
 */
export function factoryOf(client: object, handler: object): string | undefined {
  const seen = new Set<string>();
  for (
    let proto = Object.getPrototypeOf(client);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (seen.has(name) || !name.startsWith('get')) continue;
      seen.add(name);
      const member = (client as Record<string, unknown>)[name];
      if (typeof member !== 'function' || member.length !== 0) continue;
      try {
        const built = member.call(client);
        if (built && built.constructor === handler.constructor) return name;
      } catch {
        // A factory a client does not support throws; it is not the one.
      }
    }
  }
  return undefined;
}
