/**
 * Test configuration helper
 * Provides SAP configuration from environment variables
 */

import type { AgentOptions } from 'node:https';
import {
  BasicAuthProvider,
  CloudHttpTransport,
  LegacyOnPremHttpTransport,
  OnPremHttpTransport,
  RfcTransport,
  rfcConversationFrom,
  type SapConfig,
  TokenAuthProvider,
} from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  IAdtClientOptions,
  IAuthProvider,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../clients/AdtClient';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { createAdtClient } from '../../clients/createAdtClient';
import { getSystemInformation } from '../../utils/systemInfo';
import {
  type ISessionMaterial,
  type ISessionSharing,
  publishSessionMaterial,
  readSessionMaterial,
  SharedCloudConnector,
  SharedOnPremConnector,
} from './sharedSession';
import { createConnectionLogger, createRunIntegrityLogger } from './testLogger';

/**
 * Whether this machine has SAP configured at all.
 *
 * The one legitimate reason a test file may skip its whole suite: a checkout
 * with no `.env`, where nothing could possibly run. Everything else — a missing
 * `environment.system`, an unparseable `test-config.yaml`, an expired token, a
 * host that refuses the session — is a fault, and a fault that skips is a fault
 * nobody sees.
 */
export function sapIsConfigured(): boolean {
  const url = process.env.SAP_URL?.split('#')[0].trim();
  return !!url && /^https?:\/\//.test(url);
}

/**
 * What a test's `beforeAll` does when setup threw.
 *
 * Returns `false` — meaning "no SAP here, skip" — for the one case that is
 * genuinely a skip, and rethrows everything else.
 *
 * This exists because the shape it replaces was a trap. Every test file caught
 * whatever setup threw, warned "No .env file or SAP configuration found", and
 * set `hasConfig = false`; every `it` then returned early and the file reported
 * PASS. So an incomplete configuration, a token that expired mid-run, or a
 * connector that could not open a session all produced the same thing: a green
 * run that had tested nothing, explaining itself with a sentence that was false
 * on a machine where SAP was configured perfectly well.
 *
 * A skip is now only ever "there is no SAP here". Anything else fails, loudly,
 * naming what actually went wrong.
 */
export function skipUnlessConfigured(error: unknown, logger: ILogger): false {
  if (!sapIsConfigured()) {
    logger.warn?.(
      '⚠️ Skipping tests: SAP_URL is not set — no system to run against.',
    );
    return false;
  }
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(
    `Test setup failed against ${process.env.SAP_URL} — this is a failure, not a skip.\n` +
      `  ${reason}\n\n` +
      'SAP is configured on this machine, so the setup was expected to work. ' +
      'Check test-config.yaml (environment.system must be "onprem" or "cloud"), ' +
      'the credentials in .env, and that the system is reachable.',
    { cause: error },
  );
}

/**
 * Get connection_type from test-config.yaml environment section.
 * Returns 'http' (default) or 'rfc'.
 *
 * Exported because a suite occasionally has to know: an RFC conversation is one
 * ABAP session for its whole life, and a handful of ADT flows cannot be
 * expressed inside a single session at all. See messageClass.
 */
export function getConnectionType(): 'http' | 'rfc' {
  const { getEnvironmentConfig } = require('./test-helper');
  try {
    const envConfig = getEnvironmentConfig();
    return envConfig.connection_type === 'rfc' ? 'rfc' : 'http';
  } catch {
    return 'http';
  }
}

/**
 * Get SAP configuration from environment variables
 * Used in tests to create connections
 */
export function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE;
  const authType = rawAuthType
    ? rawAuthType.split('#')[0].trim().toLowerCase()
    : '';

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  // RFC transport overrides auth type — RFC connections use username/password
  // but route through SADT_REST_RFC_ENDPOINT instead of HTTP
  const connectionType = getConnectionType();
  if (connectionType === 'rfc') {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'Missing SAP_USERNAME or SAP_PASSWORD for RFC connection',
      );
    }
    return {
      url,
      authType: 'basic',
      connectionType: 'rfc',
      client: client || undefined,
      username,
      password,
    };
  }

  // Keep tests compatible with both modes:
  // - explicit SAP_AUTH_TYPE (basic|jwt|xsuaa)
  // - implicit JWT mode when token is provided without SAP_AUTH_TYPE
  const hasJwtToken = Boolean(process.env.SAP_JWT_TOKEN);
  const effectiveAuthType: 'basic' | 'jwt' =
    authType === 'jwt' || authType === 'xsuaa'
      ? 'jwt'
      : authType === 'basic'
        ? 'basic'
        : hasJwtToken
          ? 'jwt'
          : 'basic';

  const config: SapConfig = {
    url,
    authType: effectiveAuthType,
  };

  if (client) {
    config.client = client;
  }

  if (effectiveAuthType === 'jwt') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;

    const refreshToken = process.env.SAP_REFRESH_TOKEN;
    if (refreshToken) {
      config.refreshToken = refreshToken;
    }

    const uaaUrl = process.env.SAP_UAA_URL || process.env.UAA_URL;
    const uaaClientId =
      process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret =
      process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'Missing SAP_USERNAME or SAP_PASSWORD for basic authentication',
      );
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

