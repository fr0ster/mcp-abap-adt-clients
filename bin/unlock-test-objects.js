#!/usr/bin/env node
/**
 * Utility script to unlock test objects that may be locked from failed tests
 *
 * Usage:
 *   adt-unlock-objects
 *
 * Or with npx:
 *   npx @mcp-abap-adt/adt-clients adt-unlock-objects
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment
const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { createAbapConnection } = require('@mcp-abap-adt/connection');
const { unlockClass } = require('../dist/core/class/unlock');
const { unlockFunctionModule } = require('../dist/core/functionModule/unlock');

function getConfig() {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : authType,
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

async function unlockTestObjects() {
  try {
    const config = getConfig();
    const connection = createAbapConnection(config, console);

    // List of objects that might be locked from tests
    const objectsToUnlock = [
      // Classes
      { type: 'class', name: 'ZCL_TEST_CLASS_01' },
      { type: 'class', name: 'ZCL_TEST_CLASS_INHERIT_01' },

      // Function Modules (need function group name)
      { type: 'fm', groupName: 'ZOK_TEST_FG_01', moduleName: 'ZOK_TEST_FM_01' },
      { type: 'fm', groupName: 'Z_TEST_FUGR_01', moduleName: 'Z_TEST_FM_01' },
    ];

    console.log('🔓 Attempting to unlock test objects...\n');

    for (const obj of objectsToUnlock) {
      try {
        if (obj.type === 'class') {
          // Try to unlock with a dummy lock handle
          // This will fail, but SAP might release the lock anyway
          console.log(`Attempting to unlock class: ${obj.name}`);
          await unlockClass(connection, obj.name, 'dummy-handle', '');
          console.log(`✅ Unlocked: ${obj.name}`);
        } else if (obj.type === 'fm') {
          console.log(`Attempting to unlock FM: ${obj.groupName}/${obj.moduleName}`);
          await unlockFunctionModule(connection, obj.groupName, obj.moduleName, 'dummy-handle', '');
          console.log(`✅ Unlocked: ${obj.groupName}/${obj.moduleName}`);
        }
      } catch (error) {
        // Object might not be locked or doesn't exist - that's OK
        console.log(`ℹ️  ${obj.type === 'class' ? obj.name : `${obj.groupName}/${obj.moduleName}`}: ${error.message}`);
      }
    }

    console.log('\n✅ Unlock attempt completed!');
    console.log('Note: Objects that were not locked will show error messages - this is normal.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

unlockTestObjects();
