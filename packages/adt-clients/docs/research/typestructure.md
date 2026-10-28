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
  `CL_ADT_URI_MAPPING_FALLBACK`, `CL_ADT_RES_VIT_URI_MAPPER`.
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

## The fields

| Field | What fills it (Code) |
|---|---|
| `OBJECT_TYPE` | The global type `<transport type>/<workbench subtype>`, e.g. `PROG/P`. |
| `OBJECT_TYPE_LABEL`, `_PLURAL`, `OBJNAME_MAXLENGTH` | The registry entry's singular and plural names and name length. |
| `CATEGORY`, `CATEGORY_LABEL` | `cl_adt_type_group_util=>get_group`; a type without one is left out. |
| `URI_TEMPLATE` | Built for a create request with a placeholder name, by the **VIT** URI mapper: it is always a `/sap/bc/adt/vit/wb/object_type/<type>/object_name/{name}` template, whether or not the type has an ADT resource of its own. |
| `PARENT_OBJECT_TYPE` | Hard-coded ("HACK: the only known relevant subtype so far"): `FF` → `FUGR/F`, and Web Dynpro's `WQ`, `WZ`, `WW`, `YG` → `WDYN/YC`, `YA` → `WDYA/YY`, `YW` → `WDYN/YD`. Every other type has none. |
| `CAPABILITIES` | Operations the **type** offers, the same for every user: `EXECUTE` for the subtypes `FF`, `P` and `OC`; `PROFILE` for `PROG/P`, `TRAN/T`, `FUGR/FF`, `CLAS/OC` and `WDYA/YY`; `CREATE` when ADT can create the type (a hard-coded list of workbench types, the function module, or the type's own workbench actions holding create, less a hard-coded exclusion list); `INDEX_UPD` for `PROG`, `FUGR`, `CLAS/OC`, `INTF/OI`, `TYPE` and `BDEF/BDO`; `KTD_DOCU` when the type has a documentation access object. Nothing else — reads, locks, updates and deletes are not in the vocabulary. |
| `USER_AUTHORIZATIONS` | `CREATE` when this **user on this system** may create the type: `CL_WB_ADT_OBJTYPE_ACCESSIBILTY` asks the BAdI `BADI_ADT_REST_SUBTYPE_ACCESS` whether the type is accessible on the system, **and** runs `AUTHORITY-CHECK OBJECT 'S_DEVELOP'` with the type's transport type as `OBJTYPE` and activity `01` (create; `02` for a `LIMU` type). It is computed per transport type and cached, so every subtype of one transport type shares it. |
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
  `GET /sap/bc/adt/vit/urimapper?uri=<template with a name>` answers the
  address: `CL_ADT_URI_MAPPING_FALLBACK` gives the type's
  `adt_resource_uri_path` from the registry plus the name when the type has
  one and is neither hidden nor filtered, and the VIT address itself
  otherwise. On ABAP cloud `PROG/P` maps to `/sap/bc/adt/programs/programs/…`,
  and `WEBI/3I` to its own VIT address: it has no ADT resource, and `GET` on
  the VIT address answers only the object's basic properties
  (`application/vnd.sap.adt.basic.object.properties+xml`).

## Open

- **Discovery's `app:accept` (Inference).** `CL_WB_ADT_OBJTYPE_ACCESSIBILTY`
  also implements `IF_ADT_REST_RES_ACCESSIBILITY~GET_OPTIONS`
  (`is_available`, `supports_creation` for a category). That discovery uses it
  to list a collection and to give it an `app:accept` would explain the ABAP
  cloud program and include collections having none; the discovery code is not
  read yet.
