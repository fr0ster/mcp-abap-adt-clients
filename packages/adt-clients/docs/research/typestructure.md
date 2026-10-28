# What `typestructure` says, field by field

`POST /sap/bc/adt/repository/typestructure` (no body, `Accept:
application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.RepositoryTypeList`)
answers every workbench type a system knows, one
`SEU_ADT_OBJECT_TYPE_DESCRIPTOR` each. The answers of three releases are in
[`corpus/adt/typestructure/`](../../corpus/adt/typestructure).

What each field means is read here from the code that builds it, not guessed
from the values. Every statement says where it comes from:

- **Code** — read in the ABAP source of the handler on an ABAP cloud system
  (BTP trial, 2026-10-28): `CL_SEU_ADT_RES_REPO_TYPES`, its local class
  `lcl_wb_types`, `CL_WB_ADT_OBJTYPE_ACCESSIBILTY`,
  `CL_ADT_URI_MAPPING_FALLBACK`, `CL_ADT_RES_VIT_URI_MAPPER`, the content
  handlers `CL_ADT_REST_COMP_CNT_HANDLER` and `CL_ADT_REST_ASXML_HANDLER`,
  the program run `CL_SEDI_ADT_PROGRAMRUN`, and the REST authorization BAdI
  `IF_ADT_REST_AUTHORIZATION` with its fallback
  `CL_ADT_REST_AUTHORIZATION_DEVL`; and the where-used lists of the types and
  the authorization object named below.
- **Measured** — an answer recorded on a live system the same day.
- **Inference** — not yet confirmed by either.

## The handler

**Code.** `CL_SEU_ADT_RES_REPO_TYPES` (a `CL_ADT_REST_RESOURCE`) answers the
`POST`: `lcl_wb_types->get_wb_types( ignore_inconsistent_types = abap_true )`
walks the workbench registry's object types (`cl_wb_registry`), skips a type
whose tool is hidden or has errors, and skips a type whose URI template
cannot be built or that has no category. The descriptor
(`SEU_ADT_OBJECT_TYPE_DESCRIPTOR`) has `OBJECT_TYPE`, `OBJECT_TYPE_LABEL`,
`OBJECT_TYPE_LABEL_PLURAL`, `CATEGORY`, `CATEGORY_LABEL`, `URI_TEMPLATE`,
`PARENT_OBJECT_TYPE`, `OBJNAME_MAXLENGTH`, `CAPABILITIES`,
`USER_AUTHORIZATIONS` and `SCOPES`.

## How the answer is formed

