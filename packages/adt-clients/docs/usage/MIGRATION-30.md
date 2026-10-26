# Migrating to 30.0.0

30.0.0 adds two members to `getRequest()` — `sortAndCompress` and `moveObjects`
— and with them two slots to `ITransportResults`. Nothing else changed: no
member answers differently.

Declare `@mcp-abap-adt/interfaces-adt` `^15.3.0` if your package imports it, so
npm installs one copy: `npm ls @mcp-abap-adt/interfaces-adt` must show one
version. `@mcp-abap-adt/adt-strategies` 0.10.2 declares the same range.

## 1. A hand-written `ITransportResults` names two more slots

Every slot of `ITransportResults` is required (since 23.0.0). A set that spreads
`transportDocuments` already has the new ones; a set written slot by slot does
not compile until it names them:

```typescript
import { rawDocument, transportDocuments } from '@mcp-abap-adt/adt-clients';

// spread: nothing to do
const spread = { ...transportDocuments, objects: myObjectReading };

// written out: add both
const written = {
  // …the slots you had…
  sortedAndCompressed: rawDocument,
  movedObjects: rawDocument,
};
```

`rawDocument` is the shipped reading for both. `sortAndCompress` was answered
`200` with an empty body, and `moveObjects` echoes the entries it was sent, so
neither answer is evidence of the change — re-read the task with `readObjects`
(measured on premise (2026-10-12), BASIS 816).

## 2. A contract holding `getRequest()` gains two atoms

`IRequestContract` now also intersects `IAdtTransportSortAndCompress` and
`IAdtTransportMoveObjects` from `@mcp-abap-adt/interfaces-adt` 15.3.0. A consumer
that implements the request contract itself adds the two members; one that only
calls it has nothing to do.
