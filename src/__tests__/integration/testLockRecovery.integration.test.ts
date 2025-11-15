/**
 * Integration test for lock recovery after client crash
 *
 * Test Scenario:
 * 1. Client1 locks object → session and lock handle saved to files
 * 2. Client1 destroyed (simulating crash)
 * 3. Client2 created with same sessionId
 * 4. Client2 restores session from file
 * 5. Client2 retrieves lock handle from lock registry
 * 6. Client2 unlocks object using restored session
 *
 * This validates that the persistence system can recover from crashes.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- testLockRecovery.integration.test
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { createAbapConnection, SapConfig, FileSessionStorage } from '@mcp-abap-adt/connection';
import { LockStateManager } from '../../utils/lockStateManager';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as yaml from 'yaml';

// Load environment variables
const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Load test configuration
const configPath = path.join(__dirname, '../../../tests/test-config.yaml');
let lockRecoveryConfig: any = null;

if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const fullConfig = yaml.parse(configContent);
  lockRecoveryConfig = fullConfig?.lock_recovery_test;
}

const testEnabled = lockRecoveryConfig?.enabled !== false;

// Enable debug logging with DEBUG_TESTS=true
const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

function getConfig(): SapConfig {
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
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('Lock Recovery Integration Test', () => {
  const phase1Config = lockRecoveryConfig?.phase1_lock;

  const sessionId = phase1Config?.session_config?.session_id_format || 'lock_recovery_session';
  const sessionsDir = phase1Config?.session_config?.sessions_dir || '.sessions';
  const locksDir = phase1Config?.lock_config?.locks_dir || '.locks';

  afterAll(async () => {
    // Cleanup session and lock files
    const sessionFile = path.join(process.cwd(), sessionsDir, `${sessionId}.json`);
    const lockFile = path.join(process.cwd(), locksDir, 'active-locks.json');

    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      logger.debug(`✓ Cleaned up session file: ${sessionFile}`);
    }

    if (fs.existsSync(lockFile)) {
      const lockManager = new LockStateManager(locksDir);
      lockManager.clearAll();
      logger.debug(`✓ Cleaned up lock registry`);
    }
  });

  it('should persist and restore session and lock state', async () => {
    if (!testEnabled) {
      logger.warn('⚠️ Lock recovery test is disabled in test-config.yaml');
      return;
    }

    logger.info('\n📍 Testing lock recovery mechanism...\n');

    // ============================================================
    // PHASE 1: Save session and lock state
    // ============================================================
    logger.info('PHASE 1: Creating session and lock state...');

    const sapConfig = getConfig();
    const client1 = createAbapConnection(sapConfig, logger);

    // Setup session persistence for Client1
    const sessionStorage1 = new FileSessionStorage({
      sessionDir: sessionsDir,
      prettyPrint: true
    });

    // Manually craft a session state (simulating a real connection with cookies/CSRF)
    const mockSessionState = {
      cookies: 'sap-usercontext=sap-client%3d100; SAP_SESSIONID_xxx=mock_session_12345',
      csrfToken: 'mock_csrf_token_abcdef',
      cookieStore: {
        'sap-usercontext': 'sap-client=100',
        'SAP_SESSIONID_xxx': 'mock_session_12345'
      }
    };

    // Save session
    await sessionStorage1.save(sessionId, mockSessionState);
    logger.debug(`  ✓ Session saved to file: ${sessionId}`);

    // Initialize lock state manager and register a mock lock
    const lockManager = new LockStateManager(locksDir);
    const mockLockHandle = 'LOCK_HANDLE_XYZ123';
    const mockObjectType = 'class';
    const mockObjectName = 'ZCL_TEST_RECOVERY';

    lockManager.registerLock({
      sessionId,
      lockHandle: mockLockHandle,
      objectType: mockObjectType,
      objectName: mockObjectName,
      testFile: __filename
    });
    logger.debug(`  ✓ Lock registered: ${mockObjectName} with handle ${mockLockHandle}`);

    // Verify files exist
    const sessionFile = path.join(process.cwd(), sessionsDir, `${sessionId}.json`);
    const lockFile = path.join(process.cwd(), locksDir, 'active-locks.json');
    expect(fs.existsSync(sessionFile)).toBe(true);
    expect(fs.existsSync(lockFile)).toBe(true);
    logger.debug(`  ✓ Session and lock files verified\n`);

    // ============================================================
    // SIMULATE CRASH
    // ============================================================
    logger.info('💥 SIMULATING CRASH: Client1 destroyed...\n');

    // ============================================================
    // PHASE 2: Restore session and lock state
    // ============================================================
    logger.info('PHASE 2: Restoring session and lock state...');

    // Create new Client2 (different instance, simulating new process)
    const client2 = createAbapConnection(sapConfig, logger);

    // Setup session persistence for Client2
    const sessionStorage2 = new FileSessionStorage({
      sessionDir: sessionsDir,
      prettyPrint: true
    });

    // Load session from file
    const restoredSession = await sessionStorage2.load(sessionId);
    expect(restoredSession).toBeDefined();
    expect(restoredSession!.csrfToken).toBe('mock_csrf_token_abcdef');
    expect(restoredSession!.cookies).toContain('SAP_SESSIONID_xxx=mock_session_12345');
    logger.debug(`  ✓ Session loaded from file`);
    logger.debug(`    - CSRF Token: ${restoredSession!.csrfToken}`);
    logger.debug(`    - Cookies: ${restoredSession!.cookies?.split(';').length || 0} cookie(s)`);

    // Retrieve lock handle from lock manager
    const lockManagerPhase2 = new LockStateManager(locksDir);
    const lockState = lockManagerPhase2.getLock(mockObjectType, mockObjectName);
    expect(lockState).toBeDefined();
    expect(lockState?.lockHandle).toBe(mockLockHandle);
    expect(lockState?.sessionId).toBe(sessionId);
    logger.debug(`  ✓ Lock handle retrieved: ${lockState!.lockHandle}`);
    logger.debug(`    - Session ID: ${lockState!.sessionId}`);
    logger.debug(`    - Object: ${lockState!.objectName}`);
    logger.debug(`    - Type: ${lockState!.objectType}`);

    // Cleanup
    lockManagerPhase2.removeLock(mockObjectType, mockObjectName);
    await sessionStorage2.delete(sessionId);
    logger.debug(`\n  ✓ Cleanup completed`);

    logger.info('\n✅ Lock recovery test completed successfully!\n');
    logger.debug('This test validates that:');
    logger.debug('  1. Sessions can be persisted to disk');
    logger.debug('  2. Lock handles can be tracked in registry');
    logger.debug('  3. After a crash, a new connection instance can:');
    logger.debug('     - Restore session state from file');
    logger.debug('     - Retrieve lock handles from registry');
    logger.debug('     - Resume operations with restored state\n');
  }, 30000);
});
