/**
 * ADT Discovery to Markdown Converter
 * 
 * Fetches ADT discovery endpoint and converts XML to readable markdown documentation.
 * 
 * Usage:
 *   npm run discovery:markdown
 *   npm run discovery:markdown -- --output custom-discovery.md
 *   npm run discovery:markdown -- --output discovery.md --url https://your-system.com
 *   npm run discovery:markdown -- --env /path/to/.env
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

interface DiscoveryEntry {
  rel?: string;
  href?: string;
  title?: string;
  type?: string;
  description?: string;
}

interface DiscoveryCategory {
  title?: string;
  description?: string;
  entries?: DiscoveryEntry[];
}

/**
 * Get SAP configuration from environment variables
 */
function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
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
    const uaaClientId = process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret = process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
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

/**
 * Parse discovery XML response
 */
function parseDiscoveryXml(xmlData: string): any {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: true,
    isArray: (name, jpath, isLeafNode, isAttribute) => {
      // Arrays for multiple entries/categories
      return ['app:link', 'app:category', 'link', 'category'].includes(name);
    }
  });

  return parser.parse(xmlData);
}

/**
 * Convert discovery XML to markdown
 * Based on the structure: app:service -> app:workspace -> app:collection -> adtcomp:templateLinks -> adtcomp:templateLink
 */