/**
 * Resolve masterSystem/responsible for AdtClient options.
 * Cloud: from systeminformation endpoint.
 * On-premise: masterSystem from test-config.yaml, responsible from the SAP_USERNAME
 * env var, upper-cased — the login IS the responsible person here.
 */
export async function resolveSystemContext(
  connection: IAbapConnection,
  isCloud: boolean,
): Promise<
  Pick<
    IAdtClientOptions,
    'masterSystem' | 'responsible' | 'unicode' | 'masterLanguage'
  >
> {
  const { getEnvironmentConfig } = require('./test-helper');
  // Optional master/original language for created objects (e.g. "DE", "ZH").
  // Empty/undefined → the library defaults to EN. Sourced from test-config so
  // each system can pin a language it actually has installed.
  const masterLanguage =
    getEnvironmentConfig().default_master_language || undefined;

  if (isCloud) {
    const systemInfo = await getSystemInformation(connection);
    return {
      masterSystem: systemInfo?.systemID,
      responsible: systemInfo?.userName,
      unicode: true,
      masterLanguage,
    };
  }
  const envConfig = getEnvironmentConfig();
  const rawUnicode = process.env.SAP_UNICODE;
  const unicode = rawUnicode
    ? rawUnicode.trim().toLowerCase() !== 'false'
    : undefined;
  return {
    masterSystem: envConfig.default_master_system,
    // On-prem the responsible person is simply the logged-on user — cloud is the
    // one that gets it from the system. Upper-cased because the user master
    // record stores it that way and ADT validates against it: E19 answered a
    // package create with `400 Enter a valid user, not okyslytsia, as the person
    // responsible`, on the same credential it had just authenticated.
    responsible: process.env.SAP_USERNAME?.split('#')[0].trim().toUpperCase(),
    unicode,
    masterLanguage,
  };
}

/**
 * Check if test-config.yaml marks the system as legacy (BASIS < 7.50).
 */
export function isLegacyEnvironment(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadTestConfig } = require('./test-helper');
  const testConfig = loadTestConfig();
  return testConfig?.environment?.is_legacy === true;
}

/**
 * Which system the tests are pointed at, from `environment.system`.
 *
 * Stated in the config, never worked out from the URL or the credential: the
 * two systems do not manage sessions the same way, and asking the server which
 * it is does not answer — `/sap/bc/adt/core/http/sessions` replies on both, and
 * its `DELETE` on on-prem leaves the session open while the platform logoff
 * removes it. Whoever wrote the config knows where it points; nothing else does.
 */
export function getTargetSystem(): 'onprem' | 'cloud' {
  const { getEnvironmentConfig } = require('./test-helper');
  const stated = getEnvironmentConfig()?.system;
  if (stated === 'onprem' || stated === 'cloud') return stated;
  throw new Error(
    'test-config.yaml: environment.system must be "onprem" or "cloud". ' +
      'It is not derived from SAP_URL or from the authentication type — a bearer ' +
      'token against on-prem and a communication user against cloud are both ' +
      'ordinary, and guessing gets one of them wrong.',
  );
}

/**
 * The one place a test gets a connection.
 *
 * Every test used to build its own with `createAbapConnection(config, logger)`,
 * in eighty-six files, which meant eighty-six chances to differ in which system
 * was assumed, which logger was passed, and whether `connect()` was called at
 * all. This takes both from the configuration — where we are dialling, and how
 * we authenticate — and returns a connection that is already open.
 *
 * The logger is the shared one, so every test's connection logs the same way.
 */
