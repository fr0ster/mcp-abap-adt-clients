# Update Content Types Reference

## Complete list of content types for UPDATE operations

### 📝 TEXT/PLAIN (Source Code) Objects

Objects that send **source code** (text/plain):

| # | Object Type | File | Content-Type | Data Type |
|---|------------|------|--------------|-----------|
| 1 | **Class** (main source) | `src/core/class/update.ts` | `text/plain; charset=utf-8` | ABAP source code |
| 2 | **Class** (testclasses include) | `src/core/class/update.ts` | `text/plain; charset=utf-8` | ABAP test class code |
| 3 | **Class** (implementations include) | `src/core/class/includes.ts` | `text/plain; charset=utf-8` | ABAP local types code |
| 4 | **Class** (definitions include) | `src/core/class/includes.ts` | `text/plain; charset=utf-8` | ABAP type definitions code |
| 5 | **Class** (macros include) | `src/core/class/includes.ts` | `text/plain; charset=utf-8` | ABAP macros code |
| 6 | **Interface** | `src/core/interface/InterfaceBuilder.ts` | `text/plain; charset=utf-8` | ABAP interface code |
| 7 | **Program** | `src/core/program/update.ts` | `text/plain; charset=utf-8` | ABAP program code |
| 8 | **Function Module** | `src/core/functionModule/update.ts` | `text/plain; charset=utf-8` | ABAP function code |
| 9 | **Table** (DDL) | `src/core/table/update.ts` | `text/plain; charset=utf-8` | DDL source code |
| 10 | **Structure** (DDL) | `src/core/structure/update.ts` | `text/plain; charset=utf-8` | DDL source code |
| 11 | **View** (CDS/DDL) | `src/core/view/update.ts` | `text/plain; charset=utf-8` | CDS/DDL source code |
| 12 | **Service Definition** | `src/core/serviceDefinition/update.ts` | `text/plain; charset=utf-8` | Service definition code |
| 13 | **Metadata Extension** | `src/core/metadataExtension/update.ts` | `text/plain; charset=utf-8` | Metadata extension code |
| 14 | **Behavior Definition** | `src/core/behaviorDefinition/update.ts` | `text/plain; charset=utf-8` | Behavior definition code |
| 15 | **Behavior Implementation** | `src/core/behaviorImplementation/update.ts` | `text/plain; charset=utf-8` | ABAP implementation code |

**Total: 15 objects with text/plain**

### 🗂️ XML Metadata Objects

Objects that send **XML metadata**:

| # | Object Type | File | Content-Type | Data Type |
|---|------------|------|--------------|-----------|
| 1 | **Domain** | `src/core/domain/update.ts` | `application/vnd.sap.adt.domains.v2+xml; charset=utf-8` | Domain XML metadata |
| 2 | **Data Element** | `src/core/dataElement/update.ts` | `application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8` | Data element XML metadata |
| 3 | **Package** | `src/core/package/update.ts` | `application/vnd.sap.adt.packages.v2+xml` | Package XML metadata |
| 4 | **Function Group** (metadata only) | `src/core/functionGroup/update.ts` | `application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8` | Function group XML metadata |

**Total: 4 objects with XML**

## Check Content Format Mapping

### Objects with TEXT/PLAIN (15 total)

For these objects, **check** passes:
- `chkrun:contentType="text/plain; charset=utf-8"`
- `chkrun:content` = Base64(source code)
- URI: `{objectUri}/source/main` or `{objectUri}/includes/{type}`

**Check status:** ✅ Already implemented correctly

### Objects with XML (4 total)

For these objects, **check** should pass:

#### ✅ Domain
- **Check:** `contentType="application/vnd.sap.adt.domains.v2+xml; charset=utf-8"`
- **Update:** `Content-Type: application/vnd.sap.adt.domains.v2+xml; charset=utf-8`
- **Status:** ✅ FIXED (`src/core/domain/check.ts`, `src/core/domain/DomainBuilder.ts`)

#### ✅ Data Element  
- **Check:** `contentType="application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8"`
- **Update:** `Content-Type: application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8`
- **Status:** ✅ FIXED (`src/core/dataElement/check.ts`)

#### ✅ Package
- **Check:** `contentType="application/vnd.sap.adt.packages.v2+xml"`
- **Update:** `Content-Type: application/vnd.sap.adt.packages.v2+xml`
- **Status:** ✅ FIXED (`src/core/package/check.ts`, `src/core/package/update.ts`)
- **Note:** `updatePackageDescription()` now accepts `superPackage` parameter for proper XML generation

#### ⚠️ Function Group (metadata only)
- **Check:** Currently uses `runCheckRun` without content (checks saved metadata)
- **Update:** `Content-Type: application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8`
- **Note:** Function Group is a container for Function Modules. Only metadata (description) is updated, not source code
- **Status:** ⚠️ NEEDS UPDATE - add `xmlContent` parameter for metadata validation before update

## Summary

| Category | Count | Check Implementation |
|----------|-------|---------------------|
| TEXT/PLAIN objects | 15 | ✅ Correct (pass source code in base64) |
| XML objects (fixed) | 3 | ✅ Fixed (Domain, DataElement, Package) |
| XML objects (needs update) | 1 | ⚠️ Function Group - needs xmlContent parameter |

## Next Steps

1. ⚠️ **Function Group** - add `xmlContent` parameter to `checkFunctionGroup()` for metadata validation
2. ⚠️ **Function Group Builder** - generate XML metadata in `check()` method
3. ✅ All other objects are already configured correctly

## Notes

- **Function Group** is a container without its own source code
- Function Group has only metadata (description, package, etc.)
- Source code is contained in **Function Modules** inside the group
- When updating Function Group, only metadata is updated via XML

## Related Files

- Check implementations: `src/core/*/check.ts`
- Update implementations: `src/core/*/update.ts`
- Builder implementations: `src/core/*/*Builder.ts`
- Documentation: `docs/development/CHECK_CONTENT_FORMAT.md`
