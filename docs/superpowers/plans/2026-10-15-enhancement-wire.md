# ENHO/ENHS on the wire — measured 2026-10-15

Measured by Claude with `scripts/adt-nc.ts` against `e19-tunnel` (on premise,
BASIS 816, user's tunnel) and `trial` (ABAP Cloud). Every row is a request that
was sent and the answer that came back; nothing here is read off code. Deleted
with the plan.

## Discovery — the content type per subtype

| collection | E19 accepts | trial accepts |
|---|---|---|
| `enhoxh` | `application/vnd.sap.adt.enh.enho.v1+xml` | — (none listed) |
| `enhoxhb` | `application/vnd.sap.adt.enh.enhoxhb.v4+xml` | same |
| `enhoxhh` | `application/vnd.sap.adt.enh.enhoxhh.v3+xml` | — (none listed) |
| `enhsxs` | `application/vnd.sap.adt.enh.enhs.v1+xml` | — (none listed) |
| `enhsxsb` | `application/vnd.sap.adt.enh.enhs.v2+xml` | same |

Plus `…/validation` for each and `enhsxsb/search`. A `source` template only for
`enhoxhh`. `…/source/main/enhancements/elements` is not listed.

## Reads

| request | Accept | E19 | trial |
|---|---|---|---|
| `GET enhsxsb/{n}` | `…enh.enhs.v2+xml` | — (name was trial-only) | 200 `enhs:objectData` |
| `GET enhoxhb/{n}` | `…enh.enhoxhb.v4+xml` | 200 `enho:objectData` | 200 `enho:objectData` |
| `GET enhoxhh/{n}` | `…enh.enhoxhh.v3+xml` | 200 `enho:enhancement` | n/a |
| `GET enhoxhb/{n}` | **ours**: `…enhancements.v1+xml, application/xml` | **406** | **406** |
| any of the above | `…enhancements.v1+xml` | **406** | **406** |
| `GET enhoxhb/{n}` | none | 200, SAP's own type | — |
| `GET enhoxhh/{n}/source/main` | `text/plain` | 200 `text/plain; charset=utf-8` | n/a |
| `GET enhoxhh/{n}/source/main` | **ours**: `text/plain; charset=utf-8` | **406** | n/a |
| `GET enhoxhh/{n}/source/main` | none | 200 | n/a |
| `?version=active` / `?version=workingArea` on the source | `text/plain` | 200 both | n/a |
| `GET enhoxh/{n}` (`ZABAP_ATC_AI_ASSIST_GRID`) | `…enh.enho.v1+xml` | **500**, HTML "Application Server Error" | — |
| `GET enhsxs/{n}` (`ZENH_P`) | `…enh.enhs.v1+xml` | **500** `I::000`, type "Enhancement Spot" | — |

The 406 body carries `SADT_RESOURCE/037` and **no list of acceptable types**,
so the library's Accept negotiation has nothing to retry with.

Root namespaces: ENHS `http://www.sap.com/adt/enhancements/enhs`, ENHO
`http://www.sap.com/adt/enhancements/enho`.

`enhoxhh` metadata links `/sap/bc/adt/functions/groups/{fg}/enhancements/options?enhancementImplementation={n}`
(`application/vnd.sap.adt.enhancementoptions.v2+xml`) — not probed.

## Enhancement elements of a host (#227)

| request | E19 | trial |
|---|---|---|
| `GET /oo/classes/cl_abap_typedescr/source/main/enhancements/elements` | 200 `<enh:enhancements/>` | same |
| `GET /programs/programs/sapmv45a/…/enhancements/elements` | 200, `enh:enhancementImplementations` `ENHO/XHH`, base64 `enh:source` | n/a |
| nonexistent class | **400** `EnhancementError`, `SEEF_BASE/104` | not probed |

Content type `application/vnd.sap.adt.enhancements.v3+xml`; no Accept was sent.
Function group and include hosts: not probed yet.

## Create

`POST enhsxsb` on trial with Content-Type/Accept `…enh.enhs.v2+xml`, no corrNr:

```xml
<?xml version="1.0" encoding="UTF-8"?><enhs:objectData xmlns:enhs="http://www.sap.com/adt/enhancements/enhs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="…" adtcore:language="EN" adtcore:name="ZADT_ENHS_XSB_T1" adtcore:type="ENHS/XSB" adtcore:masterLanguage="EN"><adtcore:packageRef adtcore:name="ZADT_BLD_PKG03"/><enhs:contentCommon enhs:toolType="BADI_DEF"/><enhs:contentSpecific><enhs:badiTechnology><enhs:badiDefinitions/></enhs:badiTechnology></enhs:contentSpecific></enhs:objectData>
```

- without `enhs:contentSpecific` → 400 `ExceptionInvalidData` "System expected the element '{…/enhs}contentSpecific'";
- with it → **201**, `enhs:objectData` `version="inactive"`.
- The same POST on E19 → 400 `ExceptionParameterNotFound` "Parameter corrNr could not be found." (needs a transport; not done — the one transport E19 offered belongs to unrelated work).

**Our `create.ts` body** (`enh:enhancement` in `http://www.sap.com/adt/enhancements`,
Content-Type `…enhancements.v1+xml`) → **415** `SADT_RESOURCE/039` on trial.
Its type codes are invented too: `ENHS/EXSB`, `ENHO/EXHB`, … where SAP says
`ENHS/XSB`, `ENHO/XHB`, `ENHO/XHH`, `ENHO/XH`, `ENHS/XS`.

`POST enhoxhb` on trial (`enho:objectData`, `toolType="BADI_IMPL"`, empty
`badiImplementations`), with and without `?corrNr=TRLK900438` → 400
`ExceptionResourceCreationFailure` "No administration authorization in Change
and Transport System" (`TK620`). Not resolved: may need a spot/BAdI reference
in the body, as an existing XHB carries `enho:enhancementSpot`,
`enho:badiDefinition`, `enho:implementingClass` per implementation.

## Delete

`POST /sap/bc/adt/deletion/delete` (our `delete.ts` body, empty
`del:transportNumber`) on trial → 200 `del:deletionResult`
`del:isDeleted="true"`; the object then reads 404. **Works as it is.**

## Not measured

Lock / source write / unlock / activate (need a stateful session — through the
library's integration tests once the reads are fixed); anything on E19 that
creates (no transport); XHB create; function-group and include hosts of the
elements read.

## Left on systems

Nothing. `ZADT_ENHS_XSB_T1` (trial) created and deleted.