export async function createTestConnection(
  logger: ILogger = createConnectionLogger(),
): Promise<IAbapConnection & ISessionLifecycleAware & ISessionSharing> {
  const config = getConfig();
  const system = getTargetSystem();
  const credential = credentialFor(config);
  // `client` is not decoration: SAP answers `sap-usercontext` with the system
  // default rather than the client that was asked for, and later requests then
  // route to a client nobody named.
  const wire = { client: config.client, baseUrl: config.url };

  const connection =
    system === 'cloud'
      ? new SharedCloudConnector(
          config,
          credential,
          new CloudHttpTransport(materialOf(credential), logger, wire),
          logger,
        )
      : new SharedOnPremConnector(
          config,
          credential,
          onPremWire(config, logger, wire),
          logger,
        );

  // Join the session globalSetup opened, rather than asking for another. The
  // trial grants two at a time, and a suite that took one per file was already
  // spending fifty-three of them on work that is one conversation.
  //
  // No material means nobody published any — a single file run on its own —
  // and opening one is then the right thing.
  const shared = readSessionMaterial();
  if (shared) connection.adoptSession(shared);

  // Still connect(): adopting the cookies does not make the connection
  // usable — `isConnected()` is what the connector checks before it sends
  // anything, and only connect() sets it. With the cookies already in the jar
  // this lands on the session that exists instead of opening one; measured, the
  // `SAP_SESSIONID` comes back identical.
  await connection.connect();

  // Say so when the run's session was NOT the one this file ended up on.
  //
  // Compared on the `SAP_SESSIONID` cookie, which is the ABAP session — the
  // thing locks are bound to. NOT on `getSessionId()`: that is our own
  // conversation id, sent as `sap-adt-connection-id`, and `adoptSession()` sets
  // it from the material, so comparing it compares a value with itself. A first
  // version did exactly that and reported a clean run, which proved nothing.
  //
  // A session that dies mid-run takes down whichever test is running, and SAP's
  // `Session Timed Out or Not Found` names the test rather than the cause — so
  // it reads as that test being broken. Measured on E19: two full runs in seven
  // lost the session once, with the run continuously busy, the session 3m35s
  // old, no logoff from this side and no network event. Whatever the cause, the
  // swap itself should not be silent.
  const abapSession = (cookies: string | null | undefined) =>
    /SAP_SESSIONID_[A-Z0-9_]+=([^;]+)/.exec(cookies ?? '')?.[1];

  if (shared) {
    const before = abapSession(shared.cookies);
    const after = abapSession(connection.exportSession().cookies);
    if (before && after && before !== after) {
      // Not `logger`: the connection logger is `emptyLogger` unless DEBUG_TESTS
      // is set, and a swap nobody sees is the whole problem.
      createRunIntegrityLogger().warn?.(
        `⚠️ Session swapped: the run published ABAP session ${before} but this file is on ${after}. ` +
          'Anything held against the old one — locks, and writes under them — is gone.',
      );
    }
  }

  return connection;
}

/**
 * What releasing a connection needs of it, and no more.
 *
 * Structural rather than an interface from the library: RFC exposes `close()`,
 * HTTP exposes `disconnect()`, and the harness has always had to handle both
 * without knowing which it holds.
 */
export interface IReleasableConnection {
  close?: () => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  connect?: () => Promise<unknown>;
  exportSession?: () => ISessionMaterial;
}

/** close() first, because RFC has only that; disconnect() is the ADT one. */
async function endSession(conn: IReleasableConnection): Promise<void> {
  if (typeof conn.close === 'function') {
    await conn.close();
  } else if (typeof conn.disconnect === 'function') {
    await conn.disconnect();
  }
}

/**
 * Give a connection back at the end of a test file.
 *
 * A test file does not own the session it works on. `globalSetup` opens one for
 * the whole run and publishes it; every file adopts that one. On on-prem
 * `disconnect()` is the platform logoff — it ends the session for EVERYONE, so
 * the first file to reach `afterAll` took the session away from every file
 * after it.
 *
 * Measured on E19: `discovery` and `search` each pass alone; run together, the
 * second one fails `ADT_NOT_CONNECTED` — whichever of the two that is. Remove
 * both `disconnect()` calls and both pass. Across the full suite it cost 38 red
 * suites, and worse, some green ones: a dead session sends
 * `isModernAdtSystem()` into its `catch`, which reports the system as legacy,
 * so files skipped their tests as "not available for legacy environment" and
 * reported PASS having run nothing. `sqlQuery.test.ts` passed that way in the
 * full run and fails when run alone.
 *
 * So a file releases only a session it opened itself — the single-file run,
 * where nobody published shared material and the session would otherwise sit
 * until the server's idle timeout.
 */
