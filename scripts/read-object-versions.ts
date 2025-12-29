/**
 * Temporary script: verify active vs inactive read sequence.
 *
 * Usage:
 *   npx ts-node scripts/read-object-versions.ts [OBJECT_NAME] [--type=class] [--function-group=ZFG]
 *   npx ts-node scripts/read-object-versions.ts ZOK_CL_READER_DIGEST
 *
 * Flags:
 *   --type=class|program|interface|functionmodule|view|structure|table|tabletype
 *   --function-group=ZFG (required for functionmodule)
 *   --read-only (skip update/activate, just read available versions)
 *   --version=active|inactive
 *   --versions=active,inactive
 *   --print[=active|inactive|both]
 *   --diff
 *   --log-url
 *   --transport=XYZK900001 (override transport)
 *
 * Environment variables:
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root)
 *   SAP_TRANSPORT - Optional transport request for update/activate
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../src/clients/AdtClient';
import type { AdtSourceObjectType } from '../src/core/shared/types';
import { makeAdtRequestWithAcceptNegotiation } from '../src/utils/acceptNegotiation';
import { getTimeout } from '../src/utils/timeouts';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import {
  createBuilderLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../src/__tests__/helpers/testLogger';

const testHelper = require('../src/__tests__/helpers/test-helper');
const resolveTransportRequest = testHelper.resolveTransportRequest;

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const builderLogger = createBuilderLogger();
const testsLogger = createTestsLogger();

type Options = {
  objectType: AdtSourceObjectType | string;
  objectName: string;
  functionGroup?: string;
  readOnly: boolean;
  versions: Set<'active' | 'inactive'>;
  print: 'active' | 'inactive' | 'both' | 'none';
  diff: boolean;
  logUrl: boolean;
  transportRequest?: string;
};

function parseVersions(value: string): Set<'active' | 'inactive'> {
  const versions = new Set<'active' | 'inactive'>();
  const parts = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  for (const part of parts) {
    if (part === 'active' || part === 'inactive') {
      versions.add(part);
    }
  }
  return versions;
}

function parseArgs(argv: string[]): Options {
  let objectName: string | undefined;
  let objectType = 'class';
  let functionGroup: string | undefined;
  let readOnly = true;
  let transportRequest: string | undefined;
  let versions = new Set<'active' | 'inactive'>(['active', 'inactive']);
  let print: 'active' | 'inactive' | 'both' | 'none' = 'none';
  let diff = false;
  let logUrl = false;

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      if (!objectName) {
        objectName = arg.trim();
      }
      continue;
    }
    if (arg === '--read-only') {
      readOnly = true;
      continue;
    }
    if (arg.startsWith('--type=')) {
      objectType = arg.slice('--type='.length).trim();
      continue;
    }
    if (arg.startsWith('--function-group=')) {
      functionGroup = arg.slice('--function-group='.length).trim();
      continue;
    }
    if (arg.startsWith('--version=')) {
      const value = arg.slice('--version='.length).trim();
      const parsed = parseVersions(value);
      if (parsed.size > 0) {
        versions = parsed;
      }
      continue;
    }
    if (arg.startsWith('--versions=')) {
      const value = arg.slice('--versions='.length).trim();
      const parsed = parseVersions(value);
      if (parsed.size > 0) {
        versions = parsed;
      }
      continue;
    }
    if (arg === '--print') {
      print = 'both';
      continue;
    }
    if (arg.startsWith('--print=')) {
      const value = arg.slice('--print='.length).trim().toLowerCase();
      if (value === 'active' || value === 'inactive' || value === 'both') {
        print = value;
      }
      continue;
    }
    if (arg === '--diff') {
      diff = true;
      continue;
    }
    if (arg === '--log-url') {
      logUrl = true;
      continue;
    }
    if (arg.startsWith('--transport=')) {
      transportRequest = arg.slice('--transport='.length).trim();
      continue;
    }
  }

  if (diff && versions.size < 2) {
    versions = new Set<'active' | 'inactive'>(['active', 'inactive']);
  }

  return {
    objectType,
    objectName: objectName || '',
    functionGroup,
    readOnly,
    versions,
    print,
    diff,
    logUrl,
    transportRequest,
  };
}

const options = parseArgs(process.argv.slice(2));

function insertMarker(source: string, marker: string): string {
  const regex = /ENDCLASS\./gi;
  let match: RegExpExecArray | null;
  let lastIndex = -1;
  while ((match = regex.exec(source)) !== null) {
    lastIndex = match.index;
  }
  if (lastIndex === -1) {
    return `${source}\n* ${marker}\n`;
  }
  const before = source.slice(0, lastIndex);
  const after = source.slice(lastIndex);
  return `${before}* ${marker}\n${after}`;
}

async function readSource(
  client: AdtClient,
  connection: ReturnType<typeof createAbapConnection>,
  version: 'active' | 'inactive',
  attempts = 10,
  delayMs = 2000,
): Promise<string> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const utils = client.getUtils();
      let url = utils.getObjectSourceUri(
        options.objectType as any,
        options.objectName,
        options.functionGroup,
        version,
      );

      if (version === 'inactive') {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}withLongPolling=true`;
      }

      if (options.logUrl) {
        testsLogger.info?.(`URL (${version}): ${url}`);
      }

      const response = await makeAdtRequestWithAcceptNegotiation(
        connection,
        {
          url,
          method: 'GET',
          timeout: getTimeout('default'),
          headers: {
            Accept: 'text/plain',
          },
        },
        {
          logger: testsLogger,
        },
      );
      if (typeof response.data === 'string' && response.data.length > 0) {
        return response.data;
      }
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(
    `Failed to read ${version} source after ${attempts} attempts`,
  );
}

function logHttpError(error: any, label: string): void {
  const status = error?.response?.status;
  const statusText = error?.response?.statusText || '';
  const data = error?.response?.data;
  const dataText =
    typeof data === 'string'
      ? data.slice(0, 1000)
      : data
        ? JSON.stringify(data).slice(0, 1000)
        : '';
  testsLogger.error?.(
    `${label} failed: HTTP ${status || '?'} ${statusText} ${dataText}`.trim(),
  );
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function shouldPrint(version: 'active' | 'inactive'): boolean {
  if (options.print === 'both') return true;
  if (options.print === 'active' && version === 'active') return true;
  if (options.print === 'inactive' && version === 'inactive') return true;
  return false;
}

function printSource(version: 'active' | 'inactive', text: string): void {
  if (!shouldPrint(version)) return;
  const header = `--- ${version.toUpperCase()} SOURCE (${options.objectType} ${options.objectName}) ---`;
  console.log(header);
  console.log(text);
  console.log('-'.repeat(Math.min(80, header.length)));
}

function printDiff(activeText: string, inactiveText: string): void {
  if (!options.diff) return;
  if (activeText === inactiveText) {
    console.log('--- DIFF ---');
    console.log('No differences between active and inactive.');
    console.log('------------');
    return;
  }
  const activeLines = activeText.split(/\r?\n/);
  const inactiveLines = inactiveText.split(/\r?\n/);
  const maxLines = Math.max(activeLines.length, inactiveLines.length);
  console.log('--- DIFF (inactive vs active) ---');
  for (let i = 0; i < maxLines; i += 1) {
    const a = activeLines[i];
    const b = inactiveLines[i];
    if (a === b) {
      continue;
    }
    if (a !== undefined) {
      console.log(`- ${a}`);
    }
    if (b !== undefined) {
      console.log(`+ ${b}`);
    }
  }
  console.log('---------------------------------');
}

async function run(): Promise<void> {
  if (!options.objectName) {
    throw new Error('Object name is required');
  }
  const config = getConfig();
  const connection = createAbapConnection(config, connectionLogger);
  await (connection as any).connect();
  const client = new AdtClient(connection, builderLogger);

  const transportRequest = resolveTransportRequest(
    options.transportRequest ?? process.env.SAP_TRANSPORT,
  );
  const marker = `TEMP_VERSION_CHECK ${new Date().toISOString()}`;
  const objectType = options.objectType.toLowerCase();

  let originalSource = '';
  let updatedSource = '';
  let updateSucceeded = false;
  let inactiveSource = '';
  let activeAfter = '';

  try {
    if (options.readOnly || objectType !== 'class') {
      const utils = client.getUtils();

      testsLogger.info?.(
        `Reading metadata for ${options.objectType} ${options.objectName}...`,
      );
      try {
        const metadata = await utils.readObjectMetadata(
          options.objectType as any,
          options.objectName,
          options.functionGroup,
        );
        testsLogger.info?.(`Metadata status: ${metadata.status}`);
      } catch (error) {
        logHttpError(error, 'Read metadata');
      }

      if (utils.supportsSourceCode(options.objectType as any)) {
        let activeSource = '';
        let inactiveSource = '';
        if (options.versions.has('active')) {
          testsLogger.info?.(
            `Reading active source for ${options.objectType} ${options.objectName}...`,
          );
          try {
            activeSource = await readSource(client, connection, 'active');
            originalSource = activeSource;
            testsLogger.info?.(
              `Active source length: ${activeSource.length} characters (sha256:${hashText(activeSource)})`,
            );
            printSource('active', activeSource);
          } catch (error) {
            logHttpError(error, 'Read active source');
          }
        }

        if (options.versions.has('inactive')) {
          testsLogger.info?.(
            `Reading inactive source for ${options.objectType} ${options.objectName}...`,
          );
          try {
            const inactive = await readSource(client, connection, 'inactive');
            inactiveSource = inactive;
            testsLogger.info?.(
              `Inactive source length: ${inactive.length} characters (sha256:${hashText(inactive)})`,
            );
            printSource('inactive', inactive);
          } catch (error) {
            logHttpError(error, 'Read inactive source');
          }
        }

        if (activeSource && inactiveSource) {
          const matches = activeSource === inactiveSource;
          testsLogger.info?.(
            `Active vs inactive match: ${matches ? 'yes' : 'no'}`,
          );
          printDiff(activeSource, inactiveSource);
        }
      } else {
        testsLogger.warn?.(
          `Source reading not supported for object type ${options.objectType}`,
        );
      }

      return;
    }

    testsLogger.info?.(`Reading active source for ${options.objectName}...`);
    originalSource = await readSource(client, connection, 'active');
    testsLogger.info?.(
      `Active source length: ${originalSource.length} characters`,
    );

    updatedSource = insertMarker(originalSource, marker);
    if (updatedSource === originalSource) {
      throw new Error('Failed to modify source (marker insertion failed)');
    }

    testsLogger.info?.('Updating class (creates inactive version)...');
    if (!transportRequest) {
      testsLogger.warn?.(
        'No transport request resolved; update may fail if transport is required.',
      );
    }
    try {
      await client.getClass().update(
        {
          className: options.objectName,
          transportRequest,
          sourceCode: updatedSource,
        },
        { sourceCode: updatedSource },
      );
    } catch (error) {
      logHttpError(error, 'Update');
      throw error;
    }
    updateSucceeded = true;

    testsLogger.info?.('Reading inactive source after update...');
    if (options.versions.has('inactive')) {
      inactiveSource = await readSource(client, connection, 'inactive');
      testsLogger.info?.(
        `Inactive source length: ${inactiveSource.length} characters`,
      );
    }

    testsLogger.info?.('Activating...');
    try {
      await client.getClass().activate({ className: options.objectName });
    } catch (error) {
      logHttpError(error, 'Activate');
      throw error;
    }

    if (options.versions.has('active')) {
      testsLogger.info?.('Reading active source after activation...');
      activeAfter = await readSource(client, connection, 'active');
    }

    if (options.versions.has('inactive') && inactiveSource) {
      const inactiveMatchesUpdate = inactiveSource === updatedSource;
      testsLogger.info?.(
        `inactive == updated: ${inactiveMatchesUpdate ? 'yes' : 'no'}`,
      );
    }

    if (options.versions.has('active') && activeAfter) {
      if (options.versions.has('inactive') && inactiveSource) {
        const activeMatchesInactive = activeAfter === inactiveSource;
        testsLogger.info?.(
          `active(after) == inactive: ${activeMatchesInactive ? 'yes' : 'no'}`,
        );
      }
      const activeChanged = originalSource !== activeAfter;
      testsLogger.info?.(
        `active(after) != active(before): ${activeChanged ? 'yes' : 'no'}`,
      );
    }
  } finally {
    if (updateSucceeded && originalSource) {
      testsLogger.info?.('Restoring original source...');
      await client.getClass().update(
        { className: options.objectName, transportRequest, sourceCode: originalSource },
        { sourceCode: originalSource },
      );
      await client.getClass().activate({ className: options.objectName });
      const restored = await readSource(client, connection, 'active');
      const restoredOk = restored === originalSource;
      testsLogger.info?.(
        `Restored active source matches original: ${restoredOk ? 'yes' : 'no'}`,
      );
    }

    (connection as any).reset();
  }
}

run().catch((error) => {
  // Use console here for script failure visibility
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
