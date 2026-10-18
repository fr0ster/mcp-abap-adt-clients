# Migrating to 36.0.0

36.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^20.0.0` and implements what
its 19.0.0 and 20.0.0 changed: **a request's `Accept` and `Content-Type` are the
caller's** (19.0.0), and `IAdtClientOptions` has no `enableAcceptCorrection`
any more (20.0.0), the option this release removes with accept negotiation.

## What changed

32 members — the ones whose request sets both headers — take them as
`options.headers: IAdtHeaders` (`{ accept, contentType }`, both required).
Each implementation sends exactly that pair: it keeps no type of its own for
that request, and nothing is merged in, defaulted or replaced. Because the field
is required, so are the options, and a positional parameter before them that was
optional is now `T | undefined`.

| contract | members |
|---|---|
| `IAdtAbapGitClient` (`AdtAbapGitClient`) | `link`, `pull`, `checkExternalRepo` |
| `IAdtCreatable` | `create` |
| `IAdtUpdatable` | `update` |
| `IAdtMetadataUpdatable` | `updateMetadata` |
| `IAdtDeletable` | `delete`, `checkDeletion` |
| `IAdtCheckable` | `check` |
| `IAdtActivatable` | `activate` |
| `IFeatureToggleObject` | `checkState` |
| `IAdtTransportObjectActions` | `removeObject`, `addObject`, `createTask`, `changeTaskType` |
| `IAdtTransportMoveObjects` | `moveObjects` |
| `IAdtWhereUsed` | `getWhereUsed`, `getWhereUsedScope` |
| `IAdtVirtualFolders` | `getVirtualFoldersContents` |
| `IAdtRepositoryStructure` | `fetchNodeStructure` |
| `IAdtGroupLifecycle` | `activateObjectsGroup`, `checkDeletionGroup`, `deleteObjectsGroup` |
| `IAdtDataPreview` | `getSqlQuery`, `getTableContents` |
| `ITraceScheduling` (class and program executors) | `scheduleTrace` |
| `IAbapDebugger` | `setBreakpoints`, `getChildVariables`, `getVariables`, `syncBreakpoints`, `setDebuggerSettings` |
| `IAmdpDebugger` | `getDataPreview` |

Every other member is unchanged; a read still takes an optional `accept`.

## What a caller does

Pass the pair in the options of every call to those members:

```diff
- await cls.create({ className, packageName, description });
+ await cls.create(
+   { className, packageName, description },
+   {
+     headers: {
+       accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
+       contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
+     },
+   },
+ );
- await cls.check({ className });
+ await cls.check({ className }, undefined, { headers: CHECK_RUN });
- await utils.deleteObjectsGroup(objects);
+ await utils.deleteObjectsGroup(objects, undefined, { headers: DELETION });
```

Pass `undefined` for the positional parameter that was optional:
`check(config, status, options)`, `checkState(config, opts, options)`,
`activateObjectsGroup(objects, preauditRequested, options)` and
`deleteObjectsGroup(objects, transportRequest, options)`.

To send what 35.0.0 sent, pass the pair from the table below. A few things
changed on the wire whatever you pass:

- **Members that sent one header send both.** `create` of a function group, a
  message class and a message class message, `update` of a feature toggle and
  a message class message, `updateMetadata` of a message class, and `delete`
  of a metadata extension and a transport request each sent only one of the
  two; they send the whole pair now. The table shows *(none)* where 35.0.0
  sent nothing; [the completed pairs, measured](#the-completed-pairs-measured)
  lists what SAP accepted.
- **Requests that sent neither send both too:** a transport request's
  `checkDeletion` (a `GET` on the request), and the legacy client's direct
  `DELETE` of a class, interface, program, DDL source, function group and
  function module.
- **A message class message's write is a chain** (read, message lock, class
  lock, the `PUT`, unlocks): the pair is the `PUT`'s. The chain's own requests
  keep their types.
- **The client options no longer choose these types.** `contentTypes` (and
  with it `unicode`) used to pick the `create` type of a class, program,
  include and function group, the function group's `updateMetadata` type and
  the source `Content-Type` of an update. Those requests send your pair now.
  Both options stay for what they still decide: the artifact type inside a
  check-run document (`check`, and `validate` through the check run — on a
  non-Unicode system `text/plain` rather than `text/plain; charset=utf-8`) and
  a class's `readMetadata` `Accept`. `AdtContentTypesBase` and
  `AdtContentTypesModern` still answer pairs (`classCreate()`,
  `programCreate()`, `functionGroupUpdate()`, …) you can pass as `headers`.
- **abapGit's options are gone.** `contentTypeVersion` picked the `link` /
  `pull` type; `AdtAbapGitClient` is now `new AdtAbapGitClient(connection,
  logger?, results?)` — pass the result set third, where it was fourth.
- **An enhancement's `create` and `updateMetadata`** chose the type from the
  subtype: `enhsxsb` `application/vnd.sap.adt.enh.enhs.v2+xml`, `enhoxhb`
  `application/vnd.sap.adt.enh.enhoxhb.v4+xml`, `enhoxhh`
  `application/vnd.sap.adt.enh.enhoxhh.v3+xml` (both headers).
- **Accept negotiation is gone** (below): nothing replaces the pair, ever.

## Accept negotiation is removed

Until 35.x a client could be switched to answer a `406` (or `415`) by sending
the request again with the type SAP named, and to put that type on later
requests to the same method and URL. 36.0.0 removes it: a `406`/`415` is the
call's answer, nothing is sent again, nothing is remembered.

| removed | what to do |
|---|---|
| `enableAcceptCorrection` (on `AdtClient`, `AdtClientLegacy`, `createAdtClient`, `AdtRuntimeClient`), `setAcceptCorrectionEnabled`, `getAcceptCorrectionEnabled`, `ADT_ACCEPT_CORRECTION` | drop them; correct the request yourself (below) |
| `cachedAccept`, `rememberAccept`, `clearAcceptCache` | keep the type you chose in your own code and pass it as `headers` |
| `getBaseRequest(connection)` | `connection.makeAdtRequest(…)` — nothing wraps a connection any more |
| `exemptFromAcceptNegotiation(connection)` | drop the call: there is nothing to be exempt from |

To correct a request yourself, read what SAP named and call the member again:

```typescript
import { extractSupportedAccept } from '@mcp-abap-adt/adt-clients';

