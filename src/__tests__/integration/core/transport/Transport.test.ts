/**
 * Unit test for AdtRequest
 * Tests create/read operations for transport requests
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ADT library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=transport/Transport
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ITransportObjectEntry } from '@mcp-abap-adt/adt-strategies';
import {
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import { ADT_TASK_TYPE } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import {
  getSystemInformation,
  isCloudEnvironment,
} from '../../../../utils/systemInfo';
import { patchXmlElement } from '../../../../utils/xmlPatch';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  gateOn,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult, failureOf, releasing } from '../../../helpers/contract';
import { judged } from '../../../helpers/judged';
import { expectLockReleased } from '../../../helpers/lockReleased';
import { presenceOf } from '../../../helpers/objectPresence';
import {
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
import { transportParsing } from '../../../helpers/transportParsing';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');
const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('AdtRequest', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isLegacy = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    // Outermost, and before the connection goes back: an inner `describe`'s
    // `afterAll` runs when that block finishes, so a cleanup placed there ran
    // before the later blocks had created anything — measured, one of three
    // transports deleted.
    //
    // They *can* be deleted, and this suite is why the system had nine of them.
    // "Transports cannot be deleted, so no cleanup needed" is what stood here,
    // and it is not true: ADT deletes an EMPTY request, which is what these are
    // — created, read, never written to.
    //
    // A refusal fails the suite, after every delete ran and the connection is
    // back: a request this suite created and could not remove is the leftover
    // this cleanup exists to prevent. One that still holds objects is the
    // server protecting them — and a run that left objects in it.
    const leftovers: string[] = [];
    for (const number of createdTransports) {
      const answer = await client.getRequest().delete(
        { transportNumber: number },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getRequest(), 'delete'),
        },
      );
      if (answer.ok) {
        testsLogger.info?.(`Deleted test transport ${number}`);
      } else {
        leftovers.push(failureOf(answer, `delete test transport ${number}`));
      }
    }
    createdTransports.length = 0;

    if (connection) {
      await releaseTestConnection(connection);
    }
    if (leftovers.length > 0) {
      throw new Error(`Cleanup failed: ${leftovers.join('; ')}`);
    }
  });

  /**
   * Every transport this suite created, so `afterAll` can take them back out.
   */
  const createdTransports: string[] = [];

  function getTestDefinition() {
    return getTestCaseDefinition('create_transport', 'builder_transport');
  }

  function buildConfig(testCase: any): {
    description: string;
    transportType?: string;
    owner?: string;
    targetSystem?: string;
  } {
    const params = testCase?.params || {};
    return {
      description: params.description || '',
      transportType: params.transport_type || 'workbench',
      owner: params.owner,
      targetSystem: params.target_system,
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;

    beforeAll(async () => {
      // The gate registered the test, so the case is configured, enabled and
      // available here; a case that is not there is a defect, not a skip.
      testCase = configuredCase('create_transport', 'builder_transport');
    });

    gate('create_transport', 'builder_transport')(
      'should execute full workflow: create and read transport',
      async () => {
        const definition = getTestDefinition();
        logTestStart(testsLogger, 'AdtRequest - full workflow', definition);

        if (!testCase) {
          throw new Error(
            missingCaseMessage('create_transport', 'builder_transport'),
          );
        }

        let transportNumber: string | null = null;

        try {
          logTestStep('create', testsLogger);
          const created = expectResult(
            await client
              .getRequest(transportParsing)
              .create(buildConfig(testCase) as any, {
                analyse: analyseException,
                headers: integrationHeadersOf(
                  client.getRequest(transportParsing),
                  'create',
                ),
              }),
            'create transport request',
          );

          // A create that answers no number is a create nothing else can use.
          expect(created.transportNumber).toMatch(/\S/);

          transportNumber = created.transportNumber || null;
          if (transportNumber) createdTransports.push(transportNumber);

          // The read is part of the workflow: a refused or throwing read fails
          // it (the request is still deleted by afterAll).
          if (transportNumber) {
            logTestStep('read', testsLogger);
            const document = expectResult(
              await client.getRequest(transportParsing).readMetadata(
                {
                  transportNumber,
                },
                { analyse: analyseException },
              ),
              `read transport ${transportNumber}`,
            );
            expect(document).toBeDefined();
          }

          logTestSuccess(testsLogger, 'AdtRequest - full workflow');
        } catch (error: any) {
          // A user the system does not know is a defect of the configuration
          // (create_transport/builder_transport `owner`), not a reason to pass.
          const errorData = error.response?.data || '';
          const fullErrorText = `${error.message || ''} ${
            typeof errorData === 'string'
              ? errorData
              : JSON.stringify(errorData)
          }`.toLowerCase();
          if (
            fullErrorText.includes('username not found') ||
            fullErrorText.includes('does not exist in the system') ||
            (fullErrorText.includes('user') &&
              fullErrorText.includes('does not exist'))
          ) {
            logTestError(testsLogger, 'AdtRequest - full workflow', error);
            throw new Error(
              'create_transport/builder_transport names a user the system does not know: fix params.owner in test-config.yaml',
              { cause: error },
            );
          }
          logTestError(testsLogger, 'AdtRequest - full workflow', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AdtRequest - full workflow');
        }
      },
      getTimeout('test'),
    );
  });

  /**
   * The object list and the tasks — what a request can be told to do.
   *
   * These four members arrived in 20.0.0 with nothing live behind them, and
   * the first on-premise run found two of them broken in ways their unit
   * tests could not see, because both defects answer `200`:
   *
   * - `createTask` sent no `tm:targetuser` and the server resolved the owner
   *   to an empty name — `400 SCTS_ADT_MSG 009`, *"User  does not exist"*.
   * - `removeObject` sent no `tm:position` and the server removed nothing
   *   while answering the usual echo document. Twenty-two objects were asked
   *   for by name, twenty-two answers said `200`, and twenty-two entries were
   *   still on the task afterwards.
   *
   * **So this block round-trips rather than asserting `ok`.** It creates one
   * request, creates an object in it, deletes that object — leaving the CTS
   * entry that is the whole reason `removeObject` exists — and then removes
   * the entry and *re-reads the task to prove it is gone*. An answer is not
   * evidence here; the next read is.
   *
   * It creates exactly one request and one task, and deletes both. Nothing it
   * touches belongs to anyone else.
   */
  describe('Object list and tasks', () => {
    /**
     * The entries `readObjects` lists on one request or task.
     *
     * No cast: the member's own type is what this asserts against. Casting
     * `position` to `string` here would put back, in the test, exactly the
     * claim the reading refuses to make — and the suite would keep passing
     * over an entry the server described without one.
     */
    const objectsOn = async (
      number: string,
    ): Promise<ITransportObjectEntry[]> => {
      // A refused read fails: read as an empty list, it would prove an entry
      // gone that was never looked at.
      return expectResult(
        await client
          .getRequest(transportParsing)
          .readObjects(number, { analyse: analyseException }),
        `read the objects of ${number}`,
      );
    };

    /**
     * What a task's own element says its type is.
     *
     * **The attribute is spelled two ways in one document.** On `tm:request`
     * it is the code — `tm:type="K"` — and on `tm:task` it is the expanded
     * text: a task this run had just set to `'S'` read back
     * `tm:type="Development/Correction"`. An assertion on `"S"` therefore
     * fails against a server that did exactly what it was asked, which is how
     * this reader came to exist.
     *
     * The text is also a description, so it is whatever the logon language
     * renders it as. Nothing here compares it to a literal: the caller
     * compares the value before a change with the value after.
     */
    const taskTypeOf = async (
      taskNumber: string,
    ): Promise<{ type: string; document: string }> => {
      const document = String(
        expectResult(
          await client
            .getRequest()
            .readMetadata(
              { transportNumber: taskNumber },
              { analyse: analyseException },
            ),
          `read task ${taskNumber}`,
        ) ?? '',
      );
      const element = (document.match(/<tm:task\s[^>]*?>/g) ?? []).find((t) =>
        t.includes(`tm:number="${taskNumber}"`),
      );
      return { type: element?.match(/tm:type="([^"]*)"/)?.[1] ?? '', document };
    };

    /** The task numbers under a request, in document order. */
    const tasksOf = async (number: string): Promise<string[]> => {
      const document = String(
        expectResult(
          await client.getRequest(transportParsing).readMetadata(
            {
              transportNumber: number,
            },
            { analyse: analyseException },
          ),
          `read request ${number}`,
        ) ?? '',
      );
      return (document.match(/<tm:task\s[^>]*?>/g) ?? [])
        .map((t) => t.match(/tm:number="([^"]*)"/)?.[1])
        .filter((n): n is string => Boolean(n));
    };

    /**
     * Where an object's entry actually sits — **on a task, never on the
     * request above it**.
     *
     * The request's document *shows* its tasks' entries, which is why this
     * block once read one there and addressed `removeObject` at the request.
     * The server refused, and said exactly why: *"Entry R3TR DOMA … does not
     * exist in request/task DEVK9071xx"* — `SCTS_ADT_MSG 009`, for an entry
     * plainly visible in the document it was just read from. It belongs to
     * the task, and only the task can detach it.
     */
    const findEntry = async (
      requestNumber: string,
      name: string,
    ): Promise<{ task: string; position: string } | undefined> => {
      for (const task of await tasksOf(requestNumber)) {
        const entry = (await objectsOn(task)).find((o) => o.name === name);
        if (!entry) continue;
        // An entry with no position is a measurement, not a thing to remove:
        // every one seen so far has carried one, and passing an invented
        // position would be the silent no-op this block exists to catch.
        if (entry.position === undefined) {
          testsLogger.warn?.(
            `${name} is listed on ${task} without a tm:position — not removable`,
          );
          continue;
        }
        return { task, position: entry.position };
      }
      return undefined;
    };

    gate('create_transport', 'builder_transport')(
      'creates a task, frees an object name, and proves the entry is gone',
      async () => {
        const label = 'AdtRequest - object list and tasks';
        logTestStart(testsLogger, label, {
          name: 'object_list_and_tasks',
          params: {},
        });

        const testCase = configuredCase(
          'create_transport',
          'builder_transport',
        );
        const request = client.getRequest(transportParsing);
        const domainName = 'ZAC_TRQ_DOMA01';
        let taskNumber: string | null = null;
        let transportNumber: string | null = null;

        try {
          logTestStep('create the request this block works in', testsLogger);
          const created = expectResult(
            await request.create(buildConfig(testCase) as any, {
              analyse: analyseException,
              headers: integrationHeadersOf(request, 'create'),
            }),
            'create transport request',
          );
          transportNumber = created.transportNumber || null;
          expect(transportNumber).toMatch(/\S/);
          if (transportNumber) createdTransports.push(transportNumber);

          // Read-only, and the record a `removeObject` lands in later.
          logTestStep('read the action log', testsLogger);
          const log = expectResult(
            await request.readActionLog(transportNumber as string, {
              analyse: analyseException,
            }),
            'read the action log',
          );
          expect(String(log ?? '').length).toBeGreaterThan(0);

          // **The owner is named because the server will not choose one**, and
          // the two systems answer "who is that" in different places.
          //
          // `SAP_USERNAME` is the configured one and wins where it is set: it
          // is what an on-premise session is opened with, and naming it is
          // also how a caller asks for a task owned by somebody else. This
          // block read it alone, which was enough until the suite met BTP
          // ABAP — a JWT session has no such variable, so `tm:targetuser=""`
          // went out and the server answered `400 ExceptionInvalidData`. This
          // PR's own defect, re-created by the suite that proves it fixed, and
          // reported as a pass because the refusal returned early.
          //
          // `getSystemInformation` fills that gap and **only that gap**: it
          // reads `/sap/bc/adt/core/http/systeminformation`, which is a cloud
          // endpoint. On-premise there is nothing there, the helper answers
          // the endpoint absent, and the configured name is what is left —
          // which is the one that was right there all along.
          //
          // `createTask` itself asks neither. A member here does not spend a
          // second request to fill in an argument, which is exactly why the
          // contract makes the caller name the user. A test is that caller.
          logTestStep('create a task under it', testsLogger);
          const systemUser = async (): Promise<string | undefined> => {
            const answer = await getSystemInformation(connection);
            if (!answer.ok) throw new Error(answer.getError().message);
            const found = answer.getResult().value;
            return found.present ? found.info.userName : undefined;
          };
          const targetUser =
            (process.env.SAP_USERNAME || '').toUpperCase() ||
            (await systemUser()) ||
            '';
          if (!targetUser) {
            throw new Error(
              'SAP_USERNAME is unset and the system named no user — ' +
                'createTask cannot be measured without an owner',
            );
          }
          logTestStep(`the task will be owned by ${targetUser}`, testsLogger);
          const task = await request.createTask(transportNumber as string, {
            analyse: analyseException,
            headers: integrationHeadersOf(request, 'createTask'),
            targetUser,
          });
          if (!task.ok) {
            // A system that organises no tasks has answered, and that is the
            // measurement. Without one there is nothing to hang an object on,
            // so the round trip below cannot run — and that fails: nothing below
            // it was measured.
            throw new Error(`newtask refused: ${task.getError().message}`);
          }
          taskNumber = (task.getResult().value as { transportNumber: string })
            .transportNumber;
          if (taskNumber) createdTransports.unshift(taskNumber);
          // A task whose number is `''` passes `ok` and is useless to
          // everything after it — the defect review caught once already.
          expect(taskNumber).toMatch(/\S/);
          logTestStep(`newtask answered ${taskNumber}`, testsLogger);

          // **A task is born without a type, and `changeTaskType` is what
          // gives it one.** Measured against BTP ABAP, 2026-09-23: `tm:type`
          // passed to `newtask` is accepted and ignored, and the task reads
          // back as Unclassified. This is the one moment in the suite where a
          // task is known to be fresh, so it is where the member is exercised.
          //
          // The answer is not the evidence — like every user action here, a
          // `200` says the document was understood. **The change is: the type
          // before the call against the type after it.** This asserted
          // `tm:type="S"`, the value sent, and failed against a server that
          // had done exactly what it was asked — see {@link taskTypeOf} for
          // the two spellings that trap. Comparing before with after needs
          // neither spelling nor a language.
          //
          // **A refusal fails this.** It was a warning and a carry-on first,
          // which would have let a wrong endpoint, a wrong document or a
          // missing authorisation pass as a green run — the one thing the step
          // exists to catch. The task above was created by this run and is
          // known to exist, so there is no environment case left for a
          // refusal to mean.
          logTestStep('give the task a type', testsLogger);
          const typeBefore = (await taskTypeOf(taskNumber)).type;
          expectResult(
            await request.changeTaskType(
              taskNumber,
              ADT_TASK_TYPE.developmentCorrection,
              {
                analyse: analyseException,
                headers: integrationHeadersOf(request, 'changeTaskType'),
              },
            ),
            'give the task its type',
          );
          const typeAfter = (await taskTypeOf(taskNumber)).type;
          logTestStep(
            `the task's type went from "${typeBefore}" to "${typeAfter}"`,
            testsLogger,
          );
          expect(typeAfter).not.toBe('');
          expect(typeAfter).not.toBe(typeBefore);

          const packageName = resolvePackageName(undefined);
          if (!packageName) {
            throw new Error(
              'no package configured — the round trip cannot run',
            );
          }

          // **The object goes into the suite's ONE request, not the throwaway
          // above.** This used to create it in the task it had just made, and
          // that is what poisoned the name: every run registered
          // `ZAC_TRQ_DOMA01` in a fresh request, and the first run whose
          // cleanup did not finish left the name locked in a dead one —
          // `CTS_WBO_API 020`, "already locked in request DEVK9071xx", on
          // every run after it, with no request left that anyone would think
          // to look in.
          //
          // In the configured request the leftover is harmless and
          // self-healing: the entry sits where the next run looks for it, and
          // the next run detaches it. The throwaway request above stays empty,
          // which is also the only state ADT will delete.
          const sharedRequest = resolveTransportRequest(undefined);
          if (!sharedRequest) {
            throw new Error(
              'no default_transport configured — the round trip cannot run',
            );
          }

          logTestStep(
            'create an object in the shared request, then delete it',
            testsLogger,
          );
          const domain = client.getDomain();

          // **Never delete blindly here.** This used to call `delete` first,
          // to clear whatever a broken run had left — and that call was what
          // created the leftover it then found. Measured 2026-09-21, on a
          // request holding no entry for the name: the deletion service
          // answers `200` for an object that does not exist, says *"Release
          // transport … to remove the object directory entry"*, and registers
          // the entry. Deleting nothing takes the name hostage.
          //
          // (A raw `DELETE` on the object's own URI answers 400 and registers
          // nothing. The library deletes through
          // `POST /sap/bc/adt/deletion/delete`, which is the one that does
          // this.)
          //
          // So: clear an entry if one is there, and only delete the object
          // once it is known to exist.
          const stale = await findEntry(sharedRequest, domainName);
          if (stale) {
            logTestStep(
              `an entry for ${domainName} is present at ${stale.task}/${stale.position} — clearing it`,
              testsLogger,
            );
            expectResult(
              await request.removeObject(
                stale.task,
                {
                  name: domainName,
                  type: 'DOMA',
                  position: stale.position,
                },
                {
                  analyse: analyseException,
                  headers: integrationHeadersOf(request, 'removeObject'),
                },
              ),
              `clear the stale entry for ${domainName}`,
            );
          }

          // A previous run may have left the object itself, not just an entry.
          // Read before deleting, for the reason above: a delete aimed at
          // nothing is what registers the name.
          // The answer decides — see `presenceOf`; "could not find out" is
          // not "absent".
          const leftover = presenceOf(
            await domain.readMetadata(
              { domainName },
              { analyse: analyseException },
            ),
            `domain ${domainName}`,
          );
          if (leftover.present === 'unknown') throw new Error(leftover.reason);
          if (leftover.present === true) {
            logTestStep(
              `${domainName} still exists — deleting it`,
              testsLogger,
            );
            expectResult(
              await domain.delete(
                {
                  domainName,
                  transportRequest: sharedRequest,
                },
                {
                  analyse: judged(analyseDeletion),
                  headers: integrationHeadersOf(domain, 'delete'),
                },
              ),
              `delete leftover ${domainName}`,
            );
          }

          const madeIt = await domain.create(
            {
              domainName,
              packageName,
              transportRequest: sharedRequest,
              description: 'AdtRequest object-list round trip',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(domain, 'create'),
            },
          );
          if (!madeIt.ok) {
            throw new Error(
              `could not create ${domainName}: ${madeIt.getError().message}`,
            );
          }

          // **The create makes a shell, and only the update gives it a type.**
          // `datatype` and `length` used to be passed to `create`, which does
          // not send them: its POST carries the description, the language and
          // the package reference, and nothing else. The recorded answer shows
          // what comes back — `<doma:datatype/>` empty, `<doma:length>000000`.
          // So every run registered a domain with no data type at all, and the
          // `as any` was what let the two dead fields through the compiler.
          //
          // The update is a replace, never a merge: since 19.0.0 nothing is
          // read on this side to merge into, so the caller sends the WHOLE
          // document. Read it, fill the two elements in, write it back.
          logTestStep(`give ${domainName} its data type`, testsLogger);
          const shellDocument = String(
            expectResult(
              await domain.readMetadata(
                { domainName },
                { analyse: analyseException },
              ),
              `read ${domainName} after create`,
            ) ?? '',
          );
          if (shellDocument.trim() === '') {
            // A 200 with an empty body is how ADT answers a read of something
            // not ready yet, and patching that would build a document out of
            // nothing. Nothing below can run without it.
            throw new Error(
              `${domainName} was created but its document read back empty`,
            );
          }
          const typed = patchXmlElement(
            patchXmlElement(shellDocument, 'doma:datatype', 'CHAR'),
            'doma:length',
            '000004',
          );
          const domainLock = await domain.lock(
            { domainName },
            { analyse: analyseException },
          );
          if (!domainLock.ok) {
            throw new Error(
              `could not lock ${domainName}: ${domainLock.getError().message}`,
            );
          }
          const domainHandle = domainLock.getResult().value;
          await releasing(
            async () =>
              expectResult(
                await domain.updateMetadata(
                  {
                    domainName,
                    packageName,
                    transportRequest: sharedRequest,
                  },
                  {
                    analyse: analyseException,
                    headers: integrationHeadersOf(domain, 'updateMetadata'),
                    source: typed,
                    lockHandle: domainHandle,
                  },
                ),
                `give ${domainName} its data type`,
              ),
            () =>
              domain.unlock({ domainName }, domainHandle, {
                analyse: analyseException,
              }),
            `unlock ${domainName}`,
          );
          await expectLockReleased(
            (c) => c.getDomain(),
            { domainName },
            `domain ${domainName}`,
            testsLogger,
          );

          expectResult(
            await domain.delete(
              { domainName, transportRequest: sharedRequest },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(domain, 'delete'),
              },
            ),
            `delete ${domainName}`,
          );

          logTestStep('find the entry the deletion left behind', testsLogger);
          const entry = await findEntry(sharedRequest, domainName);
          if (entry === undefined) {
            // The system detached it by itself; there is nothing to remove and
            // nothing this member could be measured against. A failure, because
            // `removeObject` was never called.
            throw new Error(
              `${domainName} left no entry under ${sharedRequest} — nothing to remove`,
            );
          }
          logTestStep(
            `entry sits on task ${entry.task} at position ${entry.position}`,
            testsLogger,
          );

          // **Sort and compress the task first, as a task holding the entry
          // twice would need** (TR292). It answers `200` with an empty body,
          // so the evidence is the list after it: the entry is still there,
          // once, and a sort may renumber it — hence the second look-up,
          // whose position the removal below uses.
          logTestStep(
            'sort and compress the task, then find the entry again',
            testsLogger,
          );
          const sorted = await request.sortAndCompress(entry.task, {
            analyse: analyseException,
          });
          expect(sorted.ok).toBe(true);
          const sortedList = await objectsOn(entry.task);
          expect(
            sortedList.filter(
              (o) => o.name === domainName && o.type === 'DOMA',
            ),
          ).toHaveLength(1);
          const resorted = await findEntry(sharedRequest, domainName);
          expect(resorted).toBeDefined();
          if (!resorted) return;

          // **The removal, and then the proof.** `ok` here means the document
          // was understood, not that an entry went away — the re-read is what
          // says so. Addressed at the TASK: the request above it shows the
          // entry and refuses to detach it, saying the entry "does not exist"
          // in itself.
          logTestStep('remove the entry, then re-read the task', testsLogger);
          const removed = await request.removeObject(
            resorted.task,
            {
              name: domainName,
              type: 'DOMA',
              position: resorted.position,
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(request, 'removeObject'),
            },
          );
          expect(removed.ok).toBe(true);

          const after = await objectsOn(resorted.task);
          expect(after.find((o) => o.name === domainName)).toBeUndefined();

          logTestSuccess(testsLogger, label);
        } catch (error: any) {
          logTestError(testsLogger, label, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, label);
        }
      },
      getTimeout('test'),
    );
  });

  describe('List transports', () => {
    gateOn(() => true)(
      'should list transport requests through a saved search configuration',
      async () => {
        logTestStart(testsLogger, 'AdtRequest - list transports', {
          name: 'list_transports',
          params: {},
        });

        try {
          // A body that merely "exists" is not a detector: the historical
          // defect (HTTP 200, a self-closing `<tm:root/>`, zero requests) is
          // itself a well-formed, non-empty body. Checking shape alone stays
          // green on exactly the payload this test exists to catch.
          //
          // The discriminator is a transport request we create ourselves, the
          // same way and from the same config source as the "Full workflow"
          // block (`create_transport` / `builder_transport`). Once it exists,
          // list() MUST surface its number — if list() regresses to an empty
          // root, this fails, because we independently know the request is
          // there.
          let knownTransportNumber: string | null = null;
          const definition = getTestDefinition();
          const testCase = definition
            ? getEnabledTestCase('create_transport', 'builder_transport')
            : null;

          // Configured, the discriminator must be made: a refused or
          // throwing create, or one that answers no number, fails the test —
          // it is never downgraded to the shape-only assertion below.
          if (testCase) {
            logTestStep('create (discriminator transport)', testsLogger);
            const createState = expectResult(
              await client
                .getRequest(transportParsing)
                .create(buildConfig(testCase) as any, {
                  analyse: analyseException,
                  headers: integrationHeadersOf(
                    client.getRequest(transportParsing),
                    'create',
                  ),
                }),
              'create the discriminator transport',
            );
            expect(createState.transportNumber).toMatch(/\S/);
            knownTransportNumber = createState.transportNumber;
            createdTransports.push(createState.transportNumber);
          }

          logTestStep('list', testsLogger);
          // A listing runs a saved search the caller names. The test takes the
          // system's first one, which is the choice `list` used to make itself
          // when a system held exactly one.
          const configs = expectResult(
            await client
              .getRequest(transportParsing)
              .searchConfigurations({ analyse: analyseException }),
            'transport search configurations',
          );
          expect(configs.length).toBeGreaterThan(0);
          // The shipped reading of a listing is the parsed tree, so the
          // assertions below are about requests rather than about a document.
          const tree = expectResult(
            await client
              .getRequest(transportParsing)
              .list({ analyse: analyseException, configUri: configs[0].uri }),
            'list transport requests',
          );

          expect(Array.isArray(tree.requests)).toBe(true);
          const numbers = tree.requests.map((r) => r.attributes['tm:number']);
          const requestCount = tree.requests.length;
          logTestStep(`requests returned: ${requestCount}`, testsLogger);

          if (knownTransportNumber) {
            // Known-request case: the real detector. We created this request
            // moments ago, so its number must appear in the list body.
            logTestStep(
              `known-request case: expecting ${knownTransportNumber} in the list body`,
              testsLogger,
            );
            expect(numbers).toContain(knownTransportNumber);
          } else {
            // No discriminator configured: `create_transport` /
            // `builder_transport` is absent or not enabled. This branch
            // only confirms the tree parsed; it does NOT treat zero requests
            // as suspicious. A system that genuinely holds no transport
            // requests must be able to report zero without being flagged as
            // broken.
            logTestStep(
              'fallback case: no discriminator transport available, ' +
                `asserting response shape only (requests returned: ${requestCount})`,
              testsLogger,
            );
            expect(tree.attributes).toBeDefined();
          }

          logTestSuccess(testsLogger, 'AdtRequest - list transports');
        } catch (error: any) {
          logTestError(testsLogger, 'AdtRequest - list transports', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AdtRequest - list transports');
        }
      },
      getTimeout('test'),
    );
  });
});
