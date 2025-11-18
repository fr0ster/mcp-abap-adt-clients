/**
 * Test to verify auth failure skip behavior
 *
 * This simulates expired JWT with no refresh capability
 */

const { CloudAbapConnection } = require('@mcp-abap-adt/connection');

async function testAuthFailureSkip() {
  const config = {
    url: process.env.SAP_URL,
    authType: 'jwt',
    client: '100',
    // Expired JWT (decode to see it's from 2020)
    jwtToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1ODAwMDAwMDAsInN1YiI6InRlc3QifQ.test',
    // No refresh credentials
  };

  const logger = {
    info: (msg) => console.log('[INFO]', msg),
    warn: (msg) => console.warn('[WARN]', msg),
    error: (msg) => console.error('[ERROR]', msg),
    debug: (msg) => console.log('[DEBUG]', msg),
  };

  try {
    console.log('\n=== Testing Auth Failure Scenario ===\n');

    const connection = new CloudAbapConnection(config, logger);

    console.log('canRefreshToken:', connection.canRefreshToken());
    console.log('\nAttempting to connect with expired JWT...\n');

    await connection.connect();

    console.log('\n❌ FAIL: Should have thrown error but connected successfully!');
    process.exit(1);

  } catch (error) {
    console.log('\n✓ SUCCESS: Auth error caught as expected');
    console.log('Error message:', error.message);

    if (error.message.includes('JWT token has expired') ||
        error.message.includes('Please re-authenticate') ||
        error.message.includes('refresh')) {
      console.log('\n✓ Error message is appropriate for test skip');
      console.log('\nIn real test, this would trigger:');
      console.log('  - markAuthFailed(TEST_SUITE_NAME)');
      console.log('  - All subsequent tests SKIP');
    } else {
      console.log('\n❌ FAIL: Error message not auth-related:', error.message);
      process.exit(1);
    }
  }
}

testAuthFailureSkip();
