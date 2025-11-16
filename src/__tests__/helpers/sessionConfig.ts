/**
 * Session configuration helper for integration tests
 * Reads session/lock settings from test-config.yaml and manages session lifecycle
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  AbapConnection,
  BaseAbapConnection,
  ISessionStorage,
  FileSessionStorage,
  SapConfig
} from '@mcp-abap-adt/connection';
import { getLockStateManager } from '../../utils/lockStateManager';

interface SessionConfig {
  persist_session?: boolean;
  sessions_dir?: string;
  session_id_format?: string;
  cleanup_session_after_test?: boolean;
}

interface LockConfig {
  locks_dir?: string;
  persist_locks?: boolean;
  cleanup_locks_after_test?: boolean;
}

interface TestConfig {
  session_config?: SessionConfig;
  lock_config?: LockConfig;
}

/**
 * Generate session ID based on test name and timestamp
 * Includes random component to ensure uniqueness even when tests run in parallel
 */
export function generateSessionId(testName: string, format: string = 'auto'): string {
  if (format !== 'auto') {
    return format;
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9); // 7 random chars
  const sanitized = testName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitized}_${timestamp}_${random}`;
}

/**
 * Load test configuration from YAML
 */
export function loadTestConfig(configPath?: string): TestConfig {
  const yamlPath = configPath || path.resolve(__dirname, '../../../tests/test-config.yaml');

  if (!fs.existsSync(yamlPath)) {
    return {
      session_config: { persist_session: false },
      lock_config: { persist_locks: false }
    };
  }

  try {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    return yaml.parse(content) as TestConfig;
  } catch (error) {
    console.warn(`Failed to load test config: ${error}`);
    return {
      session_config: { persist_session: false },
      lock_config: { persist_locks: false }
    };
  }
}

/**
 * Setup connection with session persistence based on test config
 */
export async function setupConnectionWithSession(
  connection: AbapConnection,
  testName: string,
  testConfig?: TestConfig
): Promise<{
  sessionId: string | null;
  sessionStorage: ISessionStorage | null;
}> {
  const config = testConfig || loadTestConfig();
  const sessionConfig = config.session_config;

  if (!sessionConfig?.persist_session) {
    return { sessionId: null, sessionStorage: null };
  }

  const sessionId = generateSessionId(testName, sessionConfig.session_id_format || 'auto');

  // Resolve sessions_dir: if absolute path, use as-is; if relative, resolve from process.cwd()
  // This allows users to specify custom paths in their config or use relative paths from their working directory
  // Standard behavior: relative paths are resolved from current working directory, not project root
  let sessionDir = sessionConfig.sessions_dir || '.sessions';
  if (!path.isAbsolute(sessionDir)) {
    // Resolve relative to current working directory (standard behavior)
    sessionDir = path.resolve(process.cwd(), sessionDir);
  }

  // Log session setup for debugging
  if (process.env.DEBUG_TESTS === 'true') {
    console.log(`[SessionConfig] Setting up session:`, {
      testName,
      sessionId,
      sessionDir,
      sessions_dir_from_config: sessionConfig.sessions_dir,
      cwd: process.cwd()
    });
  }

  const sessionStorage = new FileSessionStorage({
    sessionDir: sessionDir,
    prettyPrint: true
  });

  // Type assertion: createAbapConnection returns BaseAbapConnection which has enableStatefulSession
  const baseConnection = connection as unknown as BaseAbapConnection;
  await baseConnection.enableStatefulSession(sessionId, sessionStorage);

  // Note: Cookies will be obtained automatically on first POST request via ensureFreshCsrfToken
  // For GET requests, if cookies are needed, they will be obtained from error responses
  // (see updateCookiesFromResponse in fetchCsrfToken error handling)

  return { sessionId, sessionStorage };
}

/**
 * Cleanup session after test
 */
export async function cleanupSession(
  connection: AbapConnection,
  sessionId: string | null,
  testConfig?: TestConfig
): Promise<void> {
  if (!sessionId) {
    return;
  }

  const config = testConfig || loadTestConfig();
  const sessionConfig = config.session_config;

  if (sessionConfig?.cleanup_session_after_test) {
    // Type assertion: createAbapConnection returns BaseAbapConnection which has clearSessionState
    const baseConnection = connection as unknown as BaseAbapConnection;
    await baseConnection.clearSessionState();
  }
}

/**
 * Setup lock tracking based on test config
 */
export function setupLockTracking(testConfig?: TestConfig): {
  enabled: boolean;
  locksDir: string;
  autoCleanup: boolean;
} {
  const config = testConfig || loadTestConfig();
  const lockConfig = config.lock_config;

  return {
    enabled: lockConfig?.persist_locks !== false,
    locksDir: lockConfig?.locks_dir || '.locks',
    autoCleanup: lockConfig?.cleanup_locks_after_test !== false
  };
}

/**
 * Complete test helper - setup both session and lock tracking
 */
export async function setupTestEnvironment(
  connection: AbapConnection,
  testName: string,
  testFile?: string
): Promise<{
  sessionId: string | null;
  sessionStorage: ISessionStorage | null;
  lockTracking: {
    enabled: boolean;
    locksDir: string;
    autoCleanup: boolean;
  };
  testConfig: TestConfig;
}> {
  const testConfig = loadTestConfig();

  const { sessionId, sessionStorage } = await setupConnectionWithSession(
    connection,
    testName,
    testConfig
  );

  const lockTracking = setupLockTracking(testConfig);

  // Initialize lock manager with custom directory if needed
  if (lockTracking.enabled && lockTracking.locksDir !== '.locks') {
    getLockStateManager(lockTracking.locksDir);
  }

  return {
    sessionId,
    sessionStorage,
    lockTracking,
    testConfig
  };
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(
  connection: AbapConnection,
  sessionId: string | null,
  testConfig?: TestConfig
): Promise<void> {
  await cleanupSession(connection, sessionId, testConfig);
}

/**
 * Get SAP configuration from environment variables
 * Used in unit tests to create connections
 */
export function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config: SapConfig = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : (authType as 'basic' | 'jwt'),
  };

  if (client) {
    config.client = client;
  }

  if (authType === 'jwt' || authType === 'xsuaa') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

