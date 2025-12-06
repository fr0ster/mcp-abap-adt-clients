# Check Content Format Guidelines

## Overview

When checking ABAP objects before update, the content passed to the check operation should match the format that will be sent in the PUT request. This ensures accurate validation of the changes.

## Content Types by Object

### Text-based Objects (source code)
These objects use `text/plain; charset=utf-8` content type:

- **Class** (main source, includes)
- **Interface** 
- **Program**
- **Function Module**
- **Function Group**
- **Structure** (DDL source)
- **Table** (DDL source)
- **View** (DDL/CDS source)
- **Service Definition**
- **Metadata Extension**
- **Behavior Definition**

For these objects:
- Check artifact: `contentType="text/plain; charset=utf-8"`
- PUT Content-Type: `text/plain; charset=utf-8`
- Content: Base64-encoded source code

### XML Metadata Objects
These objects use XML content type:

#### Domain
- Check artifact: `contentType="application/vnd.sap.adt.domains.v2+xml; charset=utf-8"`
- PUT Content-Type: `application/vnd.sap.adt.domains.v2+xml; charset=utf-8`
- Content: Base64-encoded domain XML (same structure as PUT body)

Example XML structure:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<doma:domain xmlns:doma="http://www.sap.com/dictionary/domain"
             xmlns:adtcore="http://www.sap.com/adt/core"
             adtcore:description="Description"
             adtcore:name="DOMAIN_NAME"
             adtcore:type="DOMA/DD"
             ...>
  <adtcore:packageRef adtcore:name="PACKAGE_NAME"/>
  <doma:content>
    <doma:typeInformation>...</doma:typeInformation>
    <doma:outputInformation>...</doma:outputInformation>
    <doma:valueInformation>...</doma:valueInformation>
  </doma:content>
</doma:domain>
```

#### Data Element
- Check artifact: `contentType="application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8"`
- PUT Content-Type: `application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8`
- Content: Base64-encoded data element XML (same structure as PUT body)

#### Package
- Check artifact: `contentType="application/vnd.sap.adt.packages.v2+xml"`
- PUT Content-Type: `application/vnd.sap.adt.packages.v2+xml`
- Content: Base64-encoded package XML (same structure as PUT body)

## Implementation Pattern

### Check Functions
All check functions now support optional content parameter:

```typescript
export async function checkDomainSyntax(
  connection: IAbapConnection,
  domainName: string,
  version: 'active' | 'inactive',
  xmlContent?: string  // Optional: validates this content instead of saved version
): Promise<AxiosResponse>
```

### Builder Pattern
Builders generate content in check() method before calling check function:

```typescript
async check(version: 'active' | 'inactive' = 'inactive'): Promise<AxiosResponse> {
  // 1. Generate XML content (same as will be sent in PUT)
  let xmlContent: string | undefined;
  if (this.config.packageName) {
    // Build XML from config...
    xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<doma:domain ...>
  ...
</doma:domain>`;
  }

  // 2. Pass content to check function
  const result = await checkDomainSyntax(
    this.connection,
    this.config.domainName,
    version,
    xmlContent  // Same XML as PUT will use
  );
  
  return result;
}
```

## Benefits

1. **Accurate Validation**: Check validates the exact content that will be sent in PUT
2. **Early Error Detection**: Errors are caught before attempting update
3. **Consistency**: Same XML/content structure used in check and update
4. **Test Reliability**: Tests can verify check-before-update workflow

## Modified Files

### Core Check Functions
- `src/core/domain/check.ts` - Added xmlContent parameter
- `src/core/dataElement/check.ts` - Added xmlContent parameter  
- `src/core/package/check.ts` - Added xmlContent parameter

### Builders
- `src/core/domain/DomainBuilder.ts` - Generate XML in check() method

## Related Documentation
- [Operation Delays Summary](../usage/OPERATION_DELAYS_SUMMARY.md)
- [Stateful Session Guide](../usage/STATEFUL_SESSION_GUIDE.md)