- **The request (Code).** No body and no parameter is read. The `Accept`
  header must name `application/vnd.sap.as+xml`; its parameters, the
  `dataname` included, are ignored ("ASXML is deprecated, ignore the
  parameters"). Without an `Accept` the answer is `400`
  (`acceptHeaderMissing`); with one naming another type, `406`
  (`SADT_RESOURCE/044`).
- **The data (Code).** The registry is read with
  `cl_wb_registry=>get_instance( p_aie = abap_true p_langu = 'E' )`, so the
  labels are, it seems, English whatever the logon language (Inference: not
  measured in another language). One loop over its types builds the
  descriptors; the made-up `FUGR/I` is appended and the list sorted by code.
  Only `USER_AUTHORIZATIONS` depends on who asks; everything else is the same
  for every user of the system.
- **The serialisation (Code).** The answer is the ABAP table
  `SEU_ADT_REPOSITORY_TYPE_LIST` written by `CALL TRANSFORMATION sadt_id`,
  with `Content-Type: application/vnd.sap.as+xml; charset=utf-8;
  dataname=<the DDIC type's data name>`. That `sadt_id` is an identity asXML
  transformation is an Inference from its name and from the answer, whose
  tags (`DATA`, `SEU_ADT_OBJECT_TYPE_DESCRIPTOR`, `SEU_ACTION`) are the
  structure's field names; there is no ADT schema and no version in it. The
  7.40 answer in the corpus has no `OBJECT_TYPE_LABEL_PLURAL`,
  `USER_AUTHORIZATIONS` or `SCOPES` (Measured); that its structure lacks the
  fields is an Inference.
- **So a reader** reads the fields by name and takes a missing one as a field
  that release lacks, not as an error; and `Accept:
  application/vnd.sap.as+xml` is all the request needs.

## Who reads it

**Measured (where-used, direct references, ABAP cloud).** The only direct use
of `SEU_ADT_OBJECT_TYPE_DESCRIPTOR` is the table type the answer is built
from, and the only direct use of `SEU_ADT_REPOSITORY_CAP_LIST` is the two
fields `CAPABILITIES` and `USER_AUTHORIZATIONS` of that structure; indirect
references were not searched. The structure's own label (Code) says whom it
serves: "Type descriptor for ADT project explorer type list". That the
client's project explorer is its reader, and that no handler grants or
refuses anything by these fields, is an Inference from that and from the
handlers read here, each of which checks for itself.

## The fields

| Field | What fills it (Code) |
|---|---|
| `OBJECT_TYPE` | The global type `<transport type>/<workbench subtype>`, e.g. `PROG/P`. |
| `OBJECT_TYPE_LABEL`, `_PLURAL`, `OBJNAME_MAXLENGTH` | The registry entry's singular and plural names and name length. |
| `CATEGORY`, `CATEGORY_LABEL` | `cl_adt_type_group_util=>get_group`; a type without one is left out. |
| `URI_TEMPLATE` | Built for a create request with a placeholder name, by the **VIT** URI mapper: it is always a `/sap/bc/adt/vit/wb/object_type/<type>/object_name/{name}` template, whether or not the type has an ADT resource of its own. |
| `PARENT_OBJECT_TYPE` | Hard-coded ("HACK: the only known relevant subtype so far"): `FF` → `FUGR/F`, and Web Dynpro's `WQ`, `WZ`, `WW`, `YG` → `WDYN/YC`, `YA` → `WDYA/YY`, `YW` → `WDYN/YD`; and `FUGR/I`, copied from `FUGR/FF`, keeps `FUGR/F`. Every other type has none. |
| `CAPABILITIES` | Operations the **type** offers, the same for every user: `EXECUTE` for the subtypes `FF`, `P` and `OC`; `PROFILE` for `PROG/P`, `TRAN/T`, `FUGR/FF`, `CLAS/OC` and `WDYA/YY`; `CREATE` when ADT can create the type — a hard-coded list of workbench types, the function module, or the type's own workbench actions holding create; then a hard-coded exclusion list removes it, `DU`, `DV` and `DUP` lose it where the system has no NHI support, and a transport type on a hard-coded global list, or an `MO*` transport type with no subtype, gets it whatever came before; `INDEX_UPD` for `PROG`, `FUGR`, `CLAS/OC`, `INTF/OI`, `TYPE` with the type-pool subtype and `BDEF/BDO`; `KTD_DOCU` when the type has a documentation access object. Nothing else — reads, locks, updates and deletes are not in the vocabulary. |
| `USER_AUTHORIZATIONS` | `CREATE` when this **user on this system** may create the type: `CL_WB_ADT_OBJTYPE_ACCESSIBILTY` asks the BAdI `BADI_ADT_REST_SUBTYPE_ACCESS` whether the type is accessible on the system, **and** runs `AUTHORITY-CHECK OBJECT 'S_DEVELOP'` with the type's transport type as `OBJTYPE` and activity `01` (create) — `02` (change) when the transport type derived from it differs, as a `LIMU` sub-object's does; the handler passes the transport type alone, without the subtype. It is computed per transport type and cached, so every subtype of one transport type shares it. |
| `SCOPES` | The registry's scopes for the type (`INFOSYSTEM`, `WB_EDITORTOOL`, `ADT_CHECKABLE`, …). |

**`FUGR/I` is a made-up entry (Code).** After the loop, the handler copies the
`FUGR/FF` entry as `FUGR/I`, replaces `/fugrff/` by `/fugri/` in its template,
and takes `CAPABILITIES`, `USER_AUTHORIZATIONS` and `SCOPES` from `PROG/I`. So
on ABAP cloud `FUGR/I` shows no `CREATE` authorization — `PROG/I`'s — while a
function include is created in its group (`200`, Measured): the authorization
that holds is the group's (`FUGR`).

## What the measurements show

- **`USER_AUTHORIZATIONS` without `CREATE` is a refusal (Measured).** On ABAP
  cloud `PROG/P`, `PROG/I` and `FTG2/FT` have none, and their creates answer
  `403` (`S_DEVELOP` for the program and the include, "No authorization to
  access the resource" for the feature toggle).
- **With `CREATE` it is not a promise (Measured).** An S/4HANA 2025 system
  lists `CREATE` for `FTG2/FT` and refuses the create: "It is not allowed to
  create/update feature toggles in this system" (`FTG2/035`) — a setting of
  that system, checked after the authorization.
- **The template is not the object's address (Code, Measured).**
  `GET /sap/bc/adt/vit/urimapper?uri=<template with a name>`
  (`CL_ADT_RES_VIT_URI_MAPPER`) reads the VIT address into a workbench request
  and hands it to the general URI mapper. For a type with an
  `adt_resource_uri_path` in the registry that is neither hidden nor
  filtered, `CL_ADT_URI_MAPPING_FALLBACK` first asks the type's own mapper
  (`cl_blue_adt_uri_mapper=>map_wb_request`) and answers what it gives; only
  where that has nothing does it build the address itself — that path plus
  the name, or, for a type without one, the VIT address again. On ABAP cloud `PROG/P` maps to `/sap/bc/adt/programs/programs/…`,
  and `WEBI/3I` to its own VIT address: it has no ADT resource, and `GET` on
  the VIT address answers only the object's basic properties
  (`application/vnd.sap.adt.basic.object.properties+xml`).

## Running, and what ADT checks

- **`EXECUTE` is not what ADT runs (Measured).**
  `GET /sap/bc/adt/repository/informationsystem/executableobjecttypes` lists
  eleven types on ABAP cloud — `CLAS/OC`, `DDLS/DF`, `FUGR/FF`, `PROG/P`,
  `SRVB/SVB`, `TABL/DT`, `TRAN/T`, `VIEW/DV`, `WAPA/WO`, `WDCA/YA`,
  `WDYA/YY` — while `typestructure` gives `EXECUTE` to three (`FF`, `P`,
  `OC`, hard-coded).
- **Running a program (Code, Measured).** `POST
  /sap/bc/adt/programs/programrun/{programname}` (`CL_SEDI_ADT_PROGRAMRUN`)
  checks `S_DEVELOP` with `OBJTYPE PROG`, the program's name and activity
  `16` (execute) before it `SUBMIT`s the program; refused, it writes the text
  of message `OO/755` as the body (Code), and the answer is `200` with "You
  are not authorized to execute this object" (Measured on a delivered program,
  2026-10-28). That `SUBMIT` adds no check of its own and the program checks
  what it checks inside, and that through SAP GUI a user runs a report
  without `S_DEVELOP`, is SAP's general behaviour, not measured here; through
  ADT the developer authorization is asked first (Code). `S_DEVELOP`'s activities are separate —
  `01` create, `02` change, `03` display, `16` execute — so a user may run and
  read without creating; `typestructure` shows `01` alone.
- **Every ADT endpoint (Code).** The fallback of the REST authorization BAdI
  (`BADI_ADT_REST_AUTHORIZATION`, `IF_ADT_REST_AUTHORIZATION~CHECK_AUTHORITY(
  uri_string )`, customer-customisable by URI) is empty; its comment states
  that `S_ADT_RES` "is always checked by the ADT endpoints independently" of
  it, that through RFC `S_RFC` (`SADT_REST_AUTHORIZATION`) is checked too, and
  that individual development functions carry their own `S_DEVELOP` checks. In
  the where-used list of `S_ADT_RES` (Measured) its references are roles and
  IAM apps granting it, and the package interfaces `SADT_CORE_PRIVATE`,
  `SADT_MAIN_PRIVATE` and `SADT_REST_PRIVATE`; that the check sits in the ADT
  REST framework behind those packages is an Inference — where exactly is not
  read.
- **So the layers of a run through ADT are:** the ICF service and
  `S_ADT_RES` (with `S_RFC` over RFC), the customer's BAdI by URI if one is
  implemented, the handler's own check (`S_DEVELOP 16` for a program run),
  and the program's own checks. A refusal of the handler's check is a `200`
  whose body is the message — a reading has to look at the body.

## Open

- **Discovery's `app:accept` (Inference).** `CL_WB_ADT_OBJTYPE_ACCESSIBILTY`
  also implements `IF_ADT_REST_RES_ACCESSIBILITY~GET_OPTIONS`
  (`is_available`, `supports_creation` for a category). That discovery uses it
  to list a collection and to give it an `app:accept` would explain the ABAP
  cloud program and include collections having none; the discovery code is not
  read yet.
