/**
 * Session configuration helper for integration tests
 * Reads session/lock settings from test-config.yaml and manages session lifecycle
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  BaseAbapConnection,
  ISessionStorage,
  FileSessionStorage
} from '@mcp-abap-adt/connection';
import { getLockStateManager } from '../../utils/lockStateManager';interface SessionConfig {
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
 */
export function generateSessionId(testName: string, format: string = 'auto'): string {
  if (format !== 'auto') {
    return format;
  }

  const timestamp = Date.now();
  const sanitized = testName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitized}_${timestamp}`;
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
  connection: BaseAbapConnection,
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
  const sessionStorage = new FileSessionStorage({
    sessionDir: sessionConfig.sessions_dir || '.sessions',
    prettyPrint: true
  });

  await connection.enableStatefulSession(sessionId, sessionStorage);

  return { sessionId, sessionStorage };
}

/**
 * Cleanup session after test
 */
export async function cleanupSession(
  connection: BaseAbapConnection,
  sessionId: string | null,
  testConfig?: TestConfig
): Promise<void> {
  if (!sessionId) {
    return;
  }

  const config = testConfig || loadTestConfig();
  const sessionConfig = config.session_config;

  if (sessionConfig?.cleanup_session_after_test) {
    await connection.clearSessionState();
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
  connection: BaseAbapConnection,
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
  connection: BaseAbapConnection,
  sessionId: string | null,
  testConfig?: TestConfig
): Promise<void> {
  await cleanupSession(connection, sessionId, testConfig);
}
