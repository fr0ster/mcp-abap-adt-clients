/**
 * Example: Using session persistence in integration tests
 *
 * This example shows how to use setupTestEnvironment to automatically
 * configure session and lock persistence based on test-config.yaml
 */

import { createAbapConnection } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment } from '../helpers/sessionConfig';
import { createClass } from '../../core/class/create';

describe('Example: Session Persistence', () => {
  let connection: any;
  let sessionId: string | null;
  let testConfig: any;

  beforeAll(async () => {
    // Create connection
    const config = {
      url: process.env.SAP_URL!,
      client: process.env.SAP_CLIENT,
      username: process.env.SAP_USERNAME,
      password: process.env.SAP_PASSWORD,
      authType: 'basic' as const
    };

    connection = createAbapConnection(config, console);

    // Setup test environment (reads from test-config.yaml)
    // This will:
    // 1. Enable session persistence if persist_session: true
    // 2. Setup lock tracking if persist_locks: true
    // 3. Generate sessionId: testName_timestamp
    const env = await setupTestEnvironment(
      connection,
      'example_test',
      __filename
    );

    sessionId = env.sessionId;
    testConfig = env.testConfig;

    console.log(`Session ID: ${sessionId}`);
    console.log(`Session persistence: ${testConfig.session_config?.persist_session}`);
    console.log(`Lock tracking: ${env.lockTracking.enabled}`);
  });

  afterAll(async () => {
    // Cleanup (removes session file if cleanup_session_after_test: true)
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  it('should persist session across requests', async () => {
    // First request - new session created
    const result = await createClass(connection, {
      class_name: 'ZCL_EXAMPLE',
      package_name: 'ZPACKAGE',
      description: 'Example class',
    });

    // Session is automatically saved to:
    // .sessions/example_test_1699999999.json

    // Contains:
    // {
    //   "sessionId": "example_test_1699999999",
    //   "timestamp": 1699999999,
    //   "pid": 12345,
    //   "state": {
    //     "cookies": "SAP_SESSIONID_...",
    //     "csrfToken": "abc123...",
    //     "cookieStore": {...}
    //   }
    // }

    expect(result.status).toBe(200);
  });
});

/**
 * test-config.yaml example:
 *
 * session_config:
 *   persist_session: true           # Enable session persistence
 *   sessions_dir: ".sessions"       # Directory for session files
 *   session_id_format: "auto"       # Format: {testName}_{timestamp}
 *   cleanup_session_after_test: false  # Keep session after test
 *
 * lock_config:
 *   locks_dir: ".locks"             # Directory for lock registry
 *   persist_locks: true             # Enable lock tracking
 *   cleanup_locks_after_test: true  # Auto-cleanup locks
 */
