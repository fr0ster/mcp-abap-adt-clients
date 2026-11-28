/**
 * Live: type groups (`getTypeGroup()`, `TYPE/DG`).
 *
 * - **On premise** (`type_groups/adt_type_group`): the cycle, one step per
 *   member — validate a free, a taken and a too long name; create a type
 *   group of the run's own (a fresh name of five characters); read its
 *   metadata and source inactive; lock, write the source with the read's
 *   ETag as `If-Match`, unlock, and prove the lock released from a second
 *   session; activate; read active; list the versions and read one version's
 *   source; lock, delete, unlock; read its absence back. With a transport
 *   configured the create, the write and the delete carry it as `corrNr`, and
 *   a metadata read asks for long polling. The type group is deleted also when
 *   a step failed.
 * - **Both variants** (`type_groups/adt_type_group_reads`): what the cloud row
 *   serves — validation, the metadata and source of SAP's `ABAP` type group
 *   (with and without `version=active`), its version list and one version's
 *   source. No write runs on the cloud: its row lists none.
 *
 * Run: npm test -- --testPathPatterns 'integration/core/typeGroup/TypeGroup\.test\.ts$'
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import {
  AdtClientCloud,
  AdtClientOnPrem,
} from '../../../../clients/AdtClientVariants';
import { typeGroupDocuments } from '../../../../core/typeGroup';
import { wireItself } from '../../../../utils/resultStrategy';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult, releasing } from '../../../helpers/contract';
import { etagOf } from '../../../helpers/ifMatchProbes';
import { judged } from '../../../helpers/judged';
import {
  type IVerifierSession,
  lockReleaseCheckEnabled,
  noteLockReleaseCheckOff,
  verifyLockReleased,
} from '../../../helpers/lockReleased';
import {
  closeOwnTestConnection,
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const SECTION = 'type_groups';
const CYCLE = 'adt_type_group';
const READS = 'adt_type_group_reads';

/** A fresh customer name of five characters: `ZTG` and two of base 36. */
function freshName(): string {
  const two = Math.floor(Math.random() * 36 * 36)
    .toString(36)
    .padStart(2, '0')
    .toUpperCase();
  return `ZTG${two}`;
}

/** One request the cycle's client sent, and the status SAP answered. */
interface ISentRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  status: number | undefined;
}

/**
 * The suite's connection, recording every request the cycle's client sends
 * and SAP's status, so the log proves what went out: each request carrying
 * `corrNr`, `withLongPolling` or `If-Match` is written as it was sent.
 */
function recording(
  connection: IAbapConnection & ISessionLifecycleAware,
  sent: ISentRequest[],
): IAbapConnection & ISessionLifecycleAware {
  // What the client writes onto this connection (its request trace wraps
  // `makeAdtRequest` by assignment) stays on the proxy: written through to the
  // shared connection, the two wrappers would call each other.
  const own = new Map<PropertyKey, unknown>();
  return new Proxy(connection, {
    set(_target, property, value) {
      own.set(property, value);
      return true;
    },
    get(target, property, receiver) {
      if (own.has(property)) return own.get(property);
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (property !== 'makeAdtRequest') return value.bind(target);
      return async (
        request: Parameters<IAbapConnection['makeAdtRequest']>[0],
      ) => {
        const entry: ISentRequest = {
          method: request.method,
          url: request.url,
          headers: { ...(request.headers ?? {}) },
          status: undefined,
        };
        sent.push(entry);
        try {
          const answer = await target.makeAdtRequest(request);
          entry.status = answer.status;
          return answer;
        } catch (error) {
          entry.status = (
            error as { response?: { status?: number } }
          ).response?.status;
          throw error;
        }
      };
    },
  });
}

/**
 * Log, from `sent[from]` on, each request that carried `what` (a query
 * parameter, or `If-Match`), with SAP's status; and fail when none did.
 */
function logCarrying(
  sent: readonly ISentRequest[],
  from: number,
  what: 'corrNr' | 'withLongPolling' | 'If-Match',
): void {
  const carrying = sent
    .slice(from)
    .filter((r) =>
      what === 'If-Match'
        ? r.headers['If-Match'] !== undefined
        : r.url.includes(`${what}=`),
    );
  if (carrying.length === 0) {
    throw new Error(`no request carried ${what}`);
  }
  for (const r of carrying) {
    logTestStep(
      `sent with ${what}: ${r.method} ${r.url}${what === 'If-Match' ? ` (If-Match ${r.headers['If-Match']})` : ''} → SAP ${r.status ?? 'no answer'}`,
    );
  }
}

/** A failure's status and what SAP said, for the log of a failing step. */
function said(answer: { ok: boolean; getError?: () => unknown }): string {
  if (answer.ok || !answer.getError) return 'ok';
  const failure = answer.getError() as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  return `HTTP ${failure.response?.status ?? '?'}: ${failure.message ?? ''} ${String(failure.response?.data ?? '').slice(0, 400)}`;
}

