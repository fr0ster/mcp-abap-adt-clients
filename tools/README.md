# Developer Tools

This directory contains utility scripts for development and maintenance of the ADT clients library.

## Available Tools

### 1. Discovery to Markdown Converter

**`discovery-to-markdown.ts`** - Fetches ADT discovery endpoint and converts XML to readable markdown documentation (also saves pretty XML).

**Purpose:** Generates markdown documentation from the ADT discovery endpoint (`/sap/bc/adt/discovery`) that lists all available ADT API endpoints.

**Usage:**
```bash
npm run discovery:markdown
# or
npm run discovery:markdown -- --output custom-discovery.md
# or
npm run discovery:markdown -- --output discovery.md --url https://your-system.com
# or
npm run discovery:markdown -- --env /path/to/.env
# or
npm run discovery:markdown -- --config /path/to/.env
```

**Options:**
- `--output <file>` - Output markdown file path (default: `docs/architecture/discovery.md`)
- `--url <url>` - Override `SAP_URL` from environment
- `--env <file>` - Path to `.env` file with connection parameters
- `--config <file>` - Alias for `--env`
- `--help, -h` - Show help message

**Environment Variables:**

The script automatically loads variables from a `.env` file in the project root (or from the path specified in `MCP_ENV_PATH`). You can also:
- Specify a custom `.env` file using `--env` or `--config` option
- Set variables directly in the environment

- `SAP_URL` - SAP system URL (required)
- `SAP_AUTH_TYPE` - Authentication type: `'basic'` or `'jwt'` (default: `'basic'`)
- `SAP_USERNAME` - Username for basic auth (required if authType is `'basic'`)
- `SAP_PASSWORD` - Password for basic auth (required if authType is `'basic'`)
- `SAP_JWT_TOKEN` - JWT token for JWT auth (required if authType is `'jwt'`)
- `SAP_CLIENT` - Client number (optional)
- `SAP_REFRESH_TOKEN` - Refresh token for JWT auth (optional)
- `SAP_UAA_URL` - UAA URL for JWT token refresh (optional)
- `SAP_UAA_CLIENT_ID` - UAA client ID for token refresh (optional)
- `SAP_UAA_CLIENT_SECRET` - UAA client secret for token refresh (optional)
- `MCP_ENV_PATH` - Path to `.env` file (default: `.env` in project root)

**What it does:**
1. Connects to the SAP system using the provided credentials
2. Fetches the discovery endpoint: `GET /sap/bc/adt/discovery` (via `AdtUtils.discovery()`)
3. Parses the XML response
4. Converts it to readable markdown with:
   - Endpoint categories
   - HTTP methods (GET, POST, PUT, DELETE)
   - Endpoint URLs
   - Content types
   - Descriptions
5. Saves the pretty-printed discovery XML next to the markdown output

**Output:** 
- Default: `docs/architecture/discovery.md` and `docs/architecture/discovery.xml` (if `--output` is not specified)
- Custom: Path specified via `--output` option, plus `discovery.xml` in the same directory

The script automatically creates the output directory if it doesn't exist.

**Example Output:**
```markdown
# ADT Discovery Endpoints

## ADT Service

### Objects
**Base URL:** `/sap/bc/adt/oo/classes`

| Method | Endpoint | Type | Description |
|--------|----------|------|-------------|
| GET | `/sap/bc/adt/oo/classes/{name}` | `application/vnd.sap.adt.oo.classes.v1+xml` | Get class |
| POST | `/sap/bc/adt/oo/classes/{name}?_action=CREATE` | `application/vnd.sap.adt.oo.classes.v1+xml` | Create class |
```

**When to use:**
- To explore available ADT API endpoints
- To generate documentation for ADT API
- To understand the structure of ADT discovery responses
- To verify endpoint availability on a specific SAP system
