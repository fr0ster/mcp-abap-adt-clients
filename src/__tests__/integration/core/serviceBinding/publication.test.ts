/**
 * Publishing a service binding, and unpublishing it — two deliberate runs.
 *
 * **Not part of the full suite, and both cases ship `enabled: false`.** A
 * publication is the slowest thing this library asks of ADT: ~135s measured on a
 * trial, and one unpublish still unsettled after eleven minutes. ADT also
 * refuses to delete a binding whose endpoints are published, so a flow that
 * publishes cannot clean up after itself — which is why the workflow test keeps
 * `desired_publication_state: "unchanged"` and these two live here.
 *
 * ## A timeout is not an answer
 *
 * The publication endpoint is a **job**. Measured on the trial: the client gave
 * up at 120s with `timeout of 120000ms exceeded`, and the binding came back
 * `published="true"` — the job had finished, the connection had not. So a
 * refusal on the write is where this test *starts* asking, not where it stops:
 * it polls the binding's own document until the state flips or the configured
 * budget runs out.
 *
 * That division is the library's rule, not this file's convenience:
 * **adt-clients issues one request and never polls an async job.** Waiting is
 * the consumer's, and a test is a consumer.
 *
 * ## And the write is counted, not asserted
 *
 * `update` used to read the binding before posting the job — to derive the
 * service name, to short-circuit when the state was already right, and to
 * refuse a transition ADT refuses itself. One member, two endpoints. This file
 * said the write was one request and did not count, so it would have passed
 * either way; it counts now.
 *
 * ## Running them
 *
 * ```bash
 * # 1. publish_service_binding.enabled: true
 * npm test -- integration/core/serviceBinding/publication 2>&1 | tee publish.log
 * # 2. check it in Eclipse ADT — the report below says exactly where
 * # 3. unpublish_service_binding.enabled: true (publish back to false)
 * npm test -- integration/core/serviceBinding/publication 2>&1 | tee unpublish.log
 * ```
 */

import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../../clients/AdtClient';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { createTestsLogger } from '../../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../../helpers/testProgressLogger';

// `require`, like every other integration file here: the helper is JavaScript
// and has no declaration file.
// biome-ignore lint/correctness/noNodejsModules: the helper is CommonJS
const { getEnabledTestCase } = require('../../../helpers/test-helper');

const testsLogger: ILogger = createTestsLogger();

/** Everything both cases take from `test-config.yaml`, and nothing hardcoded. */
interface IPublicationCase {
  bindingName: string;
  serviceName: string;
  serviceVersion: string;
  serviceType: 'odatav2' | 'odatav4';
  timeoutMs: number;
  waitMinutes: number;
  pollSeconds: number;
}

function caseFrom(section: string): IPublicationCase | undefined {
  const testCase = getEnabledTestCase(section);
  if (!testCase) return undefined;
  const p = testCase.params ?? {};
  return {
    bindingName: p.binding_name,
    serviceName: p.service_name,
    serviceVersion: String(p.service_version ?? '0001'),
    serviceType: (p.service_type ?? 'odatav4') as 'odatav2' | 'odatav4',
    timeoutMs: Number(p.timeout_ms ?? 300000),
    waitMinutes: Number(p.wait_minutes ?? 5),
    pollSeconds: Number(p.poll_seconds ?? 15),
  };
}

/** What the binding's own document says about publication, right now. */
async function stateOf(
  client: AdtClient,
  bindingName: string,
): Promise<{ published?: string; allowedAction?: string; bytes: number }> {
  const answer = await client
    .getServiceBinding()
    .read({ bindingName }, 'active');
  if (!answer.ok) return { bytes: 0 };
  const doc = String(answer.getResult().value);
  return {
    published: /srvb:published="([^"]*)"/.exec(doc)?.[1],
    allowedAction: /srvb:allowedAction="([^"]*)"/.exec(doc)?.[1],
    bytes: doc.length,
  };
}

/**
 * Everything a person needs to check this by hand in Eclipse ADT.
 *
 * Printed whatever the outcome — a run that failed is the one where somebody
 * most needs to know what to open.
 */
function reportFor(
  c: IPublicationCase,
  state: { published?: string; allowedAction?: string },
  baseUrl: string,
): void {
  const path = `/sap/bc/adt/businessservices/bindings/${c.bindingName.toLowerCase()}`;
  const lines = [
    '',
    '─── check it in Eclipse ADT ───────────────────────────────────────────',
    `  system            ${baseUrl}`,
    `  service binding   ${c.bindingName}      (Ctrl+Shift+A → ${c.bindingName})`,
    `  service           ${c.serviceName}, version ${c.serviceVersion}, ${c.serviceType}`,
    '',
    `  published         ${state.published ?? '—'}`,
    `  allowedAction     ${state.allowedAction ?? '—'}`,
    '',
    '  In the binding editor the Local Service Endpoint is listed when it is',
    '  published, and the button reads Unpublish; when it is not, the button',
    '  reads Publish and no endpoint is shown.',
    '',
    `  the document this test read:  ${baseUrl}${path}`,
    '─────────────────────────────────────────────────────────────────────',
  ];
  for (const line of lines) testsLogger.info?.(line);
}

