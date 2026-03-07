# RFC Connection Guide

RFC (Remote Function Call) transport allows ADT operations on legacy SAP systems (BASIS < 7.50) where HTTP stateful sessions are not supported. It uses the standard SAP function module `SADT_REST_RFC_ENDPOINT` — the same mechanism Eclipse ADT uses via JCo.

## When to Use RFC

- **Legacy systems** (BASIS < 7.50) — HTTP `x-sap-adt-sessiontype: stateful` header is not supported, so lock handles are lost between requests. RFC connections are inherently stateful (one ABAP session per connection), solving this problem.
- **Systems without HTTP stateful support** — some custom configurations disable HTTP stateful sessions.

Modern systems (BASIS >= 7.50, S/4 HANA, BTP) work fine with HTTP connections and don't need RFC.

## Prerequisites

### 1. SAP NW RFC SDK

Download SAP NW RFC SDK from [SAP Support Portal](https://support.sap.com/en/product/connectors/nwrfcsdk.html) (requires S-user).

Install it on your machine and configure environment variables:

**Windows (PowerShell):**
```powershell
$env:SAPNWRFC_HOME = "C:\nwrfcsdk\nwrfcsdk"
$env:PATH = "C:\nwrfcsdk\nwrfcsdk\lib;$env:PATH"
```

**Windows (cmd):**
```cmd
set SAPNWRFC_HOME=C:\nwrfcsdk\nwrfcsdk
set PATH=C:\nwrfcsdk\nwrfcsdk\lib;%PATH%
```

**Linux/macOS (bash):**
```bash
export SAPNWRFC_HOME=~/nwrfcsdk
export PATH=$SAPNWRFC_HOME/lib:$PATH
# Linux also needs:
export LD_LIBRARY_PATH=$SAPNWRFC_HOME/lib:$LD_LIBRARY_PATH
```

> **Note:** These variables must be set in the shell before running the application. They cannot be loaded from `.env` files because `dotenv` does not expand `$PATH`/`%PATH%` and does not modify the system PATH.

### 2. node-rfc Package

```bash
npm install node-rfc
```

`node-rfc` is NOT a declared dependency of this package — it is loaded dynamically at runtime only when RFC connections are used.

### 3. SAP Authorization

The SAP user needs `S_RFC` authorization for function module `SADT_REST_RFC_ENDPOINT`. See SAP Note 3569684 for details.

## Configuration

### Connection Layer (`@mcp-abap-adt/connection`)

Create an RFC connection using `authType: 'rfc'`:

```typescript
import { RfcAbapConnection } from '@mcp-abap-adt/connection';

const connection = new RfcAbapConnection({
  url: 'http://saphost:8000',    // hostname and port are used to derive RFC params
  authType: 'rfc',
  client: '100',
  username: 'DEVELOPER',
  password: 'secret',
});

await connection.connect();
```

Connection parameters are derived from the URL:
- `ashost` — parsed from URL hostname
- `sysnr` — derived from port (80XX -> XX, e.g. 8000 -> 00, 8001 -> 01)
- `client`, `user`, `passwd` — from config

### ADT Clients Layer (`@mcp-abap-adt/adt-clients`)

ADT clients work transparently with RFC connections — no code changes needed. The `IAbapConnection` interface is the same for both HTTP and RFC.

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection, logger);
// All operations work the same as with HTTP connections
const program = client.getProgram();
await program.read({ programName: 'ZTEST' });
```

### Legacy Content Types

On legacy systems, some ADT endpoints don't support versioned content types (v2+, v3+, v4+). The library automatically detects system capabilities via the `/sap/bc/adt/discovery` endpoint and uses appropriate content types:

- Modern systems: `application/vnd.sap.adt.programs.programs.v2+xml`
- Legacy systems: `application/vnd.sap.adt.programs.programs+xml` (no version)

This is handled automatically by `createAdtClient()` which returns either `AdtClient` or `AdtClientLegacy` based on system capabilities.

### Unicode / Non-Unicode Systems

Non-unicode legacy systems require `text/plain` (without `charset=utf-8`) as the source artifact content type in checkRun XML payloads. Set `SAP_UNICODE=false` in `.env` to configure this:

```env
SAP_UNICODE=false   # Non-unicode legacy system (e.g., E77)
```

If omitted, the library defaults to `text/plain; charset=utf-8` (unicode). Setting this incorrectly causes checkRun to return `notProcessed` with `"Dirty Source: Wrong content type"`.

## How It Works

1. `RfcAbapConnection.connect()` opens an RFC connection via `node-rfc`
2. Each `makeAdtRequest()` call invokes `SADT_REST_RFC_ENDPOINT` FM
3. The FM proxies HTTP-like requests internally within the ABAP system
4. The RFC session is inherently stateful — lock handles persist across calls
5. `setSessionType()` is a no-op — RFC connections are always stateful

## Differences from HTTP

| Aspect | HTTP | RFC |
|--------|------|-----|
| Session | Toggle stateful/stateless | Always stateful |
| Lock handles | May be lost on legacy systems | Always preserved |
| Content negotiation | Standard HTTP Accept | Some endpoints only accept `*/*` |
| sap-client | Added to URL query | Not needed (set in RFC params) |
| Authentication | Basic/JWT/XSUAA | Username/password only |
| Dependencies | axios | node-rfc + SAP NW RFC SDK |

## Troubleshooting

### "node-rfc is not available"

SAP NW RFC SDK is not installed or not in PATH. Verify:
```bash
# Check SAPNWRFC_HOME
echo $SAPNWRFC_HOME

# Check lib is in PATH
node -e "try { require('node-rfc'); console.log('OK'); } catch(e) { console.log(e.message.substring(0, 200)); }"
```

### "The specified module could not be found: sapnwrfc.node"

The native module exists but can't load its dependencies. Ensure `SAPNWRFC_HOME/lib` is in system PATH **before** starting Node.js.

### 406 Not Acceptable on function group read

Some endpoints via RFC don't support specific Accept content types. The library handles this by using `*/*` where needed.

### Lock handle encoding errors (423 "invalid lock handle")

RFC returns base64 lock handles that may contain spaces, `+`, `=`. All lock handles are encoded with `encodeURIComponent()` when placed in URL query parameters.