const first = await cls.check(config, undefined, { headers: CHECK_RUN });
if (!first.ok && first.getError().response?.status === 406) {
  const accepted = extractSupportedAccept(first.getError());
  if (accepted.length > 0) {
    await cls.check(config, undefined, {
      headers: { ...CHECK_RUN, accept: accepted.join(', ') },
    });
  }
}
```

`extractSupportedContentType(error)` does the same for a `415`.

## `extractSupportedAccept` reads SAP's list only

SAP's `406` (measured on an on-premise system) names the types it accepts only
in its body, as `Accepted content types: …` in the exception message — and the
list is often empty. `extractSupportedAccept(error)` now reads that list and
nothing else. Until 35.x it also read five headers and every `type/subtype` in
the body, which answered two fragments of the exception's namespace URI
(`www.sap.com/abapxml`, `types/communicationframework`) for every `406`. A
consumer that fed it a `406` carrying the types in a header gets `[]` now.
`extractSupportedContentType` (`415`) is unchanged.

## The completed pairs, measured

Measured on an on-premise system (2026-10-18), with temporary objects created
in a test package, deleted and removed from their transport afterwards. Every
request below that sent one header or none before 36.0.0 was sent with the pair
the table shows, and SAP accepted it:

| member | Accept | Content-Type | SAP answered |
|---|---|---|---|
| function group `create` | `application/vnd.sap.adt.functions.groups.v3+xml` | `application/vnd.sap.adt.functions.groups.v3+xml` | `200` |
| message class `create` | `application/xml` | `application/xml` | `201` |
| message class `updateMetadata` | `application/vnd.sap.adt.mc.messageclass+xml` | `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` | `200` |
| message class message `create` / `update` / `delete` (the `PUT`) | `application/vnd.sap.adt.mc.messageclass+xml` | `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` | `200` each |
| metadata extension `delete` | `application/xml` | `application/xml` | `200` |
| transport request `checkDeletion` (`GET`) | `application/vnd.sap.adt.transportorganizer.v1+xml` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `200` |
| transport request `delete` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `2xx` (an emptied request and task) |
| legacy direct `DELETE`: class, interface, program, DDL source, function group, function module | `application/xml` | `application/xml` | `200` each |
| feature toggle `update` | `application/vnd.sap.adt.toggle.content.v2+json` | `application/vnd.sap.adt.toggle.content.v2+json` | not measured: the system refuses to create a toggle (`403`) |

The legacy `DELETE`s were sent through `AdtClientLegacy` against that (modern)
system, which serves the same direct `DELETE`.

## The pairs 35.0.0 sent

Recorded from 35.0.0 against a stub connection. "legacy" is `AdtClientLegacy`
(`AdtContentTypesBase`, not Unicode); a row without it is `AdtClient` with no
`contentTypes` option. The class's own name is in the
[test helper](../../src/__tests__/helpers/adtHeaders.ts) that holds the same
set.

| handler | member | Accept 35.0.0 sent | Content-Type 35.0.0 sent |
|---|---|---|---|
| AbapDebugger | `getChildVariables` | `application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables` | `application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables` |
| AbapDebugger | `getVariables` | `application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables` | `application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables` |
| AbapDebugger | `setBreakpoints` | `application/xml` | `application/xml` |
| AbapDebugger | `setDebuggerSettings` | `application/xml` | `application/xml` |
| AbapDebugger | `syncBreakpoints` | `application/xml` | `application/xml` |
| AdtAbapGitClient | `checkExternalRepo` | `application/abapgit.adt.repo.info.ext.response.v2+xml` | `application/abapgit.adt.repo.info.ext.request.v2+xml` |
| AdtAbapGitClient | `link` | `application/abapgit.adt.repo.v3+xml` | `application/abapgit.adt.repo.v3+xml` |
| AdtAbapGitClient | `pull` | `application/abapgit.adt.repo.v3+xml` | `application/abapgit.adt.repo.v3+xml` |
| AmdpDebugger | `getDataPreview` | `application/xml, application/vnd.sap.adt.datapreview.table.v1+xml` | `text/plain` |
| executors (scheduleTrace) | `scheduleTrace` | `application/xml` | `application/xml` |
| getAccessControl() | `activate` | `application/xml` | `application/xml` |
| getAccessControl() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getAccessControl() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getAccessControl() | `create` | `application/vnd.sap.adt.dclSource+xml` | `application/vnd.sap.adt.dclSource+xml` |
| getAccessControl() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getAccessControl() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getAppendStructure() | `activate` | `application/xml` | `application/xml` |
| getAppendStructure() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getAppendStructure() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getAppendStructure() | `create` | `application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml` | `application/vnd.sap.adt.structures.v2+xml` |
| getAppendStructure() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getAppendStructure() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getAuthorizationField() | `activate` | `application/xml` | `application/xml` |
| getAuthorizationField() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getAuthorizationField() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getAuthorizationField() | `create` | `application/vnd.sap.adt.blues.v1+xml` | `application/vnd.sap.adt.blues.v1+xml` |
| getAuthorizationField() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getAuthorizationField() | `updateMetadata` | `application/vnd.sap.adt.blues.v1+xml` | `application/vnd.sap.adt.blues.v1+xml` |
| getBehaviorDefinition() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getBehaviorDefinition() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getBehaviorDefinition() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getBehaviorDefinition() | `create` | `application/vnd.sap.adt.blues.v1+xml` | `application/vnd.sap.adt.blues.v1+xml` |
| getBehaviorDefinition() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getBehaviorDefinition() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getBehaviorImplementation() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getBehaviorImplementation() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getBehaviorImplementation() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getBehaviorImplementation() | `create` | `application/vnd.sap.adt.oo.classes.v4+xml` | `application/vnd.sap.adt.oo.classes.v4+xml` |
| getBehaviorImplementation() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getBehaviorImplementation() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getClass() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getClass() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getClass() | `create` | `application/vnd.sap.adt.oo.classes.v4+xml` | `application/vnd.sap.adt.oo.classes.v4+xml` |
| getClass() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getClass() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getClass() / getLocal*() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getClassExecutor() | `scheduleTrace` | `application/xml` | `application/xml` |
| getDataElement() | `activate` | `application/xml` | `application/xml` |
| getDataElement() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getDataElement() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getDataElement() | `create` | `application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml` | `application/vnd.sap.adt.dataelements.v2+xml` |
| getDataElement() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getDataElement() | `updateMetadata` | `application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml` | `application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8` |
| getDdl() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getDdl() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getDdl() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getDdl() | `create` | `application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource+xml` | `application/vnd.sap.adt.ddlSource+xml` |
| getDdl() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getDdl() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getDomain() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getDomain() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getDomain() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getDomain() | `create` | `application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml` | `application/vnd.sap.adt.domains.v2+xml` |
| getDomain() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getDomain() | `updateMetadata` | `application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml` | `application/vnd.sap.adt.domains.v2+xml; charset=utf-8` |
| getEnhancement() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getEnhancement() | `check` | `application/vnd.sap.adt.checkrun.v1+xml` | `application/vnd.sap.adt.checkrun.v1+xml` |
| getEnhancement() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getEnhancement() | `create` | `application/vnd.sap.adt.enh.enhoxhh.v3+xml` | `application/vnd.sap.adt.enh.enhoxhh.v3+xml` |
| getEnhancement() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getEnhancement() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getEnhancement() | `updateMetadata` | `application/vnd.sap.adt.enh.enhoxhh.v3+xml` | `application/vnd.sap.adt.enh.enhoxhh.v3+xml` |
| getFeatureToggle() | `activate` | `application/xml` | `application/xml` |
| getFeatureToggle() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getFeatureToggle() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getFeatureToggle() | `checkState` | `application/vnd.sap.adt.toggle.check.result.v1+asjson` | `application/vnd.sap.adt.toggle.check.parameters.v1+asjson` |
| getFeatureToggle() | `create` | `application/vnd.sap.adt.blues.v1+xml` | `application/vnd.sap.adt.blues.v1+xml` |
| getFeatureToggle() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getFeatureToggle() | `update` | *(none)* | `application/vnd.sap.adt.toggle.content.v2+json` |
| getFeatureToggle() | `updateMetadata` | `application/vnd.sap.adt.blues.v1+xml` | `application/vnd.sap.adt.blues.v1+xml` |
| getFunctionGroup() | `activate` | `application/xml` | `application/xml` |
| getFunctionGroup() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getFunctionGroup() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getFunctionGroup() | `create` | *(none)* | `application/vnd.sap.adt.functions.groups.v3+xml` |
| getFunctionGroup() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getFunctionGroup() | `updateMetadata` | `application/vnd.sap.adt.functions.groups.v3+xml` | `application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8` |
| getFunctionInclude() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getFunctionInclude() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getFunctionInclude() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getFunctionInclude() | `create` | `application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml` | `application/vnd.sap.adt.functions.fincludes.v2+xml` |
| getFunctionInclude() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getFunctionInclude() | `update` | `text/plain` | `text/plain` |
| getFunctionInclude() | `updateMetadata` | `application/vnd.sap.adt.functions.fincludes.v2+xml, application/vnd.sap.adt.functions.fincludes+xml` | `application/vnd.sap.adt.functions.fincludes.v2+xml` |
| getFunctionModule() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getFunctionModule() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getFunctionModule() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getFunctionModule() | `create` | `application/vnd.sap.adt.functions.fmodules+xml` | `application/vnd.sap.adt.functions.fmodules+xml` |
| getFunctionModule() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getFunctionModule() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getInclude() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getInclude() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getInclude() | `create` | `application/vnd.sap.adt.programs.includes.v2+xml` | `application/vnd.sap.adt.programs.includes.v2+xml` |
| getInclude() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getInclude() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getInterface() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getInterface() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getInterface() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getInterface() | `create` | `application/vnd.sap.adt.oo.interfaces.v5+xml` | `application/vnd.sap.adt.oo.interfaces.v5+xml` |
| getInterface() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getInterface() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalDefinitions() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getLocalDefinitions() | `delete` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalDefinitions() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalMacros() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getLocalMacros() | `delete` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalMacros() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalTestClass() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getLocalTestClass() | `delete` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalTestClass() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalTypes() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getLocalTypes() | `delete` | `text/plain` | `text/plain; charset=utf-8` |
| getLocalTypes() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getMessageClass() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getMessageClass() | `create` | *(none)* | `application/xml` |
| getMessageClass() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getMessageClass() | `updateMetadata` | *(none)* | `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` |
| getMessageClassMessage() | `create` | *(none)* | `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` |
| getMessageClassMessage() | `delete` | *(none)* | `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` |
| getMessageClassMessage() | `update` | *(none)* | `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` |
| getMetadataExtension() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getMetadataExtension() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getMetadataExtension() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getMetadataExtension() | `create` | `application/vnd.sap.adt.ddic.ddlx.v1+xml` | `application/vnd.sap.adt.ddic.ddlx.v1+xml` |
| getMetadataExtension() | `delete` | `application/xml` | *(none)* |
| getMetadataExtension() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getPackage() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getPackage() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getPackage() | `create` | `application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml` | `application/vnd.sap.adt.packages.v2+xml` |
| getPackage() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getPackage() | `updateMetadata` | `application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml` | `application/vnd.sap.adt.packages.v2+xml` |
| getProgram() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getProgram() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getProgram() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getProgram() | `create` | `application/vnd.sap.adt.programs.programs.v2+xml` | `application/vnd.sap.adt.programs.programs.v2+xml` |
| getProgram() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getProgram() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getProgramExecutor() | `scheduleTrace` | `application/xml` | `application/xml` |
| getRequest() | `addObject` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `text/plain` |
| getRequest() | `changeTaskType` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `text/plain` |
| getRequest() | `checkDeletion` | *(none)* | *(none)* |
| getRequest() | `create` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `text/plain` |
| getRequest() | `createTask` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `text/plain` |
| getRequest() | `delete` | `application/vnd.sap.adt.transportorganizer.v1+xml` | *(none)* |
| getRequest() | `moveObjects` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `text/plain` |
| getRequest() | `removeObject` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `text/plain` |
| getRequest() | `updateMetadata` | `application/vnd.sap.adt.transportorganizer.v1+xml` | `application/vnd.sap.adt.transportorganizer.v1+xml` |
| getScalarFunction() | `activate` | `application/xml` | `application/xml` |
| getScalarFunction() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getScalarFunction() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getScalarFunction() | `create` | `application/vnd.sap.adt.blues.v1+xml` | `application/vnd.sap.adt.blues.v1+xml` |
| getScalarFunction() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getScalarFunction() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getScalarFunctionImplementation() | `activate` | `application/xml` | `application/xml` |
| getScalarFunctionImplementation() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getScalarFunctionImplementation() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getScalarFunctionImplementation() | `create` | `application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml` | `application/vnd.sap.adt.blues.v2+xml` |
| getScalarFunctionImplementation() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getScalarFunctionImplementation() | `update` | `application/json` | `application/json` |
| getScalarFunctionImplementation() | `updateMetadata` | `application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml` | `application/vnd.sap.adt.blues.v2+xml; charset=utf-8` |
| getServiceBinding() | `activate` | `application/xml` | `application/xml` |
| getServiceBinding() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getServiceBinding() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getServiceBinding() | `create` | `application/vnd.sap.adt.businessservices.servicebinding.v1+xml, application/vnd.sap.adt.businessservices.servicebinding.v2+xml` | `application/vnd.sap.adt.businessservices.servicebinding.v2+xml` |
| getServiceBinding() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getServiceBinding() | `update` | `application/xml, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage` | `application/xml` |
| getServiceDefinition() | `activate` | `application/xml` | `application/xml` |
| getServiceDefinition() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getServiceDefinition() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getServiceDefinition() | `create` | `application/vnd.sap.adt.ddic.srvd.v1+xml` | `application/vnd.sap.adt.ddic.srvd.v1+xml` |
| getServiceDefinition() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getServiceDefinition() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getStructure() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getStructure() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getStructure() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getStructure() | `create` | `application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml` | `application/vnd.sap.adt.structures.v2+xml` |
| getStructure() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getStructure() | `update` | `application/xml, application/json, text/plain, */*` | `text/plain; charset=utf-8` |
| getTable() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getTable() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getTable() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getTable() | `create` | `application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml` | `application/vnd.sap.adt.tables.v2+xml` |
| getTable() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getTable() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getTableType() | `activate` | `application/xml` | `application/vnd.sap.adt.activation+xml` |
| getTableType() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getTableType() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getTableType() | `create` | `application/vnd.sap.adt.tabletype.v1+xml` | `application/vnd.sap.adt.tabletype.v1+xml` |
| getTableType() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getTableType() | `updateMetadata` | `application/vnd.sap.adt.tabletype.v1+xml` | `application/vnd.sap.adt.tabletype.v1+xml` |
| getTransformation() | `activate` | `application/xml` | `application/xml` |
| getTransformation() | `check` | `application/vnd.sap.adt.checkmessages+xml` | `application/vnd.sap.adt.checkobjects+xml` |
| getTransformation() | `checkDeletion` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getTransformation() | `create` | `application/vnd.sap.adt.transformations+xml` | `application/vnd.sap.adt.transformations+xml` |
| getTransformation() | `delete` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getTransformation() | `update` | `text/plain` | `text/plain; charset=utf-8` |
| getUtils() | `activateObjectsGroup` | `application/xml` | `application/xml` |
| getUtils() | `checkDeletionGroup` | `application/vnd.sap.adt.deletion.check.response.v1+xml` | `application/vnd.sap.adt.deletion.check.request.v1+xml` |
| getUtils() | `deleteObjectsGroup` | `application/vnd.sap.adt.deletion.response.v1+xml` | `application/vnd.sap.adt.deletion.request.v1+xml` |
| getUtils() | `fetchNodeStructure` | `application/vnd.sap.as+xml;dataname=com.sap.adt.RepositoryObjectTreeContent, application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml` | `application/vnd.sap.as+xml; charset=UTF-8; dataname=null` |
| getUtils() | `getSqlQuery` | `application/xml, application/vnd.sap.adt.datapreview.table.v1+xml` | `text/plain; charset=utf-8` |
| getUtils() | `getTableContents` | `application/xml, application/vnd.sap.adt.datapreview.table.v1+xml` | `text/plain; charset=utf-8` |
| getUtils() | `getVirtualFoldersContents` | `application/vnd.sap.adt.repository.virtualfolders.result.v1+xml` | `application/vnd.sap.adt.repository.virtualfolders.request.v1+xml` |
| getUtils() | `getWhereUsed` | `application/vnd.sap.adt.repository.usagereferences.result.v1+xml` | `application/vnd.sap.adt.repository.usagereferences.request.v1+xml` |
| getUtils() | `getWhereUsedScope` | `application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml` | `application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml` |
| legacy getClass() | `create` | `application/vnd.sap.adt.oo.classes+xml` | `application/vnd.sap.adt.oo.classes+xml` |
| legacy getClass() | `delete` | *(none)* | *(none)* |
| legacy getClass() | `update` | `text/plain` | `text/plain` |
| legacy getDdl() | `delete` | *(none)* | *(none)* |
| legacy getFunctionGroup() | `create` | *(none)* | `application/vnd.sap.adt.functions.groups+xml` |
| legacy getFunctionGroup() | `delete` | *(none)* | *(none)* |
| legacy getFunctionGroup() | `updateMetadata` | `application/vnd.sap.adt.functions.groups+xml` | `application/vnd.sap.adt.functions.groups+xml; charset=utf-8` |
| legacy getFunctionModule() | `delete` | *(none)* | *(none)* |
| legacy getFunctionModule() | `update` | `text/plain` | `text/plain` |
| legacy getInterface() | `delete` | *(none)* | *(none)* |
| legacy getInterface() | `update` | `text/plain` | `text/plain` |
| legacy getLocalDefinitions() | `delete` | `text/plain` | `text/plain` |
| legacy getLocalDefinitions() | `update` | `text/plain` | `text/plain` |
| legacy getLocalMacros() | `delete` | `text/plain` | `text/plain` |
| legacy getLocalMacros() | `update` | `text/plain` | `text/plain` |
| legacy getLocalTestClass() | `delete` | `text/plain` | `text/plain` |
| legacy getLocalTestClass() | `update` | `text/plain` | `text/plain` |
| legacy getLocalTypes() | `delete` | `text/plain` | `text/plain` |
| legacy getLocalTypes() | `update` | `text/plain` | `text/plain` |
| legacy getProgram() | `create` | `application/vnd.sap.adt.programs.programs+xml` | `application/vnd.sap.adt.programs.programs+xml` |
| legacy getProgram() | `delete` | *(none)* | *(none)* |
| legacy getUtils() | `activateObjectsGroup` | `application/xml` | `application/xml` |
