# Update Content Types Reference

**Since 36.0.0 these files hold no content type.** `update` and
`updateMetadata` send the `options.headers` their caller passes (interfaces-adt
19.0.0) and choose none of their own. The tables below record what each one
sent until 35.0.0 — the pair a caller wanting the old behaviour passes; the
test helper `src/__tests__/helpers/adtHeaders.ts` holds the full set.

## text/plain (source code)

| Object Type | File | Content-Type |
|---|---|---|
| Class (main) | `src/core/class/update.ts` | `text/plain; charset=utf-8` |
| Class includes | `src/core/class/includes.ts` | `text/plain; charset=utf-8` |
| Interface | `src/core/interface/update.ts` | `text/plain; charset=utf-8` |
| Program | `src/core/program/update.ts` | `text/plain; charset=utf-8` |
| Function Module | `src/core/functionModule/update.ts` | `text/plain; charset=utf-8` |
| Table (DDL) | `src/core/table/update.ts` | `text/plain; charset=utf-8` |
| Structure (DDL) | `src/core/structure/update.ts` | `text/plain; charset=utf-8` |
| DDL Source (DDLS) | `src/core/ddl/update.ts` | `text/plain; charset=utf-8` |
| Service Definition | `src/core/serviceDefinition/update.ts` | `text/plain; charset=utf-8` |
| Metadata Extension | `src/core/metadataExtension/update.ts` | `text/plain; charset=utf-8` |
| Behavior Definition | `src/core/behaviorDefinition/update.ts` | `text/plain; charset=utf-8` |
| Behavior Implementation | `src/core/behaviorImplementation/update.ts` | `text/plain; charset=utf-8` |

## XML metadata

| Object Type | File | Content-Type |
|---|---|---|
| Domain | `src/core/domain/update.ts` | `application/vnd.sap.adt.domains.v2+xml; charset=utf-8` |
| Data Element | `src/core/dataElement/update.ts` | `application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8` |
| Package | `src/core/package/update.ts` | `application/vnd.sap.adt.packages.v2+xml` |
| Function Group | `src/core/functionGroup/update.ts` | `application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8` |

## Notes

- Check endpoints should use matching content types when validating updates
  (the check run's `Content-Type` is the caller's too since 36.0.0; the
  artifact's content type inside the check-run document is still the client's
  `contentTypes` / `unicode` setting).
- Function Group updates only metadata (no source code).
