#!/usr/bin/env node
/**
 * ADT Backup/Restore CLI
 *
 * Creates editable YAML backups of ABAP objects and restores them via AdtClient.
 */

import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { AdtClient } from '../clients/AdtClient';
import { ReadOnlyClient } from '../clients/ReadOnlyClient';
import {
  read as readBehaviorDefinition,
  readSource as readBehaviorDefinitionSource,
} from '../core/behaviorDefinition/read';
import {
  readMetadataExtension,
  readMetadataExtensionSource,
} from '../core/metadataExtension/read';
import { getPackageContents } from '../core/package/read';
import {
  getServiceDefinition,
  getServiceDefinitionSource,
} from '../core/serviceDefinition/read';
import { getTableTypeSource } from '../core/tabletype/read';

type SupportedType =
  | 'package'
  | 'domain'
  | 'dataElement'
  | 'structure'
  | 'table'
  | 'tableType'
  | 'view'
  | 'class'
  | 'interface'
  | 'program'
  | 'functionGroup'
  | 'functionModule'
  | 'serviceDefinition'
  | 'metadataExtension'
  | 'behaviorDefinition'
  | 'behaviorImplementation'
  | 'enhancement'
  | 'unitTest'
  | 'cdsUnitTest';

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

interface BackupTreeNode {
  name: string;
  adtType?: string;
  type?: SupportedType;
  description?: string;
  codeBase64?: string;
  codeFormat?: 'source' | 'xml' | 'json';
  restoreStatus: 'ok' | 'not-implemented';
  config?: Record<string, any>;
  functionGroupName?: string;
  children?: BackupTreeNode[];
}

interface BackupTreeFile {
  schemaVersion: 2;
  generatedAt: string;
  package: string;
  root: BackupTreeNode;
}

function usage(): string {
  return [
    'ADT Backup/Restore',
    '',
    'Commands:',
    '  backup  --objects <type:name[,type:name]> [--output file] [--env file]',
    '  backup  --package <name> [--output file] [--recursive] [--env file]',
    '  tree    --package <name> [--output file] [--env file]',
    '  restore --input <file> [--mode create|update|upsert] [--activate] [--env file]',
    '  extract --input <file> --object <type:name> --out <file>',
    '  patch   --input <file> --object <type:name> --file <file> [--output file]',
    '',
    'Examples:',
    '  adt-backup backup --objects class:ZCL_TEST,view:ZV_TEST --output backup.yaml',
    '  adt-backup backup --package ZPKG_TEST --output backup.yaml',
    '  adt-backup tree --package ZPKG_TEST --output tree.yaml',
    '  adt-backup restore --input backup.yaml --mode upsert --activate',
    '  adt-backup extract --input backup.yaml --object class:ZCL_TEST --out ZCL_TEST.abap',
    '  adt-backup patch --input backup.yaml --object class:ZCL_TEST --file ZCL_TEST.abap',
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
    '  tableType:ZTT_TEST',
    '  functionGroup:ZFG_TEST',
    '  functionModule:ZFG_TEST|ZFM_TEST',
    '  serviceDefinition:Z_I_SRV_DEF',
    '  metadataExtension:Z_I_SRV_EXT',
    '  behaviorDefinition:Z_I_BDEF',
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
    tabletype: 'tableType',
    table_type: 'tableType',
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
    metadataextension: 'metadataExtension',
    metadata_extension: 'metadataExtension',
    behaviordefinition: 'behaviorDefinition',
    behavior_definition: 'behaviorDefinition',
    behaviorimplementation: 'behaviorImplementation',
    behavior_implementation: 'behaviorImplementation',
    enhancement: 'enhancement',
    unittest: 'unitTest',
    cdsunittest: 'cdsUnitTest',
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
    envPath || process.env.MCP_ENV_PATH || path.resolve(process.cwd(), '.env');
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

function getAttribute(
  node: Record<string, any>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

function getNodeName(node: Record<string, any>): string | undefined {
  return getAttribute(node, [
    '@_adtcore:name',
    '@_name',
    'adtcore:name',
    'name',
  ]);
}

function getNodeType(node: Record<string, any>): string | undefined {
  return getAttribute(node, [
    '@_adtcore:type',
    '@_type',
    'adtcore:type',
    'type',
  ]);
}

function getNodeDescription(node: Record<string, any>): string | undefined {
  return getAttribute(node, [
    '@_adtcore:description',
    '@_description',
    '@_shortDescription',
    'adtcore:description',
    'description',
    'shortDescription',
  ]);
}

function isNodeObject(node: any): node is Record<string, any> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }
  return Boolean(getNodeName(node) && getNodeType(node));
}

function collectNodeObjects(value: any): Record<string, any>[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNodeObjects(item));
  }
  if (typeof value !== 'object') {
    return [];
  }
  if (isNodeObject(value)) {
    return [value];
  }
  return Object.values(value).flatMap((item) => collectNodeObjects(item));
}