export async function releaseTestConnection(
  connection: IReleasableConnection | undefined | null,
): Promise<void> {
  if (!connection) return;
  // Material on disk means the run owns the session, and `globalTeardown` is
  // the one place that knows the run is over.
  if (readSessionMaterial()) return;
  await endSession(connection);
}

/**
 * End the session mid-file and take a fresh one.
 *
 * `cleanup_session_after_test` exists to drop locks a failed step left behind,
 * by ending the session holding them. On a shared session that is still a
 * logoff for everyone, so the replacement must be published — otherwise the
 * files that follow adopt the session this just ended, which is the same defect
 * one level down.
 */
export async function recycleTestSession(
  connection: IReleasableConnection | undefined | null,
): Promise<void> {
  if (!connection) return;
  const wasShared = readSessionMaterial() !== null;
  await endSession(connection);
  if (typeof connection.connect === 'function') {
    await connection.connect();
  }
  if (wasShared && typeof connection.exportSession === 'function') {
    publishSessionMaterial(connection.exportSession());
  }
}

/**
 * The credential, from what the configuration says the authentication is.
 *
 * A test names neither the class nor the flow: `.env` says how we authenticate
 * and this turns that into the provider that does it.
 */
function credentialFor(config: SapConfig): IAuthProvider {
  if (config.authType === 'jwt') {
    // A bare string, deliberately: the token in `.env` is what a test run has,
    // and there is nothing behind it to renew from. It is good for the length
    // of a run — which is why an expired one must fail loudly rather than be
    // mistaken for "SAP is not configured here".
    return new TokenAuthProvider(config.jwtToken as string);
  }
  return new BasicAuthProvider(
    config.username as string,
    config.password as string,
  );
}

/**
 * The TLS material a wire should present, asked for when the wire needs it.
 *
 * A thunk rather than a value because the material is loaded during
 * `connect()`: a wire that read it at construction would read nothing, and
 * mTLS would silently not happen — the connection builds, the requests go out,
 * and the server refuses them for a reason that says nothing about the
 * certificate.
 */
function materialOf(credential: IAuthProvider): () => AgentOptions {
  return () => credential.transportMaterial() as AgentOptions;
}

/**
 * Which on-prem wire, from the configuration.
 *
 * Three deployments, and the caller states which: ordinary HTTP, the legacy one
 * (BASIS < 7.50, where the session-type header sends locks to ABAP session
 * memory instead of the enqueue server — this was the `skipSessionType` flag),
 * and RFC, for a system where stateful HTTP sessions are not usable at all.
 */
function onPremWire(
  config: SapConfig,
  logger: ILogger,
  wire: { client?: string; baseUrl?: string },
): OnPremHttpTransport | RfcTransport {
  if (getConnectionType() === 'rfc') {
    return new RfcTransport(rfcConversationFrom(config), logger);
  }
  const material = materialOf(credentialFor(config));
  return isLegacyEnvironment()
    ? new LegacyOnPremHttpTransport(material, logger, wire)
    : new OnPremHttpTransport(material, logger, wire);
}

/**
 * Get connection options for createAbapConnection.
 * Legacy systems need skipSessionType: true so the x-sap-adt-sessiontype
 * header is not sent — otherwise locks go to ABAP session memory instead
 * of the global enqueue server, causing HTTP 423 on subsequent requests.
 */
export function getConnectionOptions():
  | { skipSessionType?: boolean }
  | undefined {
  return isLegacyEnvironment() ? { skipSessionType: true } : undefined;
}

/**
 * Create the appropriate AdtClient based on system capabilities.
 * Modern systems (S/4 HANA, BTP) get AdtClient.
 * Legacy systems (BASIS < 7.50) get AdtClientLegacy.
 *
 * Respects is_legacy: true from test-config.yaml to force legacy client
 * (auto-detection via /sap/bc/adt/core/discovery is unreliable for HTTP
 * connections to legacy systems — discovery returns XML on any system).
 */
export async function createTestAdtClient(
  connection: IAbapConnection,
  logger: ILogger,
  options?: IAdtClientOptions,
): Promise<{ client: AdtClient; isLegacy: boolean }> {
  if (isLegacyEnvironment()) {
    const client = new AdtClientLegacy(connection, logger, options);
    return { client, isLegacy: true };
  }

  const client = await createAdtClient(connection, logger, options);
  const isLegacy = client instanceof AdtClientLegacy;
  return { client, isLegacy };
}
