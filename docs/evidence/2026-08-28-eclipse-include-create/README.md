# Creating a `PROG/I` include, as Eclipse does it — E19, 2026-08-28

`eclipse-trace.txt` is the ADT trace captured from **Eclipse 4.40 / ADT 3.60**
creating include `ZOK_I_TEST_0001` in `$TMP` on E19, pasted here verbatim,
typos in its own column headers included. Supplied by the repository owner; not
produced by anything in this package.

This is the piece the write path was missing. Discovery had already shown that
`/sap/bc/adt/programs/includes` accepts
`application/vnd.sap.adt.programs.includes.v2+xml` and that only modern on-prem
offers it — see [`../2026-08-28-prog-include-write-path.md`](../2026-08-28-prog-include-write-path.md) — but not what to
send. Now the whole chain is known, request by request.

## The chain, five requests

### 1. Create

```
POST /sap/bc/adt/programs/includes
Content-Type: application/vnd.sap.adt.programs.includes.v2+xml
```

```xml
<include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="Test Include" adtcore:language="EN" adtcore:name="ZOK_I_TEST_0001" adtcore:type="PROG/I" adtcore:masterLanguage="EN" adtcore:masterSystem="E19" adtcore:responsible="OKYSLYTSIA">
  <adtcore:packageRef adtcore:name="$TMP"/>
</include:abapInclude>
```

Worth noting against the program create this package already has:

- root element `include:abapInclude`, namespace `…/adt/programs/includes`, and
  **`adtcore:type="PROG/I"`** — not `program:abapProgram` / `PROG/P`;
- **no `program:programType` and no `program:application`**. An include has
  neither, which is why routing `programType: 'include'` through the program
  builder was never going to be right;
- `adtcore:masterSystem` and `adtcore:responsible` are both sent;
- **no `Accept` header at all**, and the response is empty — headers only.

### 2. Lock

```
POST /sap/bc/adt/programs/includes/{name}?_action=LOCK&accessMode=MODIFY
Accept: application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8,
        application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9
```

Answers `LOCK_HANDLE` in the usual `asx:abap` envelope, with `IS_LOCAL=X` for a
`$TMP` object. The name in the URI is **lower case** throughout.

### 3. Write the source

```
PUT /sap/bc/adt/programs/includes/{name}/source/main?lockHandle={handle}
Content-Type: text/plain; charset=utf-8
```

Answers `ETag` and `Last-Modified`, no body.

### 4. Unlock

```
POST /sap/bc/adt/programs/includes/{name}?_action=UNLOCK&lockHandle={handle}
```

### 5. Activate

```
POST /sap/bc/adt/activation?method=activate&preauditRequested=true
Content-Type: application/xml
Accept: application/xml
```

```xml
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/programs/includes/zok_i_test_0001" adtcore:name="ZOK_I_TEST_0001"/>
</adtcore:objectReferences>
```

```xml
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties checkExecuted="true" activationExecuted="true" generationExecuted="true"/>
</chkl:messages>
```

The generic activation endpoint, with the include addressed by URI — nothing
include-specific about it.

## What this leaves open

Eclipse does **not** call `/sap/bc/adt/includes/validation` in this trace. Its
parameters were measured separately (`objname`, `objtype`, `packagename`
required, `description` optional — the same three `/programs/validation` wants),
so a client may call it; this trace simply shows Eclipse does not have to.

Nothing here needs a transport: the object went to `$TMP`, and the create URI
carries no `corrNr`. A transportable package would.
