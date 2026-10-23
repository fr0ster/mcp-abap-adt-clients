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

import type {
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { AdtExecutorLegacy } from '../../clients/AdtExecutorLegacy';
import { integrationHeadersOf } from './adtHeaders';
import { configuredCase, missingCaseMessage } from './caseGate';
import { expectResult } from './contract';
import { presenceOf } from './objectPresence';
import {
  type RecordedRequest,
  type RequestRecorder,
  recordRequests,
} from './requestRecorder';
import {
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
} from './sessionConfig';
import { createConnectionLogger, createLibraryLogger } from './testLogger';

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
  const connection = await createTestConnection(createConnectionLogger());
  const recorder = recordRequests(connection);
  const logger = createLibraryLogger();
  const systemContext = await resolveSystemContext(connection, false);
  return {
    connection,
    recorder,
    client: new AdtClientLegacy(recorder.connection, logger, systemContext),
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

/** A handler deleted as 7.40 SP04 deletes: lock, delete with the handle, unlock. */
export interface LegacyDeletable<C> {
  readMetadata<E extends IAdtError = IAdtError>(
    config: C,
  ): Promise<IAdtResponse<unknown, E>>;
  lock<E extends IAdtError = IAdtError>(
    config: C,
  ): Promise<IAdtResponse<string, E>>;
  unlock<E extends IAdtError = IAdtError>(
    config: C,
    lockHandle: string,
  ): Promise<IAdtResponse<void, E>>;
  delete<E extends IAdtError = IAdtError>(
    config: C,
    options: { headers: IAdtHeaders; lockHandle?: string },
  ): Promise<IAdtResponse<unknown, E>>;
}

/** Lock, `delete` with the handle, unlock — the unlock even when the delete failed. */
export async function deleteLocked<C>(
  handler: LegacyDeletable<C>,
  config: C,
  label: string,
): Promise<IAdtResponse<unknown>> {
  const lockHandle = String(
    expectResult(await handler.lock(config), `lock ${label}`),
  );
  try {
    return await handler.delete(config, {
      headers: integrationHeadersOf(handler, 'delete'),
      lockHandle,
    });
  } finally {
    await handler.unlock(config, lockHandle);
  }
}

/** Remove `config`'s object when it is there; fail when that cannot be read. */
export async function removeIfPresent<C>(
  handler: LegacyDeletable<C>,
  config: C,
  label: string,
): Promise<void> {
  const there = presenceOf(await handler.readMetadata(config), label);
  if (there.present === 'unknown') throw new Error(there.reason);
  if (!there.present) return;
  expectResult(
    await deleteLocked(handler, config, label),
    `delete ${label} (cleanup)`,
  );
}
