/**
 * ADT Backup/Restore Tool
 *
 * Creates editable YAML backups of ABAP objects and restores them via AdtClient.
 *
 * Usage:
 *   npx ts-node tools/adt-backup.ts backup --objects class:ZCL_TEST,interface:ZIF_TEST --output backup.yaml
 *   npx ts-node tools/adt-backup.ts restore --input backup.yaml --mode upsert --activate
 *
 * Environment variables (can be set in .env file via --env option or environment):
 *   SAP_URL - SAP system URL (required)
 *   SAP_AUTH_TYPE - Authentication type: 'basic' or 'jwt' (default: 'basic')
 *   SAP_USERNAME - Username for basic auth (required if authType is 'basic')
 *   SAP_PASSWORD - Password for basic auth (required if authType is 'basic')
 *   SAP_JWT_TOKEN - JWT token for JWT auth (required if authType is 'jwt')
 *   SAP_CLIENT - Client number (optional)
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root, ignored if --env is used)
 */

import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import { XMLParser } from 'fast-xml-parser';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { AdtClient } from '../src/clients/AdtClient';
import { ReadOnlyClient } from '../src/clients/ReadOnlyClient';
import { getServiceDefinitionSource } from '../src/core/serviceDefinition/read';

type SupportedType =
  | 'package'
  | 'domain'
  | 'dataElement'
  | 'structure'
  | 'table'
  | 'view'
  | 'class'
  | 'interface'
  | 'program'
  | 'functionGroup'
  | 'functionModule'
  | 'serviceDefinition';

type RestoreMode = 'create' | 'update' | 'upsert';

interface ObjectSpec {
  type: SupportedType;
  name: string;
  functionGroupName?: string;
}

interface BackupObject {
  id: string;
  type: SupportedType;
  name: string;
  functionGroupName?: string;
  config: Record<string, any>;
  source?: string;
  dependsOn?: string[];
}

interface BackupFile {
  schemaVersion: 1;
  generatedAt: string;
  objects: BackupObject[];
}

