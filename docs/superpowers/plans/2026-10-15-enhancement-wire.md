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
- The same POST on E19 without `corrNr` → 400 `ExceptionParameterNotFound`
  "Parameter corrNr could not be found."; with `?corrNr=E19K907111` into
  `ZAC_TEST_PKG` → **201**.

E19 test target, verified: `~/.config/mcp-abap-adt/test-config.e19.yaml` names
`ZAC_TEST_PKG` / `E19K907111`. The request is OKYSLYTSIA's, status D,
"adt-clients integration tests", and holds `ZAC_TEST_PKG` and
`ZAC_TEST_PKG_SRVB` themselves (`lock_status="X"`). `ZADT_BLD_PKG03` exists on
E19 too but has no transport layer — it is the trial's package, not E19's.

### ENHO/XHB — two steps, as the editor does it

A POST carrying no spot fails: trial 400 `TK620` "No administration
authorization in Change and Transport System" (with and without corrNr), E19
400 `SD/269` "No documentation class is assigned to object R3TR ENHO.". The
container must name the spot in `enho:usages` (shape taken from
vibing-steampunk `pkg/adt/enhancements_badi.go`, then verified here):

```xml
<enho:objectData xmlns:enho="http://www.sap.com/adt/enhancements/enho" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:enhcore="http://www.sap.com/abapsource/enhancementscore" adtcore:name="…" adtcore:type="ENHO/XHB" adtcore:description="…" adtcore:language="EN" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="…"/>
  <enho:contentCommon enho:toolType="BADI_IMPL">
    <enho:usages>
      <enhcore:referencedObject enhcore:element_usage="EXTO" enhcore:program_id="R3TR">
        <enhcore:objectReference adtcore:name="{SPOT}" adtcore:type="ENHS/XS"/>
        <enhcore:mainObjectReference/>
      </enhcore:referencedObject>
    </enho:usages>
  </enho:contentCommon>
  <enho:contentSpecific><enho:badiTechnology><enho:badiImplementations/></enho:badiTechnology></enho:contentSpecific>
</enho:objectData>
```

→ **201** on E19 (spot `ZDISCOUNT_CALCULATION`, corrNr) and on trial (spot
`ZDEMO_ENHANCEMENT`, no corrNr). The implementation itself (BAdI definition,
implementing class, filters) is then a lock / PUT of the full document /
unlock — not measured yet (stateful).

### ENHO/XHH — needs an enhancement option of the host

`GET {host}/enhancements/options` (Accept
`application/vnd.sap.adt.enhancementoptions.v2+xml`) lists the options, e.g.
`\PR:ZOK_REQ_REP_TEST\IC:ZOK_REQ_REP_TEST\SE:END\EI`. Body (vibing-steampunk
`pkg/adt/enhancements_create.go`, verified):

```xml
<enho:enhancement xmlns:enho="http://www.sap.com/adt/enhancements/enho" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="…" adtcore:type="ENHO/XHH" adtcore:description="…" adtcore:language="EN" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="…"/>
  <enho:contentCommon enho:toolType="HOOK_IMPL" enho:adjustmentStatus="" enho:upgradeFlag="false"/>
  <enho:contentSpecific>
    <enho:hookTechnology enho:nextId="2">
      <enho:enhancedObject adtcore:uri="/sap/bc/adt/programs/programs/zok_req_rep_test" adtcore:type="PROG/P" adtcore:name="ZOK_REQ_REP_TEST"/>
      <enho:hookImplementation enho:id="1" enho:spotname="" enho:programname="ZOK_REQ_REP_TEST" enho:overwrite="" enho:method="" enho:enhmode="S" enho:full_name="\PR:ZOK_REQ_REP_TEST\IC:ZOK_REQ_REP_TEST\SE:END\EI" enho:full_description=""/>
    </enho:hookTechnology>
  </enho:contentSpecific>
</enho:enhancement>
```

- `enho:enhmode="static"` → 400 "An error occurred when deserializing in the
  simple transformation program ST_ENH_ADT_ENHO_HOOK_IMPL" at
  `hookImplementation`; the mode is a code (`S`, `D` — an existing plugin
  carries `D`). With `S` → **201** on E19.
- The new plugin's source reads at once (`?version=inactive`, `text/plain`):
  `ENHANCEMENT 1  .` / `*` / `ENDENHANCEMENT.`
- The host's `…/source/main/enhancements/elements` lists it immediately,
  `version="inactive"` — the #227 listing and ENHO/XHH are the same objects.
- Trial: `POST enhoxhh` → **403** `ExceptionResourceNoAuthorization` "No
  authorization to access the resource /sap/bc/adt/enhancements/enhoxhh."

**Our `create.ts` body** (`enh:enhancement` in `http://www.sap.com/adt/enhancements`,
Content-Type `…enhancements.v1+xml`) → **415** `SADT_RESOURCE/039` on trial.
Its type codes are invented too: `ENHS/EXSB`, `ENHO/EXHB`, … where SAP says
`ENHS/XSB`, `ENHO/XHB`, `ENHO/XHH`, `ENHO/XH`, `ENHS/XS`.

## Delete

`POST /sap/bc/adt/deletion/delete` (our `delete.ts` body;
`del:transportNumber` empty on trial, `E19K907111` on E19) → 200
`del:deletionResult` `del:isDeleted="true"` for XSB, XHB and XHH on both
systems; each then reads 404. **Works as it is.**

## Not measured

Lock / source write / unlock / activate (stateful — through the library's
integration tests once the wire is fixed); the BAdI implementation PUT into an
XHB container; function-group and include hosts of the elements read.

## Left on systems

Nothing. Created and deleted: `ZADT_ENHS_XSB_T1` (both), `ZADT_ENHO_XHB_T1`
(both), `ZADT_ENHO_XHH_T1` (E19).
