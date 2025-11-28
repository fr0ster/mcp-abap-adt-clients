#!/usr/bin/env node
/**
 * Example script: Read transport request for an ABAP object
 *
 * Usage:
 *   node examples/read-object-transport.js <object-type> <object-name> [function-group]
 *
 * Examples:
 *   node examples/read-object-transport.js class ZCL_MY_CLASS
 *   node examples/read-object-transport.js table Z_MY_TABLE
 *   node examples/read-object-transport.js function_module SYSTEM_INFO SYST
 *
 * Note:
 *   SAP BTP ABAP trial systems do not expose transport requests for local
 *   development packages. A 404 ("No suitable resource found") response is
 *   expected for user-owned trial objects and indicates that the object
 *   simply is not assigned to a transport request.
 */

const fs = require('fs');
const path = require('path');
const { createAbapConnection, SapConfig } = require('@mcp-abap-adt/connection');
const {
  getClassTransport,
  getInterfaceTransport,
  getTableTransport,
  getProgramTransport,
  getStructureTransport,
  getDomainTransport,
  getDataElementTransport,
  getViewTransport,
  getFunctionGroupTransport,
  getFunctionModuleTransport,
  getPackageTransport
} = require('../dist/core');

const { XMLParser } = require('fast-xml-parser');

function resolveEnvPath() {
  if (process.env.MCP_ENV_PATH) {
    const customPath = path.resolve(process.env.MCP_ENV_PATH);
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    console.warn(`[read-object-transport] MCP_ENV_PATH points to ${customPath} but file does not exist`);
  }

  // Look for .env in the directory where the script is run from (process.cwd())
  const cwdEnv = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) {
    return cwdEnv;
  }

  return null;
}

function parseEnvFile(envPath) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      const unquotedValue = value.replace(/^["']|["']$/g, "");
      if (key) {
        env[key] = unquotedValue;
      }
    }
    return env;
  } catch (error) {
    console.warn(`[read-object-transport] Failed to parse .env file ${envPath}: ${error.message}`);
    return {};
  }
}

function getConfig() {
  const envPath = resolveEnvPath();
  let env = {};
  
  if (envPath) {
    env = parseEnvFile(envPath);
  } else {
    console.warn('[read-object-transport] .env not found, using environment variables only');
  }
  
  // Merge with process.env (process.env takes precedence)
  const mergedEnv = { ...env, ...process.env };
  
  const url = mergedEnv.SAP_URL?.trim();
  const client = mergedEnv.SAP_CLIENT?.trim();
  
  // Auto-detect auth type
  let authType = 'basic';
  if (mergedEnv.SAP_JWT_TOKEN) {
    authType = 'jwt';
  } else if (mergedEnv.SAP_AUTH_TYPE) {
    const rawAuthType = mergedEnv.SAP_AUTH_TYPE.trim();
    authType = rawAuthType === 'xsuaa' ? 'jwt' : rawAuthType;
  }
  
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }
  
  const config = {
    url,
    authType,
  };
  
  if (client) {
    config.client = client;
  }
  
  if (authType === 'jwt') {
    const jwtToken = mergedEnv.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;
    const refreshToken = mergedEnv.SAP_REFRESH_TOKEN;
    if (refreshToken) {
      config.refreshToken = refreshToken;
    }
    const uaaUrl = mergedEnv.SAP_UAA_URL || mergedEnv.UAA_URL;
    const uaaClientId = mergedEnv.SAP_UAA_CLIENT_ID || mergedEnv.UAA_CLIENT_ID;
    const uaaClientSecret = mergedEnv.SAP_UAA_CLIENT_SECRET || mergedEnv.UAA_CLIENT_SECRET;
    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
  } else {
    const username = mergedEnv.SAP_USERNAME;
    const password = mergedEnv.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }
  
  return config;
}

async function readTransport(connection, objectType, objectName, functionGroup) {
  switch (objectType.toLowerCase()) {
    case 'class':
      return await getClassTransport(connection, objectName);
    case 'interface':
      return await getInterfaceTransport(connection, objectName);
    case 'table':
      return await getTableTransport(connection, objectName);
    case 'program':
      return await getProgramTransport(connection, objectName);
    case 'structure':
      return await getStructureTransport(connection, objectName);
    case 'domain':
      return await getDomainTransport(connection, objectName);
    case 'dataelement':
    case 'data_element':
      return await getDataElementTransport(connection, objectName);
    case 'view':
      return await getViewTransport(connection, objectName);
    case 'functiongroup':
    case 'function_group':
      return await getFunctionGroupTransport(connection, objectName);
    case 'functionmodule':
    case 'function_module':
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      return await getFunctionModuleTransport(connection, objectName, functionGroup);
    case 'package':
      return await getPackageTransport(connection, objectName);
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

function parseTransportResponse(xmlData) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true
  });

  const result = parser.parse(xmlData);
  const root = result['tm:root'] || result['root'];

  if (!root) {
    return null;
  }

  const request = root['tm:request'] || {};
  return {
    transportNumber: request['tm:number'],
    description: request['tm:desc'] || request['tm:description'],
    type: request['tm:type'],
    targetSystem: request['tm:target'],
    owner: request['tm:owner'],
    status: request['tm:status'],
    uri: request['tm:uri']
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node examples/read-object-transport.js <object-type> <object-name> [function-group]');
    console.error('');
    console.error('Object types: class, interface, table, program, structure, domain, dataelement, view, functiongroup, functionmodule, package');
    console.error('');
    console.error('Examples:');
    console.error('  node examples/read-object-transport.js class ZCL_MY_CLASS');
    console.error('  node examples/read-object-transport.js table Z_MY_TABLE');
    console.error('  node examples/read-object-transport.js function_module SYSTEM_INFO SYST');
    process.exit(1);
  }

  const [objectType, objectName, functionGroup] = args;

  try {
    const config = getConfig();
    console.log(`Using ${config.authType} authentication${config.refreshToken ? ' (with refresh token)' : ''}`);

    const connection = createAbapConnection(config, {
      debug: () => {},
      info: console.log,
      warn: console.warn,
      error: console.error
    });

    await connection.connect();

    console.log(`Reading transport request for ${objectType}:${objectName}...`);
    const response = await readTransport(connection, objectType, objectName, functionGroup);

    if (response.status === 200 && response.data) {
      const transportInfo = parseTransportResponse(response.data);

      if (transportInfo && transportInfo.transportNumber) {
        console.log('\n✅ Transport request found:');
        console.log(`  Transport Number: ${transportInfo.transportNumber}`);
        console.log(`  Description: ${transportInfo.description || 'N/A'}`);
        console.log(`  Type: ${transportInfo.type || 'N/A'}`);
        console.log(`  Target System: ${transportInfo.targetSystem || 'N/A'}`);
        console.log(`  Owner: ${transportInfo.owner || 'N/A'}`);
        console.log(`  Status: ${transportInfo.status || 'N/A'}`);
        if (transportInfo.uri) {
          console.log(`  URI: ${transportInfo.uri}`);
        }
      } else {
        console.log('\n⚠️  Transport request not found or object is not in a transport');
        console.log('Response:', response.data.substring(0, 500));
      }
    } else {
      console.error(`\n❌ Failed to read transport request: HTTP ${response.status}`);
      console.error('Response:', response.data);
    }

    connection.reset();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { readTransport, parseTransportResponse };