function usage(): string {
  return [
    'ADT Backup/Restore',
    '',
    'Commands:',
    '  backup  --objects <type:name[,type:name]> [--output file] [--env file]',
    '  restore --input <file> [--mode create|update|upsert] [--activate] [--env file]',
    '',
    'Examples:',
    '  npx ts-node tools/adt-backup.ts backup --objects class:ZCL_TEST,view:ZV_TEST --output backup.yaml',
    '  npx ts-node tools/adt-backup.ts restore --input backup.yaml --mode upsert --activate',
    '',
    'Object type examples:',
    '  class:ZCL_TEST',
    '  interface:ZIF_TEST',
    '  program:ZREP_TEST',
    '  view:ZV_TEST',
    '  domain:ZDOM_TEST',
    '  dataElement:ZDE_TEST',
    '  structure:ZST_TEST',
    '  table:ZT_TEST',
    '  functionGroup:ZFG_TEST',
    '  functionModule:ZFG_TEST|ZFM_TEST',
    '  serviceDefinition:Z_I_SRV_DEF',
  ].join('\n');
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeType(rawType: string): SupportedType {
  const normalized = rawType.trim().toLowerCase();
  const map: Record<string, SupportedType> = {
    package: 'package',
    domain: 'domain',
    dataelement: 'dataElement',
    'data-element': 'dataElement',
    data_element: 'dataElement',
    structure: 'structure',
    table: 'table',
    view: 'view',
    class: 'class',
    interface: 'interface',
    program: 'program',
    functiongroup: 'functionGroup',
    function_group: 'functionGroup',
    functionmodule: 'functionModule',
    function_module: 'functionModule',
    servicedefinition: 'serviceDefinition',
    service_definition: 'serviceDefinition',
  };

  const resolved = map[normalized];
  if (!resolved) {
    throw new Error(`Unsupported object type: ${rawType}`);
  }
  return resolved;
}

function parseObjectSpec(spec: string): ObjectSpec {
  const parts = spec.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid object spec: ${spec}`);
  }
  const type = normalizeType(parts[0]);
  const namePart = parts.slice(1).join(':').trim();
  if (!namePart) {
    throw new Error(`Missing name in object spec: ${spec}`);
  }

  if (type === 'functionModule') {
    const split = namePart.split(/[|/]/);
    if (split.length !== 2) {
      throw new Error(
        `Function module spec must be GROUP|NAME or GROUP/NAME: ${spec}`,
      );
    }
    return {
      type,
      functionGroupName: split[0].trim(),
      name: split[1].trim(),
    };
  }

  return { type, name: namePart };
}

function objectId(spec: ObjectSpec): string {
  if (spec.type === 'functionModule') {
    return `${spec.type}:${spec.functionGroupName}|${spec.name}`;
  }
  return `${spec.type}:${spec.name}`;
}

function loadEnv(envPath?: string): void {
  const finalPath =
    envPath || process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
  if (fs.existsSync(finalPath)) {
    dotenv.config({ path: finalPath, quiet: true });
  }
}

function getConfig(overrides?: { url?: string }): SapConfig {
  const rawUrl = overrides?.url || process.env.SAP_URL;
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

    const refreshToken = process.env.SAP_REFRESH_TOKEN;
    if (refreshToken) {
      config.refreshToken = refreshToken;
    }

    const uaaUrl = process.env.SAP_UAA_URL || process.env.UAA_URL;
    const uaaClientId =
      process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret =
      process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'Missing SAP_USERNAME or SAP_PASSWORD for basic authentication',
      );
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function findAttribute(node: any, attributeName: string): string | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const attrKey = `@_${attributeName}`;
  if (typeof node[attrKey] === 'string') {
    return node[attrKey];
  }
  for (const value of Object.values(node)) {
    const found = findAttribute(value, attributeName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function findPackageName(node: any): string | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  if (node['adtcore:packageRef']) {
    const ref = node['adtcore:packageRef'];
    if (typeof ref === 'object') {
      return ref['@_adtcore:name'] || ref['@_name'];
    }
  }
  for (const value of Object.values(node)) {
    const found = findPackageName(value);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function extractMetadata(xml: string): {
  description?: string;
  packageName?: string;
} {
  const parsed = xmlParser.parse(xml);
  const description =
    findAttribute(parsed, 'adtcore:description') ||
    findAttribute(parsed, 'description');
  const packageName = findPackageName(parsed);
  return { description, packageName };
}

function applyConfigName(
  type: SupportedType,
  name: string,
  functionGroupName?: string,
  config?: Record<string, any>,
): Record<string, any> {
  const finalConfig = { ...(config || {}) };
  switch (type) {
    case 'package':
      finalConfig.packageName = name;
      break;
    case 'domain':
      finalConfig.domainName = name;
      break;
    case 'dataElement':
      finalConfig.dataElementName = name;
      break;
    case 'structure':
      finalConfig.structureName = name;
      break;
    case 'table':
      finalConfig.tableName = name;
      break;
    case 'view':
      finalConfig.viewName = name;
      break;
    case 'class':
      finalConfig.className = name;
      break;
    case 'interface':
      finalConfig.interfaceName = name;
      break;
    case 'program':
      finalConfig.programName = name;
      break;
    case 'functionGroup':
      finalConfig.functionGroupName = name;
      break;
    case 'functionModule':
      finalConfig.functionModuleName = name;
      finalConfig.functionGroupName = functionGroupName;
      break;
    case 'serviceDefinition':
      finalConfig.serviceDefinitionName = name;
      break;
  }
  return finalConfig;
}

function ensureDescription(config: Record<string, any>, fallback: string): Record<string, any> {
  if (!config.description) {
    return { ...config, description: fallback };
  }
  return config;
}

async function readSourceText(
  utils: ReturnType<AdtClient['getUtils']>,
  connection: ReturnType<typeof createAbapConnection>,
  spec: ObjectSpec,
): Promise<string | undefined> {
  switch (spec.type) {
    case 'class':
    case 'interface':
    case 'program':
    case 'view':
    case 'structure':
    case 'table': {
      const response = await utils.readObjectSource(spec.type, spec.name);
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    case 'functionModule': {
      const response = await utils.readObjectSource(
        'functionmodule',
        spec.name,
        spec.functionGroupName,
      );
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    case 'serviceDefinition': {
      const response = await getServiceDefinitionSource(
        connection,
        spec.name,
        'active',
      );
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    default:
      return undefined;
  }
}

async function readBasicMetadata(
  utils: ReturnType<AdtClient['getUtils']>,
  spec: ObjectSpec,
): Promise<{ description?: string; packageName?: string }> {
  switch (spec.type) {
    case 'class':
    case 'interface':
    case 'program':
    case 'view':
    case 'structure':
    case 'table':
    case 'functionModule': {
      const response = await utils.readObjectMetadata(
        spec.type,
        spec.name,
        spec.functionGroupName,
      );
      const xml =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
      return extractMetadata(xml);
    }
    default:
      return {};
  }
}

async function backupObject(
  client: AdtClient,
  readOnly: ReadOnlyClient,
  connection: ReturnType<typeof createAbapConnection>,
  spec: ObjectSpec,
): Promise<BackupObject> {
  const utils = client.getUtils();
  const id = objectId(spec);

  switch (spec.type) {
    case 'package': {
      const config = await readOnly.readPackage(spec.name);
      if (!config) {
        throw new Error(`Package not found: ${spec.name}`);
      }
      return {
        id,
        type: spec.type,
        name: spec.name,
        config: applyConfigName(spec.type, spec.name, undefined, config),
      };
    }
    case 'domain': {
      const config = await readOnly.readDomain(spec.name);
      if (!config) {
        throw new Error(`Domain not found: ${spec.name}`);
      }
      return {
        id,
        type: spec.type,
        name: spec.name,
        config: applyConfigName(spec.type, spec.name, undefined, config),
      };
    }
    case 'dataElement': {
      const config = await readOnly.readDataElement(spec.name);
      if (!config) {
        throw new Error(`Data element not found: ${spec.name}`);
      }
      return {
        id,
        type: spec.type,
        name: spec.name,
        config: applyConfigName(spec.type, spec.name, undefined, config),
      };
    }
    case 'functionGroup': {
      const config = await readOnly.readFunctionGroup(spec.name);
      if (!config) {
        throw new Error(`Function group not found: ${spec.name}`);
      }
      return {
        id,
        type: spec.type,
        name: spec.name,
        config: applyConfigName(spec.type, spec.name, undefined, config),
      };
    }
    case 'serviceDefinition': {
      const config = await readOnly.readServiceDefinition(spec.name);
      if (!config) {
        throw new Error(`Service definition not found: ${spec.name}`);
      }
      const source = await readSourceText(utils, connection, spec);
      return {
        id,
        type: spec.type,
        name: spec.name,
        config: applyConfigName(spec.type, spec.name, undefined, config),
        source,
      };
    }
    case 'functionModule': {
      const basic = await readBasicMetadata(utils, spec);
      const source = await readSourceText(utils, connection, spec);
      const config = applyConfigName(spec.type, spec.name, spec.functionGroupName, {
        functionGroupName: spec.functionGroupName,
        functionModuleName: spec.name,
        packageName: basic.packageName,
        description: basic.description,
      });
      return {
        id,
        type: spec.type,
        name: spec.name,
        functionGroupName: spec.functionGroupName,
        config,
        source,
      };
    }
    default: {
      const basic = await readBasicMetadata(utils, spec);
      const source = await readSourceText(utils, connection, spec);
      const config = applyConfigName(spec.type, spec.name, spec.functionGroupName, {
        packageName: basic.packageName,
        description: basic.description,
      });
      return {
        id,
        type: spec.type,
        name: spec.name,
        config,
        source,
      };
    }
  }
}

const typeOrder: SupportedType[] = [
  'package',
  'domain',
  'dataElement',
  'structure',
  'table',
  'view',
  'functionGroup',
  'functionModule',
  'interface',
  'class',
  'program',
  'serviceDefinition',
];

function sortByDependencies(objects: BackupObject[]): BackupObject[] {
  const idToObject = new Map(objects.map((obj) => [obj.id, obj]));
  const dependencies = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  for (const obj of objects) {
    const deps = new Set(
      (obj.dependsOn || []).filter((dep) => idToObject.has(dep)),
    );
    dependencies.set(obj.id, deps);
    indegree.set(obj.id, deps.size);
  }

  const priority = new Map(
    typeOrder.map((type, index) => [type, index]),
  );

  const queue = objects
    .filter((obj) => (indegree.get(obj.id) || 0) === 0)
    .sort((a, b) => {
      const aOrder = priority.get(a.type) ?? 999;
      const bOrder = priority.get(b.type) ?? 999;
      return aOrder - bOrder || a.id.localeCompare(b.id);
    })
    .map((obj) => obj.id);

  const result: BackupObject[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      continue;
    }
    const obj = idToObject.get(id);
    if (!obj || visited.has(id)) {
      continue;
    }
    visited.add(id);
    result.push(obj);

    for (const [otherId, deps] of dependencies.entries()) {
      if (!deps.has(id)) {
        continue;
      }
      deps.delete(id);
      const nextIndegree = (indegree.get(otherId) || 0) - 1;
      indegree.set(otherId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(otherId);
        queue.sort((aId, bId) => {
          const aObj = idToObject.get(aId);
          const bObj = idToObject.get(bId);
          const aOrder = aObj ? priority.get(aObj.type) ?? 999 : 999;
          const bOrder = bObj ? priority.get(bObj.type) ?? 999 : 999;
          return aOrder - bOrder || aId.localeCompare(bId);
        });
      }
    }
  }

  if (result.length !== objects.length) {
    const remaining = objects.filter((obj) => !visited.has(obj.id));
    remaining.sort((a, b) => {
      const aOrder = priority.get(a.type) ?? 999;
      const bOrder = priority.get(b.type) ?? 999;
      return aOrder - bOrder || a.id.localeCompare(b.id);
    });
    result.push(...remaining);
  }

  return result;
}

async function restoreObject(
  client: AdtClient,
  obj: BackupObject,
  mode: RestoreMode,
  activate: boolean,
): Promise<void> {
  const baseConfig = applyConfigName(
    obj.type,
    obj.name,
    obj.functionGroupName,
    obj.config,
  );
  const config = ensureDescription(baseConfig, obj.name);

  const options = {
    activateOnCreate: activate,
    activateOnUpdate: activate,
  };

  switch (obj.type) {
    case 'package': {
      if (mode !== 'update') {
        await client.getPackage().create(config, options);
      }
      if (mode !== 'create') {
        await client.getPackage().update(config, options);
      }
      return;
    }
    case 'domain': {
      if (mode !== 'update') {
        await client.getDomain().create(config, options);
      }
      if (mode !== 'create') {
        await client.getDomain().update(config, options);
      }
      return;
    }
    case 'dataElement': {
      if (mode !== 'update') {
        await client.getDataElement().create(config, options);
      }
      if (mode !== 'create') {
        await client.getDataElement().update(config, options);
      }
      return;
    }
    case 'structure': {
      if (mode !== 'update') {
        await client.getStructure().create(config, options);
      }
      if (obj.source) {
        await client
          .getStructure()
          .update({ ...config, ddlCode: obj.source }, options);
      }
      return;
    }
    case 'table': {
      if (mode !== 'update') {
        await client.getTable().create(config, options);
      }
      if (obj.source) {
        await client
          .getTable()
          .update({ ...config, ddlCode: obj.source }, options);
      }
      return;
    }
    case 'view': {
      if (mode !== 'update') {
        await client.getView().create(config, options);
      }
      if (obj.source) {
        await client
          .getView()
          .update({ ...config, ddlSource: obj.source }, options);
      }
      return;
    }
    case 'class': {
      if (mode !== 'update') {
        await client.getClass().create(config, options);
      }
      if (obj.source) {
        await client
          .getClass()
          .update({ ...config, sourceCode: obj.source }, options);
      }
      return;
    }
    case 'interface': {
      if (mode !== 'update') {
        await client.getInterface().create(config, options);
      }
      if (obj.source) {
        await client
          .getInterface()
          .update({ ...config, sourceCode: obj.source }, options);
      }
      return;
    }
    case 'program': {
      if (mode !== 'update') {
        await client.getProgram().create(config, options);
      }
      if (obj.source) {
        await client
          .getProgram()
          .update({ ...config, sourceCode: obj.source }, options);
      }
      return;
    }
    case 'functionGroup': {
      if (mode !== 'update') {
        await client.getFunctionGroup().create(config, options);
      }
      if (mode !== 'create') {
        await client.getFunctionGroup().update(config, options);
      }
      return;
    }
    case 'functionModule': {
      if (mode !== 'update') {
        await client.getFunctionModule().create(config, options);
      }
      if (obj.source) {
        await client
          .getFunctionModule()
          .update({ ...config, sourceCode: obj.source }, options);
      }
      return;
    }
    case 'serviceDefinition': {
      if (mode !== 'update') {
        await client.getServiceDefinition().create(config, options);
      }
      if (obj.source) {
        await client
          .getServiceDefinition()
          .update({ ...config, sourceCode: obj.source }, options);
      }
      return;
    }
  }
}

async function restoreObjects(
  client: AdtClient,
  objects: BackupObject[],
  mode: RestoreMode,
  activate: boolean,
): Promise<void> {
  const ordered = sortByDependencies(objects);
  for (const obj of ordered) {
    if (mode === 'upsert') {
      try {
        await restoreObject(client, obj, 'create', activate);
      } catch (error) {
        await restoreObject(client, obj, 'update', activate);
      }
    } else {
      await restoreObject(client, obj, mode, activate);
    }
  }
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  if (!command || command === '--help' || command === '-h') {
    console.log(usage());
    process.exit(0);
  }

  const envPath =
    typeof args.env === 'string'
      ? args.env
      : typeof args.config === 'string'
        ? args.config
        : undefined;
  loadEnv(envPath);

  const urlOverride = typeof args.url === 'string' ? args.url : undefined;
  const config = getConfig({ url: urlOverride });
  const connection = createAbapConnection(config);
  const client = new AdtClient(connection, console);
  const readOnly = new ReadOnlyClient(connection, console);

  if (command === 'backup') {
    const rawObjects = args.objects;
    if (typeof rawObjects !== 'string') {
      throw new Error('Missing --objects');
    }
    const specs = rawObjects
      .split(',')
      .map((spec) => spec.trim())
      .filter(Boolean)
      .map(parseObjectSpec);

    const objects: BackupObject[] = [];
    for (const spec of specs) {
      const backup = await backupObject(client, readOnly, connection, spec);
      objects.push(backup);
    }

    const output =
      typeof args.output === 'string' ? args.output : 'backup.yaml';
    const payload: BackupFile = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      objects,
    };
    const yamlText = YAML.stringify(payload, { lineWidth: 0 });
    fs.writeFileSync(output, yamlText, 'utf8');
    console.log(`Backup written to ${output}`);
    return;
  }

  if (command === 'restore') {
    const input = args.input;
    if (typeof input !== 'string') {
      throw new Error('Missing --input');
    }
    const raw = fs.readFileSync(input, 'utf8');
    const parsed = YAML.parse(raw) as BackupFile;
    if (!parsed || !Array.isArray(parsed.objects)) {
      throw new Error('Invalid backup file format');
    }
    const mode = (args.mode as RestoreMode) || 'upsert';
    const activate = Boolean(args.activate);
    await restoreObjects(client, parsed.objects, mode, activate);
    console.log(`Restore completed for ${parsed.objects.length} object(s)`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
