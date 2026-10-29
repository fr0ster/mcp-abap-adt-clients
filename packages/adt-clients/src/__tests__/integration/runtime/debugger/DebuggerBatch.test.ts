/** Measurement only: whole exchanges survive Jest forceExit in the system temp directory. */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  analyseDebuggeeEnd,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtResponse,
  IAdtRunnable,
  IDebuggerIdentity,
  IDebuggerStepMethod,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { XMLParser } from 'fast-xml-parser';
import { AdtBatchConnection } from '../../../../batch';
import { parseBatchResponse } from '../../../../batch/wire';
import { ClassExecutor } from '../../../../executors/class/ClassExecutor';
import { classExecutorDocuments } from '../../../../index.executors';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../../runtime/debugger/AbapDebugger';
import {
  buildChildVariablesXml,
  buildDebuggerBatchPayload,
  buildVariablesXml,
  DEBUGGER_CHILD_VARIABLES_CONTENT_TYPE,
  DEBUGGER_VARIABLES_CONTENT_TYPE,
  executeBatchRequest,
} from '../../../../runtime/debugger/abap';
import { createRequestId } from '../../../../runtime/debugger/batchPayload';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { assertBatchStatuses } from '../../../helpers/batchStatuses';
import { configuredCase, gate } from '../../../helpers/caseGate';
import { CleanupSteps } from '../../../helpers/cleanupSteps';
import { expectResult } from '../../../helpers/contract';
import {
  ensureDebugTarget,
  markerLines,
  sharedSource,
} from '../../../helpers/debuggerTargets';
import { settleRun } from '../../../helpers/runSettlement';
import {
  closeOwnTestConnection,
  createTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import { logTestStep } from '../../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

const testCase = configuredCase('runtime_debugger', 'adt_abap_debugger');
const CLASS_NAME: string = (
  testCase?.params?.class_name ?? 'ZAC_SHR_DBG_PROBE'
).toUpperCase();
const HOLD_SECONDS = 30;
const STEP_TIMEOUT = 120_000;

/**
 * The probe: the shared class `AbapDebugger.test.ts` stops in too
 * (`shared_dependencies.classes`), never created or deleted here. Its
 * `"BP:<name>` markers name the lines the measurements stop at.
 */
const SOURCE = sharedSource('classes', CLASS_NAME);
const LINE = markerLines(SOURCE, '"BP:');
const MARKERS = ['loop', 'add'];
const SOURCE_URI = `/sap/bc/adt/oo/classes/${CLASS_NAME.toLowerCase()}/source/main`;

// --- reading the documents ------------------------------------------------------

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}

function tag(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];
}

interface IFrame {
  position: number;
  program: string;
  event: string;
  line: number;
}

