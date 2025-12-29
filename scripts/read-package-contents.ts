/**
 * Script: Read package contents using AdtClient
 *
 * Usage:
 *   npx ts-node scripts/read-package-contents.ts <PACKAGE_NAME> [OPTIONS]
 *   npx ts-node scripts/read-package-contents.ts ZTEST_PKG
 *   npx ts-node scripts/read-package-contents.ts ZTEST_PKG --tree
 *   npx ts-node scripts/read-package-contents.ts ZTEST_PKG --subpackages
 *   npx ts-node scripts/read-package-contents.ts ZTEST_PKG --json
 *
 * Options:
 *   --tree         Output as tree structure (using getPackageHierarchy)
 *   --subpackages  Include subpackage contents recursively
 *   --json         Output as JSON
 *   --depth=N      Max depth for subpackages (default: 5)
 *
 * Environment variables:
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root)
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../src/clients/AdtClient';
import type { IPackageContentItem, IPackageHierarchyNode } from '../src/core/shared/types';
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
  treeMode: boolean;
  includeSubpackages: boolean;
  jsonOutput: boolean;
  maxDepth: number;
}

function parseArgs(argv: string[]): Options {
  let packageName = '';
  let treeMode = false;
  let includeSubpackages = false;
  let jsonOutput = false;
  let maxDepth = 5;

  for (const arg of argv) {
    if (arg === '--tree') {
      treeMode = true;
    } else if (arg === '--subpackages') {
      includeSubpackages = true;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg.startsWith('--depth=')) {
      const value = Number.parseInt(arg.slice('--depth='.length), 10);
      if (!Number.isNaN(value) && value > 0) {
        maxDepth = value;
      }
    } else if (!arg.startsWith('--') && !packageName) {
      packageName = arg.trim().toUpperCase();
    }
  }

  return { packageName, treeMode, includeSubpackages, jsonOutput, maxDepth };
}

function printTable(items: IPackageContentItem[]): void {
  if (items.length === 0) {
    console.log('No objects found.');
    return;
  }

  // Calculate column widths
  const nameWidth = Math.max(4, ...items.map((o) => o.name.length));
  const typeWidth = Math.max(4, ...items.map((o) => o.adtType.length));
  const pkgWidth = Math.max(7, ...items.map((o) => o.packageName.length));

  // Print header
  console.log(
    `${'NAME'.padEnd(nameWidth)}  ${'TYPE'.padEnd(typeWidth)}  ${'PACKAGE'.padEnd(pkgWidth)}  DESCRIPTION`,
  );
  console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(typeWidth)}  ${'-'.repeat(pkgWidth)}  ${'-'.repeat(30)}`);

  // Print rows
  for (const item of items) {
    console.log(
      `${item.name.padEnd(nameWidth)}  ${item.adtType.padEnd(typeWidth)}  ${item.packageName.padEnd(pkgWidth)}  ${item.description || ''}`,
    );
  }

  console.log('');
  console.log(`Total: ${items.length} object(s)`);
}

function printTree(node: IPackageHierarchyNode, prefix = '', isLast = true): void {
  const connector = isLast ? '└── ' : '├── ';
  const typeLabel = node.adtType || '';
  const descPart = node.description ? ` - ${node.description}` : '';

  console.log(`${prefix}${connector}${node.name} (${typeLabel})${descPart}`);

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
    console.error('Usage: npx ts-node scripts/read-package-contents.ts <PACKAGE_NAME> [OPTIONS]');
    console.error('');
    console.error('Options:');
    console.error('  --tree         Output as tree structure');
    console.error('  --subpackages  Include subpackage contents recursively');
    console.error('  --json         Output as JSON');
    console.error('  --depth=N      Max depth for subpackages (default: 5)');
    process.exit(1);
  }

  const config = getConfig();
  const connection = createAbapConnection(config, connectionLogger);
  await (connection as any).connect();

  const client = new AdtClient(connection, libraryLogger);
  const utils = client.getUtils();

  console.log(`Reading package contents for: ${options.packageName}`);
  if (options.treeMode) {
    console.log('Mode: tree (getPackageHierarchy)');
  } else {
    console.log('Mode: list (getPackageContentsList)');
  }
  if (options.includeSubpackages) {
    console.log(`Include subpackages: yes (depth: ${options.maxDepth})`);
  }
  console.log('');

  try {
    if (options.treeMode) {
      // Tree mode - use getPackageHierarchy
      const tree = await utils.getPackageHierarchy(options.packageName, {
        includeSubpackages: options.includeSubpackages,
        maxDepth: options.maxDepth,
        includeDescriptions: true,
      });

      if (options.jsonOutput) {
        console.log(JSON.stringify(tree, null, 2));
      } else {
        printTree(tree, '', true);
        const counts = countObjects(tree);
        console.log('');
        console.log(`Total: ${counts.packages} package(s), ${counts.objects} object(s)`);
      }
    } else {
      // List mode - use getPackageContentsList
      const items = await utils.getPackageContentsList(options.packageName, {
        includeSubpackages: options.includeSubpackages,
        maxDepth: options.maxDepth,
        includeDescriptions: true,
      });

      if (options.jsonOutput) {
        console.log(JSON.stringify(items, null, 2));
      } else {
        printTable(items);
      }
    }
  } catch (error: any) {
    console.error('Failed to read package contents:', error?.message || error);
    process.exit(1);
  } finally {
    (connection as any).reset();
  }
}

run().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