describe('Type groups (AdtTypeGroup)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let isCloudSystem = false;
  let onprem: AdtClientOnPrem;
  const sent: ISentRequest[] = [];
  let cloud: AdtClientCloud;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      onprem = new AdtClientOnPrem(
        recording(connection, sent),
        libraryLogger,
        systemContext,
      );
      cloud = new AdtClientCloud(connection, libraryLogger, systemContext);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  /** The handler of the variant the run's system is. */
  const reader = () =>
    isCloudSystem ? cloud.getTypeGroup() : onprem.getTypeGroup();

  gate(SECTION, READS)(
    'validates names and reads an SAP type group, its versions and a version source',
    async () => {
      const testCase = configuredCase(SECTION, READS);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, READS));
      const title = 'TypeGroup - reads';
      logTestStart(testsLogger, title, testCase);
      try {
        const group = reader();
        const sapGroup = String(testCase.params?.sap_type_group ?? 'ABAP');

        const free = await group.validate(
          { typeGroupName: freshName(), description: 'probe' },
          { analyse: analyseException },
        );
        expect(said(free)).toBe('ok');
        const taken = await group.validate(
          { typeGroupName: 'SLIS', description: 'probe' },
          { analyse: analyseException },
        );
        expect(taken.ok).toBe(false);
        expect(said(taken)).toContain('InvalidTypeGroupName');
        const long = await group.validate(
          { typeGroupName: 'ZTG4817', description: 'probe' },
          { analyse: analyseException },
        );
        expect(long.ok).toBe(false);
        expect(said(long)).toContain('InvalidTypeGroupName');

        const metadata = expectResult(
          await group.readMetadata(
            { typeGroupName: sapGroup },
            { analyse: analyseException },
          ),
          'readMetadata',
        );
        expect(String(metadata)).toContain('atypgr:abapTypeGroup');
        const active = expectResult(
          await group.readMetadata(
            { typeGroupName: sapGroup },
            { version: 'active', analyse: analyseException },
          ),
          'readMetadata active',
        );
        expect(String(active)).toContain('adtcore:type="TYPE/DG"');

        const source = expectResult(
          await group.read({ typeGroupName: sapGroup }, undefined, {
            analyse: analyseException,
          }),
          'read',
        );
        expect(String(source).toLowerCase()).toContain('type-pool');
        expectResult(
          await group.read({ typeGroupName: sapGroup }, 'active', {
            analyse: analyseException,
          }),
          'read active',
        );

        const feed = String(
          expectResult(
            await group.getVersions(
              { typeGroupName: sapGroup },
              { analyse: analyseException },
            ),
            'getVersions',
          ),
        );
        const at = feed.indexOf('src="');
        expect(at).toBeGreaterThan(-1);
        const contentUri = feed.slice(at + 5, feed.indexOf('"', at + 5));
        const version = expectResult(
          await group.getVersionSource(contentUri, {
            analyse: analyseException,
          }),
          'getVersionSource',
        );
        expect(String(version).toLowerCase()).toContain('type-pool');
        logTestSuccess(testsLogger, title);
      } catch (error) {
        logTestError(testsLogger, title, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, title);
      }
    },
    getTimeout('test'),
  );

  gate(SECTION, CYCLE)(
    'creates, writes under its lock, activates, lists versions and deletes a type group of its own',
    async () => {
      const testCase = configuredCase(SECTION, CYCLE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, CYCLE));
      if (isCloudSystem) {
        throw new Error(
          `${SECTION}/${CYCLE} is a cycle of writes the cloud row does not list: enable it on premise only (available_in)`,
        );
      }
      const title = 'TypeGroup - cycle';
      logTestStart(testsLogger, title, testCase);
      const params = testCase.params ?? {};
      const packageName = resolvePackageName(params.package_name);
      if (!packageName) throw new Error('package_name not configured');
      const transportRequest =
        resolveTransportRequest(params.transport_request) || undefined;
      const name = freshName();
      const id = { typeGroupName: name, transportRequest };
      const group = onprem.getTypeGroup();
      let created = false;
      let deleted = false;
      try {
        logTestStep(`validate ${name}`, testsLogger);
        const valid = await group.validate(
          { typeGroupName: name, packageName, description: 'probe' },
          { analyse: analyseException },
        );
        expect(said(valid)).toBe('ok');

        logTestStep('create', testsLogger);
        const createdFrom = sent.length;
        const create = await group.create(
          {
            typeGroupName: name,
            packageName,
            transportRequest,
            description: String(params.description ?? 'ADT type group'),
          },
          {
            headers: integrationHeadersOf(group, 'create'),
            analyse: analyseException,
          },
        );
        expect(said(create)).toBe('ok');
        created = true;
        if (transportRequest) logCarrying(sent, createdFrom, 'corrNr');

        logTestStep('read inactive', testsLogger);
        expectResult(
          await group.readMetadata(id, {
            version: 'inactive',
            analyse: analyseException,
          }),
          'readMetadata inactive',
        );
        const initial = expectResult(
          await group.read(id, 'inactive', { analyse: analyseException }),
          'read inactive',
        );
        expect(String(initial).toLowerCase()).toContain('type-pool');
        if (transportRequest) {
          const pollFrom = sent.length;
          expectResult(
            await group.readMetadata(id, {
              withLongPolling: true,
              analyse: analyseException,
            }),
            'readMetadata withLongPolling',
          );
          logCarrying(sent, pollFrom, 'withLongPolling');
        }

        logTestStep('lock, write with If-Match, unlock', testsLogger);
        const source = `TYPE-POOL ${name.toLowerCase()} .\n\nTYPES ${name.toLowerCase()}_flag TYPE c LENGTH 1.\n`;
        const handle = expectResult(
          await group.lock(id, { analyse: analyseException }),
          'lock',
        );
        const writeFrom = sent.length;
        await releasing(
          async () => {
            // The source read's ETag, from the wire itself.
            const wire = expectResult(
              await onprem
                .getTypeGroup({ ...typeGroupDocuments, source: wireItself })
                .read(id, 'inactive', { analyse: analyseException }),
              'read for the ETag',
            );
            const ifMatch = etagOf(wire, `read type group ${name}`);
            expectResult(
              await group.update(id, {
                headers: integrationHeadersOf(group, 'update'),
                lockHandle: handle,
                source,
                ifMatch,
                analyse: analyseException,
              }),
              'update',
            );
          },
          () => group.unlock(id, handle, { analyse: analyseException }),
          'unlock',
        );
        logCarrying(sent, writeFrom, 'If-Match');
        if (transportRequest) logCarrying(sent, writeFrom, 'corrNr');
        if (lockReleaseCheckEnabled()) {
          await verifyLockReleased(
            async (logger): Promise<IVerifierSession> => {
              const own = await createTestConnection(createConnectionLogger(), {
                ownSession: true,
              });
              const { client } = await createTestAdtClient(
                own,
                logger ?? libraryLogger,
                undefined,
                async (c, l, o) => ({ client: new AdtClientOnPrem(c, l, o) }),
              );
              return { client, close: () => closeOwnTestConnection(own) };
            },
            (client: AdtClient) =>
              client instanceof AdtClientOnPrem
                ? client.getTypeGroup()
                : (() => {
                    throw new Error('the verifier is not on premise');
                  })(),
            id,
            `type group ${name}`,
            testsLogger,
          );
        } else {
          noteLockReleaseCheckOff(`type group ${name}`);
        }

        logTestStep('activate', testsLogger);
        expectResult(
          await group.activate(id, {
            headers: integrationHeadersOf(group, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        const activeSource = expectResult(
          await group.read(id, 'active', { analyse: analyseException }),
          'read active',
        );
        expect(String(activeSource)).toContain(`${name.toLowerCase()}_flag`);

        logTestStep('versions', testsLogger);
        const feed = String(
          expectResult(
            await group.getVersions(id, { analyse: analyseException }),
            'getVersions',
          ),
        );
        const at = feed.indexOf('src="');
        expect(at).toBeGreaterThan(-1);
        expectResult(
          await group.getVersionSource(
            feed.slice(at + 5, feed.indexOf('"', at + 5)),
            { analyse: analyseException },
          ),
          'getVersionSource',
        );

        logTestStep('lock, delete, unlock', testsLogger);
        const deleteFrom = sent.length;
        deleted = await deleteUnderLock(group, id);
        if (transportRequest) logCarrying(sent, deleteFrom, 'corrNr');
        expect(deleted).toBe(true);
        const gone = await group.readMetadata(id, {
          analyse: analyseException,
        });
        expect(gone.ok).toBe(false);
        expect(said(gone)).toContain('HTTP 404');
        logTestSuccess(testsLogger, title);
      } catch (error) {
        logTestError(testsLogger, title, error);
        throw error;
      } finally {
        if (created && !deleted) {
          const cleaned = await deleteUnderLock(group, id).catch(() => false);
          if (!cleaned) {
            testsLogger.warn?.(
              `type group ${name} could not be deleted after the failure; delete it by hand`,
            );
          }
        }
        logTestEnd(testsLogger, title);
      }
    },
    getTimeout('test'),
  );
});

/** Lock, delete, unlock: whether the delete succeeded. */
async function deleteUnderLock(
  group: ReturnType<AdtClientOnPrem['getTypeGroup']>,
  id: { typeGroupName: string; transportRequest?: string | undefined },
): Promise<boolean> {
  const locked = await group.lock(id, { analyse: analyseException });
  if (!locked.ok) return false;
  const handle = locked.getResult().value;
  try {
    const deleted = await group.delete(id, {
      headers: integrationHeadersOf(group, 'delete'),
      lockHandle: handle,
      analyse: analyseException,
    });
    return deleted.ok;
  } finally {
    await group.unlock(id, handle, { analyse: analyseException });
  }
}
