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

// Track authentication failures to skip dependent tests
const authFailureMap = new Map<string, boolean>();

/**
 * Mark authentication as failed for a test suite
 */
export function markAuthFailed(testSuiteName: string): void {
  authFailureMap.set(testSuiteName, true);
}

/**
 * Check if authentication failed for a test suite
 */
export function hasAuthFailed(testSuiteName: string): boolean {
  return authFailureMap.get(testSuiteName) === true;
}

/**
 * Clear authentication failure flag for a test suite
 */
export function clearAuthFailure(testSuiteName: string): void {
  authFailureMap.delete(testSuiteName);
}

/**
 * Check if error is an authentication error and mark test suite as failed if so
 * @param error The error to check
 * @param testSuiteName The test suite name to mark as failed
 * @returns true if it's an auth error, false otherwise
 */
export function isAuthError(error: any, testSuiteName?: string): boolean {
  const isAuth = !!(
    error?.message?.includes('JWT token has expired') ||
    error?.message?.includes('authentication') ||
    error?.message?.includes('Authentication') ||
    error?.message?.includes('401') ||
    error?.message?.includes('403') ||
    error?.response?.status === 401 ||
    error?.response?.status === 403
  );

  if (isAuth && testSuiteName) {
    markAuthFailed(testSuiteName);
  }

  return isAuth;
}

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
  test_settings?: {
    cleanup_before_test?: boolean;
    cleanup_after_test?: boolean;
    fail_fast?: boolean;
    verbose?: boolean;
    timeout?: number;
    retry_on_failure?: boolean;
    max_retries?: number;
  };
}

// Global session ID for current test run - shared across all tests in one npm test run
let currentTestRunSessionId: string | null = null;

/**
 * Generate session ID based on test name and timestamp
 * For integration tests, use single shared session ID per test run
 */
export function generateSessionId(testName: string, format: string = 'auto'): string {
  if (format !== 'auto') {
    return format;
  }

  // Use single shared session ID for all tests in current test run
  // This ensures all tests in one npm test run share the same SAP session (CSRF token, cookies)
  // But different test runs get different sessions
  if (!currentTestRunSessionId) {
    const timestamp = Date.now();
    currentTestRunSessionId = `integration_test_${timestamp}`;
  }

  return currentTestRunSessionId;
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
  shouldCleanupBefore: boolean;
  shouldCleanupAfter: boolean;
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

  // Read cleanup configuration from test-config.yaml
  const shouldCleanupBefore = testConfig?.test_settings?.cleanup_before_test ?? true;
  const shouldCleanupAfter = testConfig?.test_settings?.cleanup_after_test ?? true;

  return {
    sessionId,
    sessionStorage,
    lockTracking,
    testConfig,
    shouldCleanupBefore,
    shouldCleanupAfter
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

    // Add refresh token and UAA credentials for auto-refresh capability
    const refreshToken = process.env.SAP_REFRESH_TOKEN;
    if (refreshToken) {
      config.refreshToken = refreshToken;
    }

    const uaaUrl = process.env.SAP_UAA_URL || process.env.UAA_URL;
    const uaaClientId = process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret = process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
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