describe('Service binding publication (deliberate runs)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let baseUrl = '';
  let hasConfig = false;
  /**
   * Every request this test's client makes, in order.
   *
   * Recorded by wrapping `makeAdtRequest` on the connection: the claim being
   * checked is *how many* requests a member issues, and only the wire can
   * settle that.
   */
  const requests: { method: string; url: string }[] = [];

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
      baseUrl = await connection.getBaseUrl();
      const original = connection.makeAdtRequest.bind(connection);
      connection.makeAdtRequest = (async (config: {
        url: string;
        method?: string;
      }) => {
        requests.push({ method: config.method ?? 'GET', url: config.url });
        return original(config as never);
      }) as typeof connection.makeAdtRequest;
      hasConfig = true;
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  /**
   * One state change, and the waiting that belongs to the caller.
   *
   * The write is one request. What follows is this test asking the server what
   * happened, because a job that outlives its connection is a thing only the
   * object's own document can settle.
   */
  async function change(
    c: IPublicationCase,
    desired: 'published' | 'unpublished',
  ): Promise<void> {
    const target = desired === 'published' ? 'true' : 'false';

    const before = await stateOf(client, c.bindingName);
    logTestStep(
      `before: published=${before.published ?? '—'} allowedAction=${before.allowedAction ?? '—'}`,
      testsLogger,
    );
    if (before.published === target) {
      testsLogger.info?.(
        `already ${desired}; nothing to do — the run still reports the state below`,
      );
      reportFor(c, before, baseUrl);
      return;
    }

    logTestStep(
      `${desired}: one request, up to ${Math.round(c.timeoutMs / 1000)}s`,
      testsLogger,
    );
    // Counted on the wire, because "one request" is the claim under test.
    const before_count = requests.length;
    const started = Date.now();
    const answer = await client.getServiceBinding().update(
      {
        bindingName: c.bindingName,
        desiredPublicationState: desired,
        // The binding and the protocol. The service name and version are read
        // from config for the Eclipse report below, and deliberately not passed
        // here: the job's URL carries no query string and its body names the
        // target by type and name, so they would go nowhere.
        serviceType: c.serviceType,
      },
      { timeout: c.timeoutMs },
    );
    const spent = Math.round((Date.now() - started) / 1000);

    const issued = requests.slice(before_count);
    logTestStep(
      `the write issued ${issued.length} request(s): ${issued.map((r) => `${r.method} ${r.url}`).join(', ')}`,
      testsLogger,
    );
    expect(issued).toHaveLength(1);
    expect(issued[0].method).toBe('POST');
    expect(issued[0].url).toContain(
      `/${desired === 'published' ? 'publish' : 'unpublish'}jobs`,
    );
    // No query string: Eclipse sends none, and the job answers `OK` without one.
    expect(issued[0].url).not.toContain('?');

    if (answer.ok) {
      logTestStep(`the request answered after ${spent}s`, testsLogger);
    } else {
      // Not a verdict about the job. Measured: the client gave up at 120s and
      // the binding was published anyway.
      logTestStep(
        `the request did not answer after ${spent}s (${answer.getError().message}) — now asking the server`,
        testsLogger,
      );
    }

    const deadline = Date.now() + c.waitMinutes * 60_000;
    let state = await stateOf(client, c.bindingName);
    while (state.published !== target && Date.now() < deadline) {
      const left = Math.round((deadline - Date.now()) / 1000);
      logTestStep(
        `still published=${state.published ?? '—'}; ${left}s of the ${c.waitMinutes}-minute budget left`,
        testsLogger,
      );
      await new Promise((r) => setTimeout(r, c.pollSeconds * 1000));
      state = await stateOf(client, c.bindingName);
    }

    const took = Math.round((Date.now() - started) / 1000);
    logTestStep(
      `settled at published=${state.published ?? '—'} after ${took}s`,
      testsLogger,
    );
    reportFor(c, state, baseUrl);

    expect(state.published).toBe(target);
  }

  it('publishes, and leaves it published for inspection', async () => {
    const c = caseFrom('publish_service_binding');
    if (!hasConfig || !c) {
      logTestSkip(
        testsLogger,
        'ServiceBinding - publish',
        !hasConfig
          ? 'No SAP configuration'
          : 'publish_service_binding is disabled — this is a deliberate run',
      );
      return;
    }
    await change(c, 'published');
  }, 1_500_000);

  it('unpublishes, once the published state has been checked', async () => {
    const c = caseFrom('unpublish_service_binding');
    if (!hasConfig || !c) {
      logTestSkip(
        testsLogger,
        'ServiceBinding - unpublish',
        !hasConfig
          ? 'No SAP configuration'
          : 'unpublish_service_binding is disabled — this is a deliberate run',
      );
      return;
    }
    await change(c, 'unpublished');
  }, 1_500_000);
});