function frames(stackXml: string): IFrame[] {
  return [...stackXml.matchAll(/<stackEntry\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((e) => attr(e, 'stackType') === 'ABAP')
    .map((e) => ({
      position: Number(attr(e, 'stackPosition')),
      program: attr(e, 'programName') ?? '',
      event: attr(e, 'eventName') ?? '',
      line: Number(attr(e, 'line')),
    }));
}

/** The answer's document, whether the member succeeded or failed. */
function documentOf(answer: IAdtResponse<unknown>): string {
  return answer.ok
    ? String(answer.getResult().value ?? '')
    : String(answer.getError().response?.data ?? '');
}

function subtypeOf(answer: IAdtResponse<unknown>): string | undefined {
  return /subType">([^<]*)</.exec(documentOf(answer))?.[1];
}

function statusOf(answer: IAdtResponse<unknown>): number | undefined {
  return answer.ok ? 200 : answer.getError().response?.status;
}

function identityFor(user: string): IDebuggerIdentity {
  const requestUser = user.toUpperCase();
  const id = (suffix: string): string =>
    createHash('sha256')
      .update(`${process.env.SAP_URL}:${requestUser}:${suffix}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  return {
    debuggingMode: 'user',
    requestUser,
    terminalId: id('terminalId'),
    ideId: id('ideId'),
  };
}

/**
 * The ABAP user the session runs as — the one breakpoints and listeners are
 * keyed on. Basic authentication names it; with a token (the cloud) the login
 * is an e-mail and the ABAP user is another name, so the system is asked.
 */
async function abapUserOf(connection: IAbapConnection): Promise<string> {
  const configured = process.env.SAP_USERNAME?.trim();
  if (configured) return configured;
  const answer = await connection.makeAdtRequest({
    url: '/sap/bc/adt/core/http/systeminformation',
    method: 'GET',
    timeout: 30_000,
    headers: {
      Accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
    },
  });
  const info =
    typeof answer.data === 'string' ? JSON.parse(answer.data) : answer.data;
  if (!info?.userName) throw new Error('the system named no ABAP user');
  return String(info.userName);
}

// --- the test --------------------------------------------------------------------

type Connection = IAbapConnection & ISessionLifecycleAware;

/** The probe class runs through classrun. */
const asClass = (connection: Connection) =>
  new ClassExecutor(connection, {
    logger: connectionLogger,
    results: classExecutorDocuments,
  });

describe('Debugger batch wire measurements', () => {
  let listenerConnection: Connection | undefined;
  let triggerConnection: Connection | undefined;
  /** Arms breakpoints and listens; never attaches. */
  let listenerApi: AbapDebugger;
  /** The debug session: a connection of its own, opened after each catch. */
  let sessionConnection: Connection | undefined;
  let debuggerApi: AbapDebugger;
  let identity: IDebuggerIdentity;

  const armed: string[] = [];
  let run: Promise<IAdtResponse<unknown>> | undefined;
  let attached = false;

  /** Fails the step naming what it waited on, instead of running blind. */
  function needs(condition: unknown, what: string): void {
    if (!condition) throw new Error(`not reached: ${what}`);
  }

  /**
   * Listen, start the program on the other session through any runnable — a
   * class, a report, whatever implements IAdtRunnable — and answer what was
   * caught.
   */
  async function catchRun<TTarget>(
    runnable: (connection: Connection) => IAdtRunnable<TTarget, unknown>,
    target: TTarget,
  ): Promise<{ debuggeeId: string; server?: string }> {
    const listener = listenerApi.listen(identity, {
      analyse: analyseException,
      holdSeconds: HOLD_SECONDS,
    });
    const early = await Promise.race([
      listener,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), 2000),
      ),
    ]);
    if (early && !early.ok) {
      throw new Error(
        `the listener was refused (${statusOf(early)} ${subtypeOf(early) ?? ''}): another debugger holds ${identity.requestUser}'s debugging — close it and run again`,
      );
    }
    const trigger = triggerConnection;
    needs(trigger, 'the trigger connection');
    run = runnable(trigger as Connection).run(target, {
      analyse: analyseException,
    });
    const caught = await listener;
    const document = documentOf(caught);
    expect(caught.ok).toBe(true);
    const debuggeeId = tag(document, 'DEBUGGEE_ID');
    needs(
      debuggeeId,
      `a debuggee in the listener's answer: ${document.slice(0, 300)}`,
    );
    expect(tag(document, 'DBGEE_KIND')).toBe('DEBUGGEE');
    // The debuggee's application server, which the attach is routed to.
    return {
      debuggeeId: debuggeeId as string,
      server: tag(document, 'INSTANCE_NAME'),
    };
  }

  /**
   * Open the debug session the next attach goes on: a new connection, never
   * the listener's, and the attach routed to the debuggee's server. Measured
   * (2026-10-09): on the cloud, an attach on the listener's connection is
   * refused 500 invalidDebuggee whenever the debuggee runs on another
   * application server; on a new connection routed by saplb it succeeded 10
   * of 10, 5 of them across servers. On premise, a connection that has
   * attached once cannot attach again (500 "Debuggee already attached").
   */
  async function openDebugSession(): Promise<void> {
    const previous = sessionConnection;
    sessionConnection = await createTestConnection(connectionLogger, {
      ownSession: true,
    });
    sessionConnection.setSessionType('stateful');
    debuggerApi = new AbapDebugger(sessionConnection, {
      logger: connectionLogger,
      results: abapDebuggerDocuments,
    });
    if (previous) {
      previous.setSessionType('stateless');
      await closeOwnTestConnection(previous);
    }
  }

  async function topFrame(): Promise<IFrame> {
    const stack = await debuggerApi.getStack({ analyse: analyseException });
    const top = frames(documentOf(stack))[0];
    needs(stack.ok && top, 'a stack');
    return top;
  }

  beforeAll(async () => {
    for (const name of [
      'stepInto',
      'stepOver',
      'stepReturn',
      'stepContinue',
      'step_stack_variables',
      'stack_children',
      ...measurementNames,
    ]) {
      if (!configuredCase('debugger_batch', name)) {
        throw new Error(`case debugger_batch/${name} not in test-config.yaml`);
      }
    }
    for (const name of measurementNames) {
      measurementSteps(name);
    }
    if (!testCase) {
      throw new Error('runtime_debugger.adt_abap_debugger params are required');
    }
    try {
      listenerConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
      triggerConnection = await createTestConnection(connectionLogger, {
        ownSession: true,
      });
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      throw error;
    }
    identity = identityFor(await abapUserOf(listenerConnection));
    logTestStep(`debugging as ${identity.requestUser}`, testsLogger);
    listenerApi = new AbapDebugger(listenerConnection, {
      logger: connectionLogger,
      results: abapDebuggerDocuments,
    });
    await ensureDebugTarget(
      listenerConnection,
      'classes',
      CLASS_NAME,
      { marker: '"BP:', names: MARKERS },
      testsLogger,
    );
    logTestStep(`probe ${CLASS_NAME} active`, testsLogger);

    // Every debugger request needs the stateful session it attached on.
    listenerConnection.setSessionType('stateful');
    const breakpoints = await listenerApi.setBreakpoints(
      identity,
      [
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.loop}` },
        { kind: 'line', uri: `${SOURCE_URI}#start=${LINE.add}` },
      ],
      {
        analyse: analyseException,
        headers: integrationHeadersOf(listenerApi, 'setBreakpoints'),
      },
    );
    if (!breakpoints.ok) throw new Error('Could not arm probe breakpoints');
    armed.push(
      ...[
        ...documentOf(breakpoints).matchAll(
          /<breakpoint\b[^>]*\bid="([^"]*)"/g,
        ),
      ].map((m) => m[1]),
    );
  }, STEP_TIMEOUT);

  afterAll(async () => {
    // Debugger state only: the probe is shared and stays. Every step runs,
    // every session this file opened is logged off, and every failure is
    // reported at the end.
    const steps = new CleanupSteps();
    if (listenerApi && identity) {
      for (const id of armed) {
        await steps.run(
          `delete breakpoint ${id}`,
          () =>
            listenerApi.deleteBreakpoint(identity, id, {
              analyse: analyseException,
            }),
          { checkAnswer: true },
        );
      }
    }
    if (attached) {
      await steps.run(
        'terminate debuggee',
        () => debuggerApi.terminateDebuggee({ analyse: analyseDebuggeeEnd }),
        {
          checkAnswer: true,
        },
      );
    }
    await steps.logOff('the debug session', sessionConnection);
    if (listenerApi && identity) {
      await steps.run(
        'stop listener',
        () => listenerApi.stopListener(identity, { analyse: analyseException }),
        {
          checkAnswer: true,
        },
      );
    }
    if (run) {
      // The run must come back, with its output or a termination's 500, and
      // is let go only once it has: a timeout or another answer fails.
      const pending = run;
      await steps.run('wait for run', async () => {
        await settleRun(pending, 15_000, 'the run', 'completed-or-terminated');
        run = undefined;
      });
    }
    await steps.logOff('the trigger session', triggerConnection);
    await steps.logOff('the listener session', listenerConnection);
    for (const [name, report] of [
      ['write the measurement summary', writeMeasurementSummary],
      ['compare the measurement histories', compareMeasurementHistories],
    ] as const) {
      await steps.run(name, () => report());
    }
    steps.finish();
  }, STEP_TIMEOUT);

  async function startAtBreakpoint(): Promise<void> {
    const { debuggeeId, server } = await catchRun(asClass, {
      className: CLASS_NAME,
    });
    await openDebugSession();
    const answer = await debuggerApi.attach(identity, debuggeeId, {
      analyse: analyseException,
      server,
    });
    if (!answer.ok) throw new Error(`attach: ${documentOf(answer)}`);
    attached = true;
    await topFrame();
  }

  afterEach(async () => {
    if (attached) {
      attached = false;
      // On premise 500 subtype terminateDebuggee, on the cloud 200: either is
      // the debuggee ended as asked, and analyseDebuggeeEnd reads both so.
      // Anything else fails the test: a debuggee left attached holds the
      // work process the next test needs.
      expectResult(
        await debuggerApi.terminateDebuggee({ analyse: analyseDebuggeeEnd }),
        'terminate the debuggee',
      );
    }
    if (run) {
      // Kept until it has settled with an accepted answer, so afterAll tries
      // again when this fails.
      await settleRun(run, 15_000, 'the run', 'completed-or-terminated');
      run = undefined;
    }
  }, STEP_TIMEOUT);

  // Keep Eclipse's spelling, header spacing and closing empty line verbatim.
  function inner(query: string, body?: string, contentType?: string): string {
    return (
      `POST /sap/bc/adt/debugger?${query} HTTP/1.1\r\n` +
      `sap-adt-request-id:${createRequestId().padEnd(32, '0')}\r\n` +
      // A body-carrying part asks for its own type back, as the member does:
      // with application/xml SAP answers 406 "Accepted content types:
      // application/vnd.sap.as+xml" (measured inside the batch on an on-premise system).
      `Accept:${contentType ?? 'application/xml'}\r\n` +
      (contentType ? `Content-Type:${contentType}\r\n` : '') +
      `\r\n${body === undefined ? '' : `${body}\r\n\r\n`}`
    );
  }

  const stackRequest = () => inner('emode=_&semanticURIs=true&method=getStack');
  const exchangeDir = fs.mkdtempSync(
    path.join(tmpdir(), 'adt-debugger-batch-'),
  );

  async function measure(label: string, requests: string[]): Promise<void> {
    needs(
      sessionConnection && attached,
      'an attached stateful debug connection',
    );
    const payload = buildDebuggerBatchPayload(requests);
    const file = path.join(exchangeDir, `${label}.txt`);
    const request = `POST /sap/bc/adt/debugger/batch\r\nContent-Type: multipart/mixed; boundary=${payload.boundary}\r\nAccept: multipart/mixed\r\n\r\n${payload.body}`;
    // Persist before sending too, so a transport failure still leaves the request.
    fs.writeFileSync(file, request);
    testsLogger.info?.(`Debugger batch exchange: ${file}`);
    let response: IAdtWireResponse;
    try {
      response = await executeBatchRequest(
        sessionConnection as Connection,
        payload,
      );
    } catch (error) {
      const failed = (error as { response?: IAdtWireResponse }).response;
      fs.writeFileSync(
        file,
        `${request}\nRESPONSE\n${failed ? JSON.stringify({ status: failed.status, headers: failed.headers }) : String(error)}\n${String(failed?.data ?? '')}`,
      );
      throw error;
    }
    const body = String(response.data ?? '');
    const contentType = String(
      Object.entries(response.headers ?? {}).find(
        ([key]) => key.toLowerCase() === 'content-type',
      )?.[1] ?? '',
    );
    const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
    const parts = boundary
      ? body
          .split(`--${boundary[1] ?? boundary[2]}`)
          .slice(1)
          .filter((part) => !part.startsWith('--'))
      : [];
    const statuses = parts.map(
      (part) => /^HTTP\/[^\r\n]+/m.exec(part)?.[0] ?? '(no inner status line)',
    );
    fs.writeFileSync(
      file,
      `${request}\nRESPONSE\nStatus: ${response.status}\nHeaders: ${JSON.stringify(response.headers, null, 2)}\nInner statuses: ${JSON.stringify(statuses)}\n\n${body}`,
    );
    testsLogger.info?.(
      `Debugger batch ${label}: ${statuses.join('; ')}; exchange: ${file}`,
    );
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(parts).toHaveLength(requests.length);
    assertBatchStatuses(response, file);
  }

  const measurementNames = [
    'multi_step_variables',
    'multi_step_variables_client',
    'loop_client_per_step',
    'multi_step_variables_direct',
  ] as const;
  const timings: Partial<Record<(typeof measurementNames)[number], number>> =
    {};
  const histories: Partial<Record<(typeof measurementNames)[number], string>> =
    {};
  const measurementDescriptions = {
    multi_step_variables: 'one envelope (primitives)',
    multi_step_variables_client: 'recording client one execute',
    loop_client_per_step: 'client per step (N envelopes)',
    multi_step_variables_direct: 'direct (2N+1 requests)',
  };
  const timingFile = path.join(exchangeDir, 'timings.txt');

  function measurementSteps(name: (typeof measurementNames)[number]): number {
    const steps = Number(configuredCase('debugger_batch', name)?.params?.steps);
    needs(
      Number.isInteger(steps) && steps > 0,
      `a positive integer steps for debugger_batch/${name}`,
    );
    return steps;
  }

  function completedMeasurements(): (typeof measurementNames)[number][] {
    return measurementNames.filter((name) => histories[name] !== undefined);
  }

  function writeMeasurementSummary(): void {
    const completed = completedMeasurements();
    const summary = [
      ...measurementNames.map(
        (name) =>
          `\n${name} VARIABLE HISTORY\n${histories[name] ?? 'not completed'}`,
      ),
      `\nHistory comparison: ${completed.length >= 2 ? `${completed.length} completed cases compared below` : 'requires at least two completed cases'}`,
    ].join('\n');
    fs.appendFileSync(timingFile, `${summary}\n`);
    testsLogger.info?.(
      `Debugger measurement summary: ${timingFile}\n${summary}`,
    );
  }

  function compareMeasurementHistories(): void {
    const completed = completedMeasurements();
    for (const name of completed.slice(1)) {
      expect(histories[name]).toBe(histories[completed[0]]);
    }
  }

  // The captured debugger-conversation--19-variables-in-double.body.xml has
  // DATA/STPDA_ADT_VARIABLE rows with ID, NAME and VALUE (not attributes).
  // adt-strategies currently supplies no debugger variable result reading.
  function variableValues(xml: string): Record<string, string> {
    const parsed = new XMLParser({
      removeNSPrefix: true,
      parseTagValue: false,
      trimValues: true,
      isArray: (name) => name === 'STPDA_ADT_VARIABLE',
    }).parse(xml);
    const rows = parsed?.abap?.values?.DATA?.STPDA_ADT_VARIABLE ?? [];
    const values: Record<string, string> = {};
    for (const row of rows) {
      if (row.ID !== undefined && row.VALUE !== undefined)
        values[String(row.ID)] = String(row.VALUE).trim();
    }
    return values;
  }

  for (const name of measurementNames) {
    gate('debugger_batch', name)(
      `${name}: stepOver variable history`,
      async () => {
        const steps = measurementSteps(name);
        await startAtBreakpoint();
        const frame = await topFrame();
        needs(frame.line === LINE.loop, 'the loop breakpoint in the probe');
        const children = await debuggerApi.getChildVariables(['@LOCALS'], {
          analyse: analyseException,
          headers: integrationHeadersOf(debuggerApi, 'getChildVariables'),
        });
        const total = [
          ...documentOf(children).matchAll(
            /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
          ),
        ].find((row) => tag(row[1], 'NAME') === 'LV_TOTAL');
        const totalId = total && tag(total[1], 'ID');
        needs(
          children.ok && totalId,
          'LV_TOTAL id from stopped frame children',
        );
        const ids = ['SY-INDEX', totalId as string];
        const file = path.join(exchangeDir, `${name}.txt`);
        fs.writeFileSync(file, `${name}: ${steps} steps\n`);
        testsLogger.info?.(`Debugger batch exchange: ${file}`);
        const reads: string[] = [];
        const envelopes: { response: IAdtWireResponse; expected: number }[] =
          [];
        let envelopesSent = 0;
        let expected = 0;
        // Capture the recording client's actual envelopes too, including any
        // negotiation retries: a hidden second envelope must fail this probe.
        const recordingConnection = new Proxy(sessionConnection as Connection, {
          get(target, property) {
            if (property === 'makeAdtRequest') {
              return async (
                request: Parameters<Connection['makeAdtRequest']>[0],
              ) => {
                envelopesSent++;
                fs.appendFileSync(
                  file,
                  `\nREQUEST ${envelopesSent}\n${JSON.stringify(request, null, 2)}\n`,
                );
                try {
                  const response = await target.makeAdtRequest(request);
                  fs.appendFileSync(
                    file,
                    `\nRESPONSE ${envelopesSent}\n${JSON.stringify(response.headers)}\nStatus: ${response.status}\n${String(response.data)}\n`,
                  );
                  if (name !== 'multi_step_variables_direct')
                    envelopes.push({ response, expected });
                  return response;
                } catch (error) {
                  const response = (error as { response?: IAdtWireResponse })
                    .response;
                  fs.appendFileSync(
                    file,
                    `\nFAILED\n${String(error)}\n${JSON.stringify(response)}\n`,
                  );
                  throw error;
                }
              };
            }
            const value = Reflect.get(target, property);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        const batch =
          name === 'multi_step_variables_direct'
            ? undefined
            : new AdtBatchConnection(recordingConnection, {
                endpoint: 'debugger',
              });
        const api = new AbapDebugger(batch ?? recordingConnection, {
          logger: connectionLogger,
          results: abapDebuggerDocuments,
        });
        const answers: IAdtResponse<unknown>[] = [];
        let elapsed = 0;
        try {
          // The comparison starts with the same baseline, outside its N envelopes.
          if (name === 'loop_client_per_step') {
            const baseline = await debuggerApi.getVariables(ids, {
              analyse: analyseException,
              headers: integrationHeadersOf(debuggerApi, 'getVariables'),
            });
            fs.appendFileSync(
              file,
              `\nBASELINE (outside timing)\n${documentOf(baseline)}\n`,
            );
            needs(baseline.ok, `baseline variables: ${documentOf(baseline)}`);
            reads.push(documentOf(baseline));
          }
          const started = performance.now();
          try {
            if (name === 'multi_step_variables_direct') {
              answers.push(
                await api.getVariables(ids, {
                  analyse: analyseException,
                  headers: integrationHeadersOf(api, 'getVariables'),
                }),
              );
              for (let i = 0; i < steps; i++) {
                answers.push(
                  await api.step('stepOver', { analyse: analyseException }),
                );
                answers.push(
                  await api.getVariables(ids, {
                    analyse: analyseException,
                    headers: integrationHeadersOf(api, 'getVariables'),
                  }),
                );
              }
            } else if (name === 'multi_step_variables') {
              const requests = [
                inner(
                  'method=getVariables',
                  buildVariablesXml(ids),
                  DEBUGGER_VARIABLES_CONTENT_TYPE,
                ),
              ];
              for (let i = 0; i < steps; i++) {
                requests.push(
                  inner('method=stepOver'),
                  inner(
                    'method=getVariables',
                    buildVariablesXml(ids),
                    DEBUGGER_VARIABLES_CONTENT_TYPE,
                  ),
                );
              }
              expected = requests.length;
              await executeBatchRequest(
                recordingConnection,
                buildDebuggerBatchPayload(requests),
              );
            } else {
              const rounds = name === 'loop_client_per_step' ? steps : 1;
              for (let round = 0; round < rounds; round++) {
                const pending: Promise<IAdtResponse<unknown>>[] = [];
                if (name === 'multi_step_variables_client')
                  pending.push(
                    api.getVariables(ids, {
                      analyse: analyseException,
                      headers: integrationHeadersOf(api, 'getVariables'),
                    }),
                  );
                for (let i = 0; i < (rounds === 1 ? steps : 1); i++) {
                  pending.push(
                    api.step('stepOver', { analyse: analyseException }),
                    api.getVariables(ids, {
                      analyse: analyseException,
                      headers: integrationHeadersOf(api, 'getVariables'),
                    }),
                  );
                }
                expected = pending.length;
                // Observe rejections immediately, even if execute itself fails.
                const settled = Promise.allSettled(pending);
                try {
                  await batch!.execute();
                } finally {
                  for (const result of await settled) {
                    if (result.status === 'fulfilled')
                      answers.push(result.value);
                  }
                }
              }
            }
          } finally {
            elapsed = performance.now() - started;
          }
        } finally {
          timings[name] = elapsed;
          const timingTable = measurementNames
            .map(
              (key) =>
                `${key} (${measurementDescriptions[key]}): ${timings[key] === undefined ? 'not run' : `${timings[key].toFixed(3)} ms`}`,
            )
            .join('\n');
          fs.writeFileSync(timingFile, `${timingTable}\n`);
          for (const key of measurementNames) {
            const exchange = path.join(exchangeDir, `${key}.txt`);
            if (fs.existsSync(exchange))
              fs.appendFileSync(
                exchange,
                `\nTIMINGS (excludes setup and baseline)\n${timingTable}\n`,
              );
          }
          testsLogger.info?.(timingTable);
          for (const { response } of envelopes) {
            const statuses = [
              ...String(response.data).matchAll(/^HTTP\/[^\r\n]+/gm),
            ].map((match) => match[0]);
            fs.appendFileSync(
              file,
              `\nInner statuses: ${JSON.stringify(statuses)}\n`,
            );
          }
        }
        for (const { response, expected: count } of envelopes) {
          expect(response.status).toBeGreaterThanOrEqual(200);
          expect(response.status).toBeLessThan(300);
          const parts = parseBatchResponse(response);
          expect(parts).toHaveLength(count);
          for (const [index, part] of parts.entries()) {
            if (part.status !== 200)
              throw new Error(
                `Batch part ${index + 1}: ${part.status}; ${String(part.data)}; exchange: ${file}`,
              );
          }
          if (name === 'multi_step_variables') {
            reads.push(
              ...parts
                .filter((_, index) => index % 2 === 0)
                .map((part) => String(part.data)),
            );
          }
        }
        expect(envelopesSent).toBe(
          name === 'multi_step_variables_direct'
            ? 2 * steps + 1
            : name === 'loop_client_per_step'
              ? steps
              : 1,
        );
        if (name === 'multi_step_variables_direct')
          expect(answers).toHaveLength(2 * steps + 1);
        if (name !== 'multi_step_variables') {
          for (const [index, answer] of answers.entries()) {
            needs(
              answer.ok,
              `member ${index + 1}: ${documentOf(answer)}; exchange: ${file}`,
            );
            if (
              name === 'loop_client_per_step'
                ? index % 2 === 1
                : index % 2 === 0
            )
              reads.push(documentOf(answer));
          }
        }
        // Each read is its own getVariables answer body, without request echoes.
        // A variable can leave scope while stepping into the add method.
        const values = reads.map(variableValues);
        const table = [
          'step | SY-INDEX | LV_TOTAL',
          ...values.map(
            (row, index) =>
              `${index} | ${ids.map((id) => row[id] ?? '—').join(' | ')}`,
          ),
        ].join('\n');
        fs.appendFileSync(file, `\nVARIABLE HISTORY\n${table}\n`);
        testsLogger.info?.(`${name}\n${table}\nexchange: ${file}`);
        expect(values).toHaveLength(steps + 1);
        needs(
          values.every((row) => ids.some((id) => row[id] !== undefined)),
          `at least one requested variable visible in every read; exchange: ${file}`,
        );
        for (const id of ids) {
          const distinct = new Set(
            values.map((row) => row[id]).filter((value) => value !== undefined),
          );
          needs(
            distinct.size >= 2,
            `at least two distinct values for ${id} across reads; exchange: ${file}`,
          );
        }
        histories[name] = table;
      },
      STEP_TIMEOUT,
    );
  }

  const methods: IDebuggerStepMethod[] = [
    'stepInto',
    'stepOver',
    'stepReturn',
    'stepContinue',
  ];
  for (const method of methods) {
    gate('debugger_batch', method)(
      `${method} + getStack (Eclipse envelope)`,
      async () => {
        await startAtBreakpoint();
        // stepReturn is measured inside add, so it has a caller to return to.
        if (method === 'stepReturn') {
          const entered = await debuggerApi.step('stepInto', {
            analyse: analyseException,
          });
          if (!entered.ok) throw new Error(`enter add: ${documentOf(entered)}`);
          await topFrame();
        }
        await measure(method, [inner(`method=${method}`), stackRequest()]);
      },
      STEP_TIMEOUT,
    );
  }

  gate('debugger_batch', 'step_stack_variables')(
    'step + stack + body-carrying getVariables',
    async () => {
      await startAtBreakpoint();
      const children = await debuggerApi.getChildVariables(['@LOCALS'], {
        analyse: analyseException,
        headers: integrationHeadersOf(debuggerApi, 'getChildVariables'),
      });
      const rows = [
        ...documentOf(children).matchAll(
          /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
        ),
      ];
      const variable = rows.find((row) => tag(row[1], 'NAME') === 'LV_TOTAL');
      const id = variable && tag(variable[1], 'ID');
      needs(children.ok && id, 'LV_TOTAL id from the stopped frame children');
      await measure('step-stack-variables', [
        inner('method=stepOver'),
        stackRequest(),
        inner(
          'method=getVariables',
          buildVariablesXml([id as string]),
          DEBUGGER_VARIABLES_CONTENT_TYPE,
        ),
      ]);
    },
    STEP_TIMEOUT,
  );

  gate('debugger_batch', 'stack_children')(
    'getStack + getChildVariables without stepping',
    async () => {
      await startAtBreakpoint();
      await measure('stack-children', [
        stackRequest(),
        inner(
          'method=getChildVariables',
          buildChildVariablesXml(['@LOCALS']),
          DEBUGGER_CHILD_VARIABLES_CONTENT_TYPE,
        ),
      ]);
    },
    STEP_TIMEOUT,
  );
  gate('batch', 'debugger_client')(
    'recording client: step + stack + variables',
    async () => {
      await startAtBreakpoint();
      const children = await debuggerApi.getChildVariables(['@LOCALS'], {
        analyse: analyseException,
        headers: integrationHeadersOf(debuggerApi, 'getChildVariables'),
      });
      const rows = [
        ...documentOf(children).matchAll(
          /<STPDA_ADT_VARIABLE>([\s\S]*?)<\/STPDA_ADT_VARIABLE>/g,
        ),
      ];
      const row = rows.find((row) => tag(row[1], 'NAME') === 'LV_TOTAL');
      const id = row && tag(row[1], 'ID');
      needs(children.ok && id, 'LV_TOTAL id from the stopped frame children');
      const batch = new AdtBatchConnection(sessionConnection as Connection, {
        endpoint: 'debugger',
        logger: connectionLogger,
      });
      batch.setSessionType('stateful');
      const api = new AbapDebugger(batch, {
        logger: connectionLogger,
        results: abapDebuggerDocuments,
      });
      const pending = [
        api.step('stepOver', { analyse: analyseException }),
        api.getStack({ analyse: analyseException }),
        api.getVariables([id as string], {
          analyse: analyseException,
          headers: integrationHeadersOf(api, 'getVariables'),
        }),
      ];
      await batch.execute();
      for (const answer of await Promise.all(pending))
        expect(answer.ok).toBe(true);
    },
    STEP_TIMEOUT,
  );
});