function collectChildNodes(node: Record<string, any>): Record<string, any>[] {
  const children: Record<string, any>[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_')) {
      continue;
    }
    if (/node|child/i.test(key)) {
      children.push(...collectNodeObjects(value));
      continue;
    }
    if (typeof value === 'object') {
      children.push(...collectNodeObjects(value));
    }
  }
  return children;
}

function findNodeByName(
  value: any,
  name: string,
): Record<string, any> | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNodeByName(item, name);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  if (isNodeObject(value) && getNodeName(value)?.toUpperCase() === name) {
    return value;
  }
  for (const item of Object.values(value)) {
    const found = findNodeByName(item, name);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function parseNodeTree(
  node: Record<string, any>,
  visited: Set<Record<string, any>> = new Set(),
): BackupTreeNode {
  if (visited.has(node)) {
    return {
      name: getNodeName(node) || '',
      adtType: getNodeType(node),
      description: getNodeDescription(node),
      restoreStatus: 'not-implemented',
      children: [],
    };
  }
  visited.add(node);

  const children = collectChildNodes(node)
    .filter((child) => isNodeObject(child))
    .map((child) => parseNodeTree(child, visited));

  return {
    name: getNodeName(node) || '',
    adtType: getNodeType(node),
    description: getNodeDescription(node),
    restoreStatus: 'not-implemented',
    children,
  };
}

function mapAdtTypeToSupported(adtType?: string): SupportedType | undefined {
  if (!adtType) {
    return undefined;
  }
  const type = adtType.toUpperCase();
  const map: Record<string, SupportedType> = {
    'DEVC/K': 'package',
    'DOMA/DD': 'domain',
    'DTEL/DE': 'dataElement',
    'TABL/DS': 'structure',
    'STRU/DT': 'structure',
    'TABL/DT': 'table',
    'TTYP/DF': 'tableType',
    'TTYP/TT': 'tableType',
    'DDLS/DF': 'view',
    'DDLX/EX': 'metadataExtension',
    'CLAS/OC': 'class',
    'INTF/IF': 'interface',
    'INTF/OI': 'interface',
    'PROG/P': 'program',
    'FUGR/FF': 'functionModule',
    'FUGR/F': 'functionGroup',
    FUGR: 'functionGroup',
    'SRVD/SRV': 'serviceDefinition',
    'BDEF/BDO': 'behaviorDefinition',
  };
  if (map[type]) {
    return map[type];
  }
  if (type.startsWith('CLAS/')) return 'class';
  if (type.startsWith('INTF/')) return 'interface';
  if (type.startsWith('PROG/')) return 'program';
  if (type.startsWith('DDLS/')) return 'view';
  if (type.startsWith('DDLX/')) return 'metadataExtension';
  if (type.startsWith('SRVD/')) return 'serviceDefinition';
  if (type.startsWith('DOMA/')) return 'domain';
  if (type.startsWith('DTEL/')) return 'dataElement';
  if (type.startsWith('TABL/DS') || type.startsWith('STRU/'))
    return 'structure';
  if (type.startsWith('TABL/DT')) return 'table';
  if (type.startsWith('TTYP/')) return 'tableType';
  if (type.startsWith('FUGR/FF')) return 'functionModule';
  if (type.startsWith('FUGR/')) return 'functionGroup';
  if (type.startsWith('DEVC/')) return 'package';
  if (type.startsWith('BDEF/')) return 'behaviorDefinition';
  return undefined;
}

function isRestoreImplemented(type?: SupportedType): boolean {
  if (!type) {
    return false;
  }
  const supported = new Set<SupportedType>([
    'package',
    'domain',
    'dataElement',
    'structure',
    'table',
    'view',
    'class',
    'interface',
    'program',
    'functionGroup',
    'functionModule',
    'serviceDefinition',
    'metadataExtension',
  ]);
  return supported.has(type);
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
    case 'tableType':
      finalConfig.tableTypeName = name;
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
    case 'metadataExtension':
      finalConfig.name = name;
      break;
    case 'behaviorDefinition':
      finalConfig.name = name;
      break;
    case 'behaviorImplementation':
      finalConfig.className = name;
      break;
    case 'enhancement':
      finalConfig.enhancementName = name;
      break;
    case 'unitTest':
      finalConfig.className = name;
      break;
    case 'cdsUnitTest':
      finalConfig.cdsName = name;
      break;
  }
  return finalConfig;
}

