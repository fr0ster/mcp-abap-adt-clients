/**
 * What the live legacy checks (`src/__tests__/integration/legacy/`) share.
 *
 * Each file runs inside `describeLegacyRfc` (a legacy configuration over RFC),
 * reads its case from the `legacy_740` section of `test-config.yaml`, and works
 * on a recorded connection, so "sends nothing" and "sent this" are asserted on
 * what left the wire. Objects a check creates go to `$TMP` with no transport —
 * where the deletes were measured — and are removed the way 7.40 SP04 deletes
 * them: lock, `DELETE ?lockHandle=`, unlock.
 */

import {
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { integrationHeadersOf } from '../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import {
  configuredCase,
  missingCaseMessage,
} from '../../../../adt-clients/src/__tests__/helpers/caseGate';
import { expectResult } from '../../../../adt-clients/src/__tests__/helpers/contract';
import { judged } from '../../../../adt-clients/src/__tests__/helpers/judged';
import { presenceOf } from '../../../../adt-clients/src/__tests__/helpers/objectPresence';
import {
  type RecordedRequest,
  type RecordOptions,
  type RequestRecorder,
  recordRequests,
} from '../../../../adt-clients/src/__tests__/helpers/requestRecorder';
import {
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
} from '../../../../adt-clients/src/__tests__/helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
} from '../../../../adt-clients/src/__tests__/helpers/testLogger';
import type { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { AdtExecutorLegacy } from '../../clients/AdtExecutorLegacy';
import { legacyClientOn, legacyConnectionOptions } from './legacyRegistrations';

export const LEGACY_740 = 'legacy_740';

/** Where a live check creates its objects: local, no transport (spec §4.2). */
export const LOCAL_PACKAGE = '$TMP';

export type CaseParams = Record<string, string>;

/**
 * Register `body`'s tests with the case's params, or one test saying why not:
 * a case that is not enabled skips with that reason; a case missing from the
 * configuration is a configuration defect and fails.
 */
export function withLegacyCase(
  name: string,
  body: (params: CaseParams) => void,
): void {
  const testCase = configuredCase(LEGACY_740, name);
  if (!testCase) {
    it(`configuration: case ${LEGACY_740}/${name}`, () => {
      throw new Error(missingCaseMessage(LEGACY_740, name));
    });
    return;
  }
  if (testCase.enabled !== true) {
    it.skip(`skipped: case ${LEGACY_740}/${name} is not enabled`, () => {});
    return;
  }
  body((testCase.params ?? {}) as CaseParams);
}

/** A required param, or the configuration defect naming it. */
export function param(params: CaseParams, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${LEGACY_740}: params.${key} is required`);
  return value.trim();
}

export interface LegacySession {
  readonly connection: IAbapConnection & ISessionLifecycleAware;
  readonly recorder: RequestRecorder<IAbapConnection & ISessionLifecycleAware>;
  readonly client: AdtClientLegacy;
  readonly executor: AdtExecutorLegacy;
}

/** The legacy client and executor on a recorded test connection. */
export async function openLegacySession(): Promise<LegacySession> {
  const connection = await createTestConnection(
    createConnectionLogger(),
    legacyConnectionOptions(),
  );
  return legacyClientsOn(connection, {});
}

/**
 * A legacy client and executor of their own on `connection`, behind a
 * recorder of their own — `{ deny: true }` for a check that nothing is sent.
 */
export async function legacyClientsOn(
  connection: IAbapConnection & ISessionLifecycleAware,
  options: RecordOptions,
): Promise<LegacySession> {
  const recorder = recordRequests(connection, options);
  const logger = createLibraryLogger();
  const systemContext = await resolveSystemContext(connection, false);
  return {
    connection,
    recorder,
    client: legacyClientOn(recorder.connection, logger, systemContext),
    executor: new AdtExecutorLegacy(recorder.connection, logger),
  };
}

export async function closeLegacySession(
  session: LegacySession | undefined,
): Promise<void> {
  if (session) await releaseTestConnection(session.connection);
}

/** What the recorder saw from `mark` (a `requests.length`) on. */
export function sentSince(
  recorder: RequestRecorder<IAbapConnection>,
  mark: number,
): RecordedRequest[] {
  return recorder.requests.slice(mark);
}

/** `METHOD path` of a request, the query cut off. */
export function lineOf(request: RecordedRequest): string {
  return `${request.method} ${request.url.split('?')[0]}`;
}

/** A query parameter a request carried, in its URL or its params. */
export function queryOf(
  request: RecordedRequest,
  key: string,
): string | undefined {
  const query = request.url.split('?')[1];
  const inUrl = query ? new URLSearchParams(query).get(key) : null;
  if (inUrl !== null) return inUrl;
  const inParams = (request.params as Record<string, unknown> | undefined)?.[
    key
  ];
  return inParams === undefined ? undefined : String(inParams);
}

/** The step a request is: its `_action` (`LOCK`, `UNLOCK`), else its method. */
export function stepOf(request: RecordedRequest): string {
  return queryOf(request, '_action') ?? request.method;
}

/**
 * A handler whose object is locked and unlocked. Built from the contract, so
 * every member keeps its `analyse` option.
 */
export type LegacyLockable<C> = IAdtLockable<C>;

/** A handler deleted as 7.40 SP04 deletes: lock, delete with the handle, unlock. */
export interface LegacyDeletable<C>
  extends LegacyLockable<C>,
    IAdtMetadataReadable<C, unknown>,
    Pick<IAdtDeletable<C, unknown>, 'delete'> {}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Why the unlock did not release the lock, or `undefined` when it did. */
async function unlockProblem<C>(
  handler: LegacyLockable<C>,
  config: C,
  lockHandle: string,
  label: string,
): Promise<string | undefined> {
  try {
    const answer = await handler.unlock(config, lockHandle, {
      analyse: analyseException,
    });
    if (answer.ok) return undefined;
    const failure = answer.getError();
    return `unlock ${label} failed [${failure.origin}]: ${failure.message}`;
  } catch (error) {
    return `unlock ${label} threw: ${messageOf(error)}`;
  }
}

/**
 * Lock, run `body` with the handle, unlock — the unlock even when `body`
 * failed, and its answer checked. A failed unlock is reported naming the
 * object: thrown on its own when `body` succeeded (with what `body` answered
 * when that was a failure), attached to `body`'s error when `body` threw —
 * never in place of it.
 */
export async function withLock<C, T>(
  handler: LegacyLockable<C>,
  config: C,
  label: string,
  body: (lockHandle: string) => Promise<T>,
): Promise<T> {
  const lockHandle = String(
    expectResult(
      await handler.lock(config, { analyse: analyseException }),
      `lock ${label}`,
    ),
  );
  let result: T;
  try {
    result = await body(lockHandle);
  } catch (error) {
    const problem = await unlockProblem(handler, config, lockHandle, label);
    if (problem !== undefined) {
      if (error instanceof Error) error.message += `\n  and then: ${problem}`;
      else
        throw new Error(`${messageOf(error)}\n  and then: ${problem}`, {
          cause: error,
        });
    }
    throw error;
  }
  const problem = await unlockProblem(handler, config, lockHandle, label);
  if (problem !== undefined) {
    const answered = result as { ok?: unknown; getError?: () => IAdtError };
    const before =
      answered?.ok === false && typeof answered.getError === 'function'
        ? ` (before it, the call under the lock answered [${answered.getError().origin}]: ${answered.getError().message})`
        : '';
    throw new Error(`${problem}${before}`);
  }
  return result;
}

/** Lock, `delete` with the handle, unlock (checked, see {@link withLock}). */
export async function deleteLocked<C>(
  handler: LegacyDeletable<C>,
  config: C,
  label: string,
): Promise<IAdtResponse<unknown>> {
  return withLock(handler, config, label, (lockHandle) =>
    handler.delete(config, {
      headers: integrationHeadersOf(handler, 'delete'),
      lockHandle,
      analyse: judged(analyseDeletion),
    }),
  );
}

/** An object a live check names: what it is, its name, and its handler. */
export interface LegacyObject {
  readonly label: string;
  readonly name: string;
  readonly handler: () => LegacyDeletable<object>;
  readonly config: object;
}

/**
 * Fail unless none of `objects` exists yet. Deletes nothing: an object this
 * run did not create is never this run's to remove.
 */
export async function requireAbsent(
  caseName: string,
  objects: readonly LegacyObject[],
): Promise<void> {
  for (const o of objects) {
    const there = presenceOf(
      await o.handler().readMetadata(o.config, {
        analyse: analyseException,
      }),
      o.label,
    );
    if (there.present === 'unknown') throw new Error(there.reason);
    if (there.present)
      throw new Error(
        `${LEGACY_740}/${caseName}: ${o.label} ${o.name} already exists; name one that does not`,
      );
  }
}

/**
 * Remove what this run created, in the order given (a module before its
 * group). Every object is attempted; one still there is deleted with lock,
 * delete, unlock; one already gone is skipped. Then one error names every
 * object left behind.
 */
export async function removeCreated(
  caseName: string,
  created: readonly LegacyObject[],
): Promise<void> {
  const leftBehind: string[] = [];
  for (const o of created) {
    try {
      const there = presenceOf(
        await o.handler().readMetadata(o.config, {
          analyse: analyseException,
        }),
        o.label,
      );
      if (there.present === 'unknown') throw new Error(there.reason);
      if (!there.present) continue;
      expectResult(
        await deleteLocked(o.handler(), o.config, `${o.label} ${o.name}`),
        `delete ${o.label} ${o.name}`,
      );
    } catch (error) {
      leftBehind.push(`${o.label} ${o.name}: ${messageOf(error)}`);
    }
  }
  if (leftBehind.length > 0)
    throw new Error(
      `${LEGACY_740}/${caseName}: cleanup left ${leftBehind.length} object(s) behind — remove them by hand:\n  ${leftBehind.join('\n  ')}`,
    );
}
