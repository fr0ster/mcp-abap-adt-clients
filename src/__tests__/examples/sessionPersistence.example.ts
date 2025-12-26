/**
 * Example: Using session persistence in integration tests
 *
 * This example shows how session and lock persistence can be configured
 * based on src/__tests__/helpers/test-config.yaml
 *
 * Note: This is a conceptual example. Actual implementation may vary.
 */

import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../clients/AdtClient';
import { getConfig } from '../helpers/sessionConfig';

describe('Example: Session Persistence', () => {
  let connection: any;
  let client: AdtClient;

  beforeAll(async () => {
    // Create connection using helper
    const config = getConfig();
    connection = createAbapConnection(config, console);
    await (connection as any).connect();
    client = new AdtClient(connection);

    // Session persistence is configured in src/__tests__/helpers/test-config.yaml:
    // session_config:
    //   persist_session: true
    //   sessions_dir: ".sessions"
    //   session_id_format: "auto"
    //   cleanup_session_after_test: false
    //
    // lock_config:
    //   locks_dir: ".locks"
    //   persist_locks: true
    //   cleanup_locks_after_test: true
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it('should persist session across requests', async () => {
    // Example: Create a class
    // Session and lock state are automatically managed based on test-config.yaml
    await client.getClass().create({
      className: 'ZCL_EXAMPLE',
      packageName: 'ZPACKAGE',
      description: 'Example class',
    });

    // Get the result from client
    const result = await client.getClass().read({
      className: 'ZCL_EXAMPLE',
    });
    expect(result).toBeDefined();
    expect(result?.readResult).toBeDefined();

    // Session is automatically saved to:
    // .sessions/{testName}_{timestamp}.json
    //
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
  });
});

/**
 * src/__tests__/helpers/test-config.yaml example:
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
