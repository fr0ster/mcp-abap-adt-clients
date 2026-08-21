/**
 * Test configuration helper
 * Provides SAP configuration from environment variables
 */

import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  IAdtClientOptions,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../clients/AdtClient';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { createAdtClient } from '../../clients/createAdtClient';
import { getSystemInformation } from '../../utils/systemInfo';
import { createConnectionLogger } from './testLogger';

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
 */
function getConnectionType(): 'http' | 'rfc' {
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
 * On-premise: masterSystem from test-config.yaml, responsible from SAP_USERNAME env var.
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
    responsible: process.env.SAP_USERNAME,
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
): Promise<IAbapConnection & ISessionLifecycleAware> {
  const { createAbapConnection } = require('@mcp-abap-adt/connection');
  const connection: IAbapConnection & ISessionLifecycleAware =
    createAbapConnection(getConfig(), logger, undefined, undefined, {
      ...getConnectionOptions(),
      system: getTargetSystem(),
    });
  // The connector refuses work on a connection nobody opened, and a test that
  // forgot used to fail somewhere later with something unrelated.
  await connection.connect();
  return connection;
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
