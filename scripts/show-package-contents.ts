/**
 * Script: Show package hierarchy/contents
 *
 * Usage:
 *   npx ts-node scripts/show-package-contents.ts <PACKAGE_NAME> [OPTIONS]
 *   npx ts-node scripts/show-package-contents.ts ZTEST_PKG
 *   npx ts-node scripts/show-package-contents.ts ZTEST_PKG --depth=3 --no-subpackages
 *
 * Options:
 *   --depth=N           Max depth for subpackages (default: 5)
 *   --no-subpackages    Don't recurse into subpackages
 *   --no-descriptions   Don't include object descriptions
 *   --json              Output as JSON instead of tree view
 *
 * Environment variables:
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root)
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../src/clients/AdtClient';
import type { IPackageHierarchyNode } from '../src/core/shared/types';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
} from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const connectionLogger = createConnectionLogger();
const libraryLogger = createLibraryLogger();

interface Options {
  packageName: string;
  maxDepth: number;
  includeSubpackages: boolean;
  includeDescriptions: boolean;
  jsonOutput: boolean;
}

function parseArgs(argv: string[]): Options {
  let packageName = '';
  let maxDepth = 5;
  let includeSubpackages = true;
  let includeDescriptions = true;
  let jsonOutput = false;

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      if (arg.startsWith('--depth=')) {
        const value = Number.parseInt(arg.slice('--depth='.length), 10);
        if (!Number.isNaN(value) && value > 0) {
          maxDepth = value;
        }
      } else if (arg === '--no-subpackages') {
        includeSubpackages = false;
      } else if (arg === '--no-descriptions') {
        includeDescriptions = false;
      } else if (arg === '--json') {
        jsonOutput = true;
      }
    } else if (!packageName) {
      packageName = arg.trim().toUpperCase();
    }
  }

  return {
    packageName,
    maxDepth,
    includeSubpackages,
    includeDescriptions,
    jsonOutput,
  };
}

function printTree(
  node: IPackageHierarchyNode,
  prefix = '',
  isLast = true,
): void {
  const connector = isLast ? '└── ' : '├── ';
  const typeLabel = node.type || node.adtType || '';
  const descPart = node.description ? ` - ${node.description}` : '';
  const statusIcon = node.restoreStatus === 'ok' ? '' : ' [!]';

  console.log(`${prefix}${connector}${node.name} (${typeLabel})${descPart}${statusIcon}`);

  const children = node.children || [];
  const newPrefix = prefix + (isLast ? '    ' : '│   ');

  for (let i = 0; i < children.length; i++) {
    printTree(children[i], newPrefix, i === children.length - 1);
  }
}

function countObjects(node: IPackageHierarchyNode): { packages: number; objects: number } {
  let packages = node.is_package ? 1 : 0;
  let objects = node.is_package ? 0 : 1;

  for (const child of node.children || []) {
    const childCounts = countObjects(child);
    packages += childCounts.packages;
    objects += childCounts.objects;
  }

  return { packages, objects };
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.packageName) {
    console.error('Usage: npx ts-node scripts/show-package-contents.ts <PACKAGE_NAME> [OPTIONS]');
    console.error('');
    console.error('Options:');
    console.error('  --depth=N           Max depth for subpackages (default: 5)');
    console.error('  --no-subpackages    Don\'t recurse into subpackages');
    console.error('  --no-descriptions   Don\'t include object descriptions');
    console.error('  --json              Output as JSON instead of tree view');
    process.exit(1);
  }

  const config = getConfig();
  const connection = createAbapConnection(config, connectionLogger);
  await (connection as any).connect();

  const client = new AdtClient(connection, libraryLogger);
  const utils = client.getUtils();

  console.log(`Fetching package hierarchy for: ${options.packageName}`);
  console.log(`Options: depth=${options.maxDepth}, subpackages=${options.includeSubpackages}, descriptions=${options.includeDescriptions}`);
  console.log('');

  try {
    const hierarchy = await utils.getPackageHierarchy(options.packageName, {
      maxDepth: options.maxDepth,
      includeSubpackages: options.includeSubpackages,
      includeDescriptions: options.includeDescriptions,
    });

    if (options.jsonOutput) {
      console.log(JSON.stringify(hierarchy, null, 2));
    } else {
      printTree(hierarchy, '', true);

      const counts = countObjects(hierarchy);
      console.log('');
      console.log(`Total: ${counts.packages} package(s), ${counts.objects} object(s)`);
    }
  } catch (error: any) {
    console.error('Failed to fetch package hierarchy:', error?.message || error);
    process.exit(1);
  } finally {
    (connection as any).reset();
  }
}

run().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