function ensureDescription(
  config: Record<string, any>,
  fallback: string,
): Record<string, any> {
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
    case 'tableType': {
      const response = await getTableTypeSource(connection, spec.name);
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
    case 'metadataExtension': {
      const response = await readMetadataExtensionSource(
        connection,
        spec.name,
        'active',
      );
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    case 'behaviorDefinition': {
      const response = await readBehaviorDefinitionSource(
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
    case 'tableType':
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
      const config = applyConfigName(
        spec.type,
        spec.name,
        spec.functionGroupName,
        {
          functionGroupName: spec.functionGroupName,
          functionModuleName: spec.name,
          packageName: basic.packageName,
          description: basic.description,
        },
      );
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
      const config = applyConfigName(
        spec.type,
        spec.name,
        spec.functionGroupName,
        {
          packageName: basic.packageName,
          description: basic.description,
        },
      );
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
  'tableType',
  'view',
  'functionGroup',
  'functionModule',
  'interface',
  'class',
  'program',
  'serviceDefinition',
  'metadataExtension',
  'behaviorDefinition',
];

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

async function readMetadataXmlForType(
  connection: ReturnType<typeof createAbapConnection>,
  utils: ReturnType<AdtClient['getUtils']>,
  type: SupportedType,
  name: string,
  functionGroupName?: string,
): Promise<string | undefined> {
  switch (type) {
    case 'class':
    case 'interface':
    case 'program':
    case 'view':
    case 'structure':
    case 'table':
    case 'tableType':
    case 'domain':
    case 'dataElement':
    case 'functionGroup':
    case 'functionModule':
    case 'package': {
      const response = await utils.readObjectMetadata(
        type,
        name,
        functionGroupName,
      );
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    case 'serviceDefinition': {
      const response = await getServiceDefinition(connection, name, 'active');
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    case 'metadataExtension': {
      const response = await readMetadataExtension(connection, name);
      return typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    }
    case 'behaviorDefinition': {
      const response = await readBehaviorDefinition(
        connection,
        name,
        '',
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

async function buildConfigForNode(
  readOnly: ReadOnlyClient,
  type: SupportedType,
  name: string,
  functionGroupName: string | undefined,
  metadataXml?: string,
): Promise<Record<string, any> | undefined> {
  switch (type) {
    case 'package': {
      const config = await readOnly.readPackage(name);
      return config
        ? applyConfigName(type, name, functionGroupName, config)
        : undefined;
    }
    case 'domain': {
      const config = await readOnly.readDomain(name);
      return config
        ? applyConfigName(type, name, functionGroupName, config)
        : undefined;
    }
    case 'dataElement': {
      const config = await readOnly.readDataElement(name);
      return config
        ? applyConfigName(type, name, functionGroupName, config)
        : undefined;
    }
    case 'functionGroup': {
      const config = await readOnly.readFunctionGroup(name);
      return config
        ? applyConfigName(type, name, functionGroupName, config)
        : undefined;
    }
    case 'functionModule': {
      if (!functionGroupName) {
        return applyConfigName(type, name, functionGroupName, {});
      }
      const config = applyConfigName(type, name, functionGroupName, {
        functionGroupName,
        functionModuleName: name,
      });
      if (!metadataXml) {
        return config;
      }
      const { description, packageName } = extractMetadata(metadataXml);
      return applyConfigName(type, name, functionGroupName, {
        ...config,
        description,
        packageName,
      });
    }
    case 'serviceDefinition': {
      const config = await readOnly.readServiceDefinition(name);
      return config
        ? applyConfigName(type, name, functionGroupName, config)
        : undefined;
    }
    default: {
      if (!metadataXml) {
        return applyConfigName(type, name, functionGroupName, {});
      }
      const { description, packageName } = extractMetadata(metadataXml);
      return applyConfigName(type, name, functionGroupName, {
        description,
        packageName,
      });
    }
  }
}

async function readPayloadForType(
  connection: ReturnType<typeof createAbapConnection>,
  utils: ReturnType<AdtClient['getUtils']>,
  type: SupportedType,
  name: string,
  functionGroupName?: string,
): Promise<{ payload?: string; format?: BackupTreeNode['codeFormat'] }> {
  switch (type) {
    case 'class':
    case 'interface':
    case 'program':
    case 'view':
    case 'structure':
    case 'table':
    case 'functionModule':
    case 'serviceDefinition':
    case 'metadataExtension':
    case 'behaviorDefinition':
    case 'tableType': {
      const payload = await readSourceText(utils, connection, {
        type,
        name,
        functionGroupName,
      });
      return { payload, format: 'source' };
    }
    case 'domain':
    case 'dataElement':
    case 'package':
    case 'functionGroup': {
      const xml = await readMetadataXmlForType(
        connection,
        utils,
        type,
        name,
        functionGroupName,
      );
      return { payload: xml, format: 'xml' };
    }
    default:
      return {};
  }
}

async function enrichTreeNode(
  node: BackupTreeNode,
  client: AdtClient,
  readOnly: ReadOnlyClient,
  connection: ReturnType<typeof createAbapConnection>,
  includeCode: boolean,
  parentFunctionGroupName?: string,
): Promise<BackupTreeNode> {
  const utils = client.getUtils();
  const mappedType = mapAdtTypeToSupported(node.adtType);
  const functionGroupName =
    mappedType === 'functionGroup'
      ? node.name
      : mappedType === 'functionModule'
        ? parentFunctionGroupName
        : parentFunctionGroupName;
  const nextNode: BackupTreeNode = {
    ...node,
    type: mappedType,
    functionGroupName,
    restoreStatus: isRestoreImplemented(mappedType) ? 'ok' : 'not-implemented',
  };

  const metadataXml =
    mappedType && includeCode
      ? await readMetadataXmlForType(connection, utils, mappedType, node.name)
      : undefined;

  if (!nextNode.description && metadataXml) {
    nextNode.description = extractMetadata(metadataXml).description;
  }

  if (mappedType && includeCode) {
    const config = await buildConfigForNode(
      readOnly,
      mappedType,
      node.name,
      functionGroupName,
      metadataXml,
    );
    if (config) {
      nextNode.config = ensureDescription(config, node.name);
    }
  }

  if (mappedType && includeCode && isRestoreImplemented(mappedType)) {
    const payload = await readPayloadForType(
      connection,
      utils,
      mappedType,
      node.name,
      functionGroupName,
    );
    if (payload.payload) {
      nextNode.codeBase64 = encodeBase64(payload.payload);
      nextNode.codeFormat = payload.format;
    } else {
      nextNode.restoreStatus = 'not-implemented';
    }
  }

  if (node.children && node.children.length > 0) {
    const children: BackupTreeNode[] = [];
    for (const child of node.children) {
      children.push(
        await enrichTreeNode(
          child,
          client,
          readOnly,
          connection,
          includeCode,
          functionGroupName,
        ),
      );
    }
    nextNode.children = children;
  }

  return nextNode;
}

async function buildPackageBackupTree(
  client: AdtClient,
  readOnly: ReadOnlyClient,
  connection: ReturnType<typeof createAbapConnection>,
  packageName: string,
  includeCode: boolean,
): Promise<BackupTreeFile> {
  const packageNameUpper = packageName.toUpperCase();
  const response = await getPackageContents(connection, packageNameUpper);
  const xml =
    typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
  const parsed = xmlParser.parse(xml);
  const rootNodeObject =
    findNodeByName(parsed, packageNameUpper) || collectNodeObjects(parsed)[0];

  if (!rootNodeObject) {
    throw new Error(`Failed to parse package tree for ${packageNameUpper}`);
  }

  const rootTree = parseNodeTree(rootNodeObject);
  const enrichedRoot = await enrichTreeNode(
    rootTree,
    client,
    readOnly,
    connection,
    includeCode,
  );

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    package: packageNameUpper,
    root: enrichedRoot,
  };
}

function stripCodeFromTree(node: BackupTreeNode): BackupTreeNode {
  const cleaned: BackupTreeNode = {
    name: node.name,
    adtType: node.adtType,
    type: node.type,
    description: node.description,
    restoreStatus: node.restoreStatus,
    functionGroupName: node.functionGroupName,
  };
  if (node.children && node.children.length > 0) {
    cleaned.children = node.children.map(stripCodeFromTree);
  }
  return cleaned;
}

function findNodeInTree(
  node: BackupTreeNode,
  spec: ObjectSpec,
): BackupTreeNode | undefined {
  if (
    node.type === spec.type &&
    node.name.toUpperCase() === spec.name.toUpperCase()
  ) {
    if (spec.type !== 'functionModule') {
      return node;
    }
    const group =
      node.config?.functionGroupName ||
      node.functionGroupName ||
      spec.functionGroupName;
    if (
      group &&
      spec.functionGroupName &&
      group.toUpperCase() === spec.functionGroupName.toUpperCase()
    ) {
      return node;
    }
  }
  if (!node.children) {
    return undefined;
  }
  for (const child of node.children) {
    const found = findNodeInTree(child, spec);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function flattenTree(
  node: BackupTreeNode,
  result: BackupTreeNode[] = [],
): BackupTreeNode[] {
  result.push(node);
  if (node.children) {
    for (const child of node.children) {
      flattenTree(child, result);
    }
  }
  return result;
}

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

  const priority = new Map(typeOrder.map((type, index) => [type, index]));

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
          const aOrder = aObj ? (priority.get(aObj.type) ?? 999) : 999;
          const bOrder = bObj ? (priority.get(bObj.type) ?? 999) : 999;
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
  const config = ensureDescription(baseConfig, obj.name) as any;

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

async function restoreTreeNode(
  client: AdtClient,
  node: BackupTreeNode,
  mode: RestoreMode,
  activate: boolean,
): Promise<void> {
  if (!node.type || node.restoreStatus !== 'ok') {
    return;
  }
  const config = ensureDescription(node.config || {}, node.name) as any;
  const payload = node.codeBase64 ? decodeBase64(node.codeBase64) : undefined;
  const options = {
    activateOnCreate: activate,
    activateOnUpdate: activate,
  };

  switch (node.type) {
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
      if (payload) {
        await client
          .getStructure()
          .update({ ...config, ddlCode: payload }, options);
      }
      return;
    }
    case 'table': {
      if (mode !== 'update') {
        await client.getTable().create(config, options);
      }
      if (payload) {
        await client
          .getTable()
          .update({ ...config, ddlCode: payload }, options);
      }
      return;
    }
    case 'view': {
      if (mode !== 'update') {
        await client.getView().create(config, options);
      }
      if (payload) {
        await client
          .getView()
          .update({ ...config, ddlSource: payload }, options);
      }
      return;
    }
    case 'class': {
      if (mode !== 'update') {
        await client.getClass().create(config, options);
      }
      if (payload) {
        await client
          .getClass()
          .update({ ...config, sourceCode: payload }, options);
      }
      return;
    }
    case 'interface': {
      if (mode !== 'update') {
        await client.getInterface().create(config, options);
      }
      if (payload) {
        await client
          .getInterface()
          .update({ ...config, sourceCode: payload }, options);
      }
      return;
    }
    case 'program': {
      if (mode !== 'update') {
        await client.getProgram().create(config, options);
      }
      if (payload) {
        await client
          .getProgram()
          .update({ ...config, sourceCode: payload }, options);
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
      if (payload) {
        await client
          .getFunctionModule()
          .update({ ...config, sourceCode: payload }, options);
      }
      return;
    }
    case 'serviceDefinition': {
      if (mode !== 'update') {
        await client.getServiceDefinition().create(config, options);
      }
      if (payload) {
        await client
          .getServiceDefinition()
          .update({ ...config, sourceCode: payload }, options);
      }
      return;
    }
    case 'metadataExtension': {
      if (mode !== 'update') {
        await client.getMetadataExtension().create(config, options);
      }
      if (payload) {
        await client
          .getMetadataExtension()
          .update({ ...config, sourceCode: payload }, options);
      }
      return;
    }
  }
}

async function restoreTreeBackup(
  client: AdtClient,
  root: BackupTreeNode,
  mode: RestoreMode,
  activate: boolean,
): Promise<void> {
  const nodes = flattenTree(root).filter(
    (node) => node.type && node.restoreStatus === 'ok',
  );
  const priority = new Map(typeOrder.map((type, index) => [type, index]));
  nodes.sort((a, b) => {
    const aOrder = a.type ? (priority.get(a.type) ?? 999) : 999;
    const bOrder = b.type ? (priority.get(b.type) ?? 999) : 999;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });

  for (const node of nodes) {
    if (mode === 'upsert') {
      try {
        await restoreTreeNode(client, node, 'create', activate);
      } catch (error) {
        await restoreTreeNode(client, node, 'update', activate);
      }
    } else {
      await restoreTreeNode(client, node, mode, activate);
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
    const packageName =
      typeof args.package === 'string' ? args.package : undefined;

    if (packageName) {
      const output =
        typeof args.output === 'string' ? args.output : 'backup.yaml';
      const tree = await buildPackageBackupTree(
        client,
        readOnly,
        connection,
        packageName,
        true,
      );
      const yamlText = YAML.stringify(tree, { lineWidth: 0 });
      fs.writeFileSync(output, yamlText, 'utf8');
      console.log(`Backup written to ${output}`);
      return;
    }

    if (typeof rawObjects !== 'string') {
      throw new Error('Missing --objects or --package');
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

  if (command === 'tree') {
    const packageName =
      typeof args.package === 'string' ? args.package : undefined;
    if (!packageName) {
      throw new Error('Missing --package');
    }
    const output = typeof args.output === 'string' ? args.output : 'tree.yaml';
    const tree = await buildPackageBackupTree(
      client,
      readOnly,
      connection,
      packageName,
      false,
    );
    const lightTree: BackupTreeFile = {
      ...tree,
      root: stripCodeFromTree(tree.root),
    };
    const yamlText = YAML.stringify(lightTree, { lineWidth: 0 });
    fs.writeFileSync(output, yamlText, 'utf8');
    console.log(`Tree written to ${output}`);
    return;
  }

  if (command === 'restore') {
    const input = args.input;
    if (typeof input !== 'string') {
      throw new Error('Missing --input');
    }
    const raw = fs.readFileSync(input, 'utf8');
    const mode = (args.mode as RestoreMode) || 'upsert';
    const activate = Boolean(args.activate);
    const parsed = YAML.parse(raw) as BackupFile | BackupTreeFile;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup file format');
    }
    if ((parsed as BackupTreeFile).schemaVersion === 2) {
      const tree = parsed as BackupTreeFile;
      await restoreTreeBackup(client, tree.root, mode, activate);
      console.log('Restore completed');
      return;
    }
    if (!Array.isArray((parsed as BackupFile).objects)) {
      throw new Error('Invalid backup file format');
    }
    const flat = parsed as BackupFile;
    await restoreObjects(client, flat.objects, mode, activate);
    console.log(`Restore completed for ${flat.objects.length} object(s)`);
    return;
  }

  if (command === 'extract') {
    const input = args.input;
    const objectSpec = args.object;
    const output = args.out;
    if (typeof input !== 'string') {
      throw new Error('Missing --input');
    }
    if (typeof objectSpec !== 'string') {
      throw new Error('Missing --object');
    }
    if (typeof output !== 'string') {
      throw new Error('Missing --out');
    }
    const raw = fs.readFileSync(input, 'utf8');
    const parsed = YAML.parse(raw) as BackupTreeFile;
    if (!parsed || parsed.schemaVersion !== 2) {
      throw new Error('Extract supports only schemaVersion 2 backups');
    }
    const spec = parseObjectSpec(objectSpec);
    const node = findNodeInTree(parsed.root, spec);
    if (!node || !node.codeBase64) {
      throw new Error('Object not found or no codeBase64 in backup');
    }
    fs.writeFileSync(output, decodeBase64(node.codeBase64), 'utf8');
    console.log(`Extracted to ${output}`);
    return;
  }

  if (command === 'patch') {
    const input = args.input;
    const objectSpec = args.object;
    const filePath = args.file;
    if (typeof input !== 'string') {
      throw new Error('Missing --input');
    }
    if (typeof objectSpec !== 'string') {
      throw new Error('Missing --object');
    }
    if (typeof filePath !== 'string') {
      throw new Error('Missing --file');
    }
    const output = typeof args.output === 'string' ? args.output : input;
    const raw = fs.readFileSync(input, 'utf8');
    const parsed = YAML.parse(raw) as BackupTreeFile;
    if (!parsed || parsed.schemaVersion !== 2) {
      throw new Error('Patch supports only schemaVersion 2 backups');
    }
    const spec = parseObjectSpec(objectSpec);
    const node = findNodeInTree(parsed.root, spec);
    if (!node) {
      throw new Error('Object not found in backup');
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    node.codeBase64 = encodeBase64(fileContent);
    node.restoreStatus = 'ok';
    if (!node.codeFormat) {
      node.codeFormat = 'source';
    }
    const yamlText = YAML.stringify(parsed, { lineWidth: 0 });
    fs.writeFileSync(output as string, yamlText, 'utf8');
    console.log(`Backup updated at ${output}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