function convertToMarkdown(parsed: any, baseUrl: string): string {
  const lines: string[] = [];
  
  lines.push('# ADT Discovery Endpoints');
  lines.push('');
  lines.push(`Generated from: ${baseUrl}/sap/bc/adt/discovery`);
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');

  // Get root element (app:service)
  const service = parsed['app:service'] || parsed['service'] || parsed;
  
  if (!service) {
    lines.push('> ⚠️ No service data found in discovery response');
    return lines.join('\n');
  }

  // Extract workspaces
  const workspace = service['app:workspace'] || service['workspace'];
  const workspaceArray = Array.isArray(workspace) ? workspace : (workspace ? [workspace] : []);
  
  if (workspaceArray.length === 0) {
    lines.push('> ⚠️ No workspaces found in discovery response');
    return lines.join('\n');
  }

  // Process each workspace
  for (const ws of workspaceArray) {
    const workspaceTitleElement = ws['atom:title'] || ws['app:title'] || ws['title'];
    const workspaceTitle = typeof workspaceTitleElement === 'string' 
      ? workspaceTitleElement 
      : (workspaceTitleElement?.['#text'] || workspaceTitleElement || 'Workspace');
    
    lines.push(`## ${workspaceTitle}`);
    lines.push('');

    // Extract collections from workspace
    const collection = ws['app:collection'] || ws['collection'];
    const collectionArray = Array.isArray(collection) ? collection : (collection ? [collection] : []);
    
    for (const coll of collectionArray) {
      const collectionTitleElement = coll['atom:title'] || coll['app:title'] || coll['title'];
      const collectionTitle = typeof collectionTitleElement === 'string'
        ? collectionTitleElement
        : (collectionTitleElement?.['#text'] || collectionTitleElement || 'Unnamed Collection');
      
      const collectionHref = coll['@_href'] || coll['app:href'] || coll['href'];
      
      lines.push(`### ${collectionTitle}`);
      lines.push('');
      
      if (collectionHref) {
        // Clean up href (remove base URL if present)
        let href = collectionHref;
        if (href.startsWith('http')) {
          try {
            const url = new URL(href);
            href = url.pathname + url.search;
          } catch {
            // Keep as is if URL parsing fails
          }
        }
        lines.push(`**URL:** \`${href}\``);
        lines.push('');
      }

      // Extract template links (operations)
      const templateLinks = coll['adtcomp:templateLinks'] || coll['templateLinks'];
      if (templateLinks) {
        const templateLink = templateLinks['adtcomp:templateLink'] || templateLinks['templateLink'];
        const templateLinkArray = Array.isArray(templateLink) ? templateLink : (templateLink ? [templateLink] : []);
        
        if (templateLinkArray.length > 0) {
          lines.push('**Operations:**');
          lines.push('');
          
          for (const tlink of templateLinkArray) {
            const rel = tlink['@_rel'] || tlink['rel'] || '';
            const template = tlink['@_template'] || tlink['template'] || '';
            
            if (rel && template) {
              // Determine HTTP method from rel
              let method = 'GET';
              if (rel.includes('create') || rel.includes('new') || template.includes('_action=CREATE')) {
                method = 'POST';
              } else if (rel.includes('update') || rel.includes('edit') || template.includes('_action=UPDATE')) {
                method = 'PUT';
              } else if (rel.includes('delete') || rel.includes('remove') || template.includes('_action=DELETE')) {
                method = 'DELETE';
              } else if (rel.includes('lock')) {
                method = 'POST';
              } else if (rel.includes('unlock')) {
                method = 'POST';
              }
              
              // Clean up template URL
              let templateUrl = template;
              if (templateUrl.startsWith('http')) {
                try {
                  const url = new URL(templateUrl);
                  templateUrl = url.pathname + url.search;
                } catch {
                  // Keep as is
                }
              }
              
              lines.push(`- **${rel}**`);
              lines.push(`  - Method: \`${method}\``);
              lines.push(`  - Template: \`${templateUrl}\``);
              lines.push('');
            }
          }
        }
      }

      // Also check for regular app:link elements
      const links = coll['app:link'] || coll['link'] || [];
      const linkArray = Array.isArray(links) ? links : (links ? [links] : []);
      
      if (linkArray.length > 0) {
        lines.push('#### Endpoints');
        lines.push('');
        lines.push('| Method | Endpoint | Type | Description |');
        lines.push('|--------|----------|------|-------------|');
        
        for (const link of linkArray) {
          const rel = link['@_rel'] || link['rel'] || '';
          const href = link['@_href'] || link['href'] || '';
          const title = link['app:title'] || link['title'] || link['@_title'] || '';
          const type = link['@_type'] || link['type'] || '';
          const description = link['app:description'] || link['description'] || '';
          
          // Determine HTTP method from rel or href
          let method = 'GET';
          if (rel.includes('create') || href.includes('_action=CREATE')) {
            method = 'POST';
          } else if (rel.includes('update') || href.includes('_action=UPDATE')) {
            method = 'PUT';
          } else if (rel.includes('delete') || href.includes('_action=DELETE')) {
            method = 'DELETE';
          } else if (rel.includes('lock')) {
            method = 'POST';
          } else if (rel.includes('unlock')) {
            method = 'POST';
          }
          
          // Clean up href (remove base URL if present)
          let endpoint = href;
          if (endpoint.startsWith('http')) {
            try {
              const url = new URL(endpoint);
              endpoint = url.pathname + url.search;
            } catch {
              // Keep as is if URL parsing fails
            }
          }
          
          // Escape pipe characters in markdown table
          const escapeTable = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
          
          lines.push(`| ${method} | \`${escapeTable(endpoint)}\` | ${escapeTable(type || '-')} | ${escapeTable(description || title || rel || '-')} |`);
        }
        
        lines.push('');
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*This document was automatically generated from the ADT discovery endpoint.*');
  
  return lines.join('\n');
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let outputFile: string | undefined;
    let customUrl: string | undefined;
    let envFile: string | undefined;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--output' && i + 1 < args.length) {
        outputFile = args[i + 1];
        i++;
      } else if (args[i] === '--url' && i + 1 < args.length) {
        customUrl = args[i + 1];
        i++;
      } else if ((args[i] === '--env' || args[i] === '--config') && i + 1 < args.length) {
        envFile = args[i + 1];
        i++;
      } else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`
ADT Discovery to Markdown Converter

Usage:
  npm run discovery:markdown
  npm run discovery:markdown -- --output discovery.md
  npm run discovery:markdown -- --output discovery.md --url https://your-system.com
  npm run discovery:markdown -- --env /path/to/.env

Options:
  --output <file>    Output markdown file path (default: docs/architecture/discovery.md)
  --url <url>        Override SAP_URL from environment
  --env <file>       Path to .env file with connection parameters
  --config <file>    Alias for --env
  --help, -h         Show this help message

Environment variables (can be set in .env file or environment):
  SAP_URL            SAP system URL (required)
  SAP_AUTH_TYPE      Authentication type: 'basic' or 'jwt' (default: 'basic')
  SAP_USERNAME       Username for basic auth
  SAP_PASSWORD       Password for basic auth
  SAP_JWT_TOKEN      JWT token for JWT auth
  SAP_CLIENT         Client number (optional)
  MCP_ENV_PATH       Path to .env file (default: .env in project root)
        `);
        process.exit(0);
      }
    }

    // Load .env file if specified or use default
    let envPath: string;
    if (envFile) {
      envPath = path.resolve(envFile);
      if (!fs.existsSync(envPath)) {
        throw new Error(`Environment file not found: ${envPath}`);
      }
      console.log(`Loading environment from: ${envPath}`);
    } else {
      envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
    }
    
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, quiet: true });
      console.log(`✓ Loaded environment variables from: ${envPath}`);
    } else if (envFile) {
      throw new Error(`Environment file not found: ${envPath}`);
    } else {
      console.log(`ℹ️  No .env file found at: ${envPath} (using environment variables)`);
    }

    // Get configuration
    const config = getConfig();
    if (customUrl) {
      config.url = customUrl;
    }

    console.log(`Connecting to: ${config.url}`);
    
    // Create connection
    const connection = createAbapConnection(config, {
      debug: () => {},
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      warn: (msg: string) => console.warn(`[WARN] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
    });

    // Connect
    await connection.connect();
    console.log('✓ Connected to SAP system');

    // Fetch discovery endpoint
    console.log('Fetching discovery endpoint...');
    // Don't specify custom headers - let connection use defaults
    // Discovery endpoint should work with default Accept header
    const response = await connection.makeAdtRequest({
      url: '/sap/bc/adt/discovery',
      method: 'GET',
      timeout: 30000
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch discovery: HTTP ${response.status}`);
    }

    const xmlData = typeof response.data === 'string' 
      ? response.data 
      : JSON.stringify(response.data);

    console.log('✓ Discovery XML received');
    console.log(`XML length: ${xmlData.length} characters`);
    console.log('Parsing XML...');

    // Parse XML
    const parsed = parseDiscoveryXml(xmlData);
    console.log('✓ XML parsed');

    // Convert to markdown
    console.log('Converting to markdown...');
    const markdown = convertToMarkdown(parsed, config.url);
    console.log('✓ Markdown generated');

    // Determine output path
    let outputPath: string;
    if (outputFile) {
      // If output file is specified, resolve relative to current working directory
      outputPath = path.isAbsolute(outputFile) 
        ? outputFile 
        : path.resolve(process.cwd(), outputFile);
    } else {
      // Default: save to docs/architecture/discovery.md
      outputPath = path.resolve(__dirname, '../docs/architecture/discovery.md');
    }

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`✓ Created directory: ${outputDir}`);
    }

    // Write to file
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`✓ Markdown written to: ${outputPath}`);

    // Disconnect
    connection.reset();
    console.log('✓ Disconnected');

  } catch (error) {
    console.error('✗ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

