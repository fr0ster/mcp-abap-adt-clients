# Transaction Endpoints Analysis

## Analysis Date
2025-01-XX

## Purpose
Identify ADT endpoints useful for reading ABAP Transaction information.

## Findings from discovery.md

### Primary Endpoint for Transaction Properties

**Endpoint:** `/sap/bc/adt/repository/informationsystem/objectproperties/values`

**Method:** `GET`

**Template:** `/sap/bc/adt/repository/informationsystem/objectproperties/values{?uri}`

**Relation:** `http://www.sap.com/adt/relations/informationsystem/objectProperties`

**Description:**
- Returns object properties in XML format with `opr:objectProperties` structure
- Requires transaction URI as query parameter
- Returns transaction metadata: name, description, package, type

**Expected XML Format:**
```xml
<opr:objectProperties>
  <opr:object>
    <name>SE80</name>
    <text>ABAP Workbench</text>
    <package>...</package>
    <type>...</type>
  </opr:object>
</opr:objectProperties>
```

### Transaction URI Format

Based on ADT patterns and handler expectations, transaction URI should be:
```
/sap/bc/adt/transactions/{transaction_name}
```

Where `{transaction_name}` is the transaction code (e.g., `SE80`, `SE11`, `SM30`).

**Note:** This URI format is not explicitly documented in discovery.md but follows ADT conventions for object URIs.

### Alternative: Using Object Properties with Facet

**Endpoint:** `/sap/bc/adt/repository/informationsystem/objectproperties/values{?facet}`

**Relation:** `http://www.sap.com/adt/relations/informationsystem/objectProperties/facet`

**Description:**
- Alternative way to query object properties using facet parameter
- May provide additional filtering or formatting options

### Implementation Approach

1. **Build Transaction URI:**
   ```typescript
   const transactionUri = `/sap/bc/adt/transactions/${encodeSapObjectName(transactionName)}`;
   ```

2. **Query Object Properties:**
   ```typescript
   const url = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodeURIComponent(transactionUri)}`;
   ```

3. **Parse Response:**
   - Response is XML with `opr:objectProperties` structure
   - Extract: `name`, `text` (description), `package`, `type`

### Headers

**Accept Header:**
```
application/vnd.sap.adt.objectproperties+xml
```
or
```
application/xml
```

### Related Endpoints (Not Directly for Transactions)

1. **Object Properties (General):**
   - `/sap/bc/adt/repository/informationsystem/objectproperties/values` - Used for all object types

2. **Transport Properties:**
   - `/sap/bc/adt/repository/informationsystem/objectproperties/transports{?uri}` - For transport-related properties

3. **Property Values:**
   - `/sap/bc/adt/repository/informationsystem/properties/values{?maxItemCount,name,data}` - For property value lookups

### IAM Transaction Endpoints (Not for ABAP Transactions)

**Note:** The following endpoints in discovery.md are for IAM (Identity and Access Management) transaction codes, NOT ABAP transactions:

- `/sap/bc/adt/aps/cloud/iam/sia6/tcode/detail` - Transaction Code Details (IAM)
- `/sap/bc/adt/aps/cloud/iam/sia6/tcode/values` - Transaction codes (IAM)

These are for managing IAM permissions, not for reading ABAP transaction metadata.

## Recommended Implementation

### Function Signature
```typescript
async function getTransaction(
  connection: IAbapConnection,
  transactionName: string
): Promise<AxiosResponse>
```

### Implementation Steps

1. Encode transaction name: `encodeSapObjectName(transactionName.toLowerCase())`
2. Build transaction URI: `/sap/bc/adt/transactions/{encodedName}`
3. Build query URL: `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri={encodedUri}`
4. Make GET request with Accept header: `application/vnd.sap.adt.objectproperties+xml`
5. Parse XML response to extract transaction properties

### Expected Response Structure

```typescript
{
  name: string;           // Transaction code (e.g., "SE80")
  objectType: 'transaction';
  description: string;    // Transaction description
  package: string;       // Package name (if applicable)
  type: string;          // Transaction type
}
```

## Status

- ✅ Endpoint identified: `/sap/bc/adt/repository/informationsystem/objectproperties/values`
- ⚠️ Transaction URI format needs verification (assumed: `/sap/bc/adt/transactions/{name}`)
- ❌ Direct transaction endpoint not found in discovery.md
- ✅ XML parsing logic exists in handler (needs to be moved to adt-clients)

## Next Steps

1. Verify transaction URI format by testing with actual SAP system
2. Implement `getTransaction()` in `core/infrastructure/system/transaction.ts`
3. Add to `AdtUtils` → `getTransaction()`
4. Update handler to use `AdtClient.getUtils().getTransaction()`

