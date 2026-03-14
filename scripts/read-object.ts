/**
 * Universal script to read any ADT object: source code + metadata
 *
 * Usage:
 *   npx ts-node scripts/read-object.ts --type=class ZCL_MY_CLASS
 *   npx ts-node scripts/read-object.ts --type=program Z_MY_REPORT
 *   npx ts-node scripts/read-object.ts --type=interface ZIF_MY_INTF
 *   npx ts-node scripts/read-object.ts --type=table T000
 *   npx ts-node scripts/read-object.ts --type=structure BAPI_EPM_PRODUCT_HEADER
 *   npx ts-node scripts/read-object.ts --type=domain MANDT
 *   npx ts-node scripts/read-object.ts --type=dataelement MANDT
 *   npx ts-node scripts/read-object.ts --type=tabletype MARA_TAB
 *   npx ts-node scripts/read-object.ts --type=view V_T000
 *   npx ts-node scripts/read-object.ts --type=functiongroup SDIF
 *   npx ts-node scripts/read-object.ts --type=functionmodule DDIF_TABL_PUT --group=SDIF
 *   npx ts-node scripts/read-object.ts --type=package SDIC
 *   npx ts-node scripts/read-object.ts --type=accesscontrol ZAC_SHR_AC01
 *   npx ts-node scripts/read-object.ts --type=servicedefinition ZAC_SHR_SRVD01
 *   npx ts-node scripts/read-object.ts --type=behaviordefinition ZAC_SHR_BD01
 *   npx ts-node scripts/read-object.ts --type=behaviorimplementation ZAC_SHR_BI01
 *   npx ts-node scripts/read-object.ts --type=metadataextension ZAC_SHR_MDE01
 *   npx ts-node scripts/read-object.ts --type=enhancement ZAC_SHR_ENH01 --enhancement-type=enhoxhb
 *
 * Flags:
 *   --read=source      Read source code only (default: both)
 *   --read=metadata    Read metadata only
 *   --read=both        Read both source code and metadata
 *
 * Environment variables:
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root)
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../src/clients/AdtClient';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import {
  createBuilderLogger,
  createConnectionLogger,
} from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const OBJECT_TYPES = [
  'class',
  'program',
  'interface',
  'table',
  'structure',
  'domain',
  'dataelement',
  'tabletype',
  'view',
  'functiongroup',
  'functionmodule',
  'package',
  'accesscontrol',
  'servicedefinition',
  'behaviordefinition',
  'behaviorimplementation',
  'metadataextension',
  'enhancement',
] as const;

type ObjectType = (typeof OBJECT_TYPES)[number];

type ReadMode = 'source' | 'metadata' | 'both';

interface Options {
  objectType: ObjectType;
  objectName: string;
  functionGroupName?: string;
  enhancementType?: string;
  readMode: ReadMode;
}

function parseArgs(argv: string[]): Options {
  let objectName: string | undefined;
  let objectType: string | undefined;
  let functionGroupName: string | undefined;
  let enhancementType: string | undefined;
  let readMode: ReadMode = 'both';

  for (const arg of argv) {
    if (arg.startsWith('--type=')) {
      objectType = arg.slice('--type='.length).trim().toLowerCase();
    } else if (arg.startsWith('--group=')) {
      functionGroupName = arg.slice('--group='.length).trim();
    } else if (arg.startsWith('--enhancement-type=')) {
      enhancementType = arg.slice('--enhancement-type='.length).trim();
    } else if (arg.startsWith('--read=')) {
      const value = arg.slice('--read='.length).trim().toLowerCase();
      if (value === 'source' || value === 'metadata' || value === 'both') {
        readMode = value;
      } else {
        throw new Error(`Invalid --read value: ${value}. Use: source, metadata, both`);
      }
    } else if (!arg.startsWith('--') && !objectName) {
      objectName = arg.trim();
    }
  }

  if (!objectType) {
    console.error(`Available types: ${OBJECT_TYPES.join(', ')}`);
    throw new Error('--type=<object_type> is required');
  }
  if (!OBJECT_TYPES.includes(objectType as ObjectType)) {
    console.error(`Available types: ${OBJECT_TYPES.join(', ')}`);
    throw new Error(`Unknown object type: ${objectType}`);
  }
  if (!objectName) {
    throw new Error('Object name is required (positional argument)');
  }
  if (objectType === 'functionmodule' && !functionGroupName) {
    throw new Error('--group=<function_group_name> is required for functionmodule');
  }
  if (objectType === 'enhancement' && !enhancementType) {
    throw new Error(
      '--enhancement-type=<type> is required for enhancement (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)',
    );
  }

  return {
    objectType: objectType as ObjectType,
    objectName,
    functionGroupName,
    enhancementType,
    readMode,
  };
}

function getHandler(
  client: AdtClient,
  options: Options,
): IAdtObject<any, any> {
  switch (options.objectType) {
    case 'class':
      return client.getClass();
    case 'program':
      return client.getProgram();
    case 'interface':
      return client.getInterface();
    case 'table':
      return client.getTable();
    case 'structure':
      return client.getStructure();
    case 'domain':
      return client.getDomain();
    case 'dataelement':
      return client.getDataElement();
    case 'tabletype':
      return client.getTableType();
    case 'view':
      return client.getView();
    case 'functiongroup':
      return client.getFunctionGroup();
    case 'functionmodule':
      return client.getFunctionModule();
    case 'package':
      return client.getPackage();
    case 'accesscontrol':
      return client.getAccessControl();
    case 'servicedefinition':
      return client.getServiceDefinition();
    case 'behaviordefinition':
      return client.getBehaviorDefinition();
    case 'behaviorimplementation':
      return client.getBehaviorImplementation();
    case 'metadataextension':
      return client.getMetadataExtension();
    case 'enhancement':
      return client.getEnhancement();
    default:
      throw new Error(`Unsupported object type: ${options.objectType}`);
  }
}

function buildReadConfig(options: Options): Record<string, string> {
  const { objectType, objectName, functionGroupName, enhancementType } = options;
  switch (objectType) {
    case 'class':
    case 'behaviorimplementation':
      return { className: objectName };
    case 'program':
      return { programName: objectName };
    case 'interface':
      return { interfaceName: objectName };
    case 'table':
      return { tableName: objectName };
    case 'structure':
      return { structureName: objectName };
    case 'domain':
      return { domainName: objectName };
    case 'dataelement':
      return { dataElementName: objectName };
    case 'tabletype':
      return { tableTypeName: objectName };
    case 'view':
      return { viewName: objectName };
    case 'functiongroup':
      return { functionGroupName: objectName };
    case 'functionmodule':
      return { functionModuleName: objectName, functionGroupName: functionGroupName! };
    case 'package':
      return { packageName: objectName };
    case 'accesscontrol':
      return { accessControlName: objectName };
    case 'servicedefinition':
      return { serviceDefinitionName: objectName };
    case 'behaviordefinition':
      return { name: objectName };
    case 'metadataextension':
      return { name: objectName };
    case 'enhancement':
      return { enhancementName: objectName, enhancementType: enhancementType! };
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

function printResult(label: string, state: any): void {
  // Source code (readResult)
  if (state?.readResult) {
    const result = state.readResult;
    if (typeof result === 'string') {
      console.log(result);
      console.log(`\n[${label} length: ${result.length} characters]`);
    } else if (result?.data) {
      const data = result.data;
      if (typeof data === 'string') {
        console.log(data);
        console.log(`\n[${label} length: ${data.length} characters]`);
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
      if (result.status) {
        console.log(`HTTP Status: ${result.status}`);
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } else if (state?.metadataResult) {
    const meta = state.metadataResult;
    console.log(`HTTP Status: ${meta.status}`);
    const contentType = meta.headers?.['content-type'] || '';
    if (contentType) {
      console.log(`Content-Type: ${contentType}`);
    }
    const data = meta.data;
    if (typeof data === 'string') {
      console.log(data);
    } else if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  } else {
    console.log(`[No ${label} returned]`);
  }
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log(`\n=== Reading ${options.objectType}: ${options.objectName} ===`);
  if (options.functionGroupName) {
    console.log(`    Function Group: ${options.functionGroupName}`);
  }
  if (options.enhancementType) {
    console.log(`    Enhancement Type: ${options.enhancementType}`);
  }
  console.log('');

  const sapConfig = getConfig();
  const connection = createAbapConnection(sapConfig, createConnectionLogger());
  await (connection as any).connect();

  const client = new AdtClient(connection, createBuilderLogger());
  const handler = getHandler(client, options);
  const readConfig = buildReadConfig(options);

  if (options.readMode === 'source' || options.readMode === 'both') {
    console.log('--- SOURCE ---');
    try {
      const state = await handler.read(readConfig);
      if (state) {
        printResult('Source', state);
      } else {
        console.log('[Object not found]');
      }
    } catch (error: any) {
      console.error(
        `[Read failed: HTTP ${error.response?.status || '?'} ${error.message}]`,
      );
    }
  }

  if (options.readMode === 'metadata' || options.readMode === 'both') {
    if (options.readMode === 'both') {
      console.log('');
    }
    console.log('--- METADATA ---');
    try {
      const state = await handler.readMetadata(readConfig);
      if (state) {
        printResult('Metadata', state);
      } else {
        console.log('[No metadata returned]');
      }
    } catch (error: any) {
      console.error(
        `[Metadata read failed: HTTP ${error.response?.status || '?'} ${error.message}]`,
      );
    }
  }

  (connection as any).reset();
}

run().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
