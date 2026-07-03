# Message Class (MSAG) CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRUD for ABAP message classes (`MSAG/N`) and their individual messages as two `IAdtObject` implementations (`AdtMessageClass`, `AdtMessageClassMessage`).

**Architecture:** `@mcp-abap-adt/interfaces` gains param types (minor). `@mcp-abap-adt/adt-clients` adds a `core/messageClass` module: a shared round-trip-preserving XML helper, a class object (POST create / GET read / lock+PUT update / lock+DELETE), and a message object that is read-modify-write over the class (messages have no independent write endpoint). Non-applicable ops throw `UNSUPPORTED_OPERATION`.

**Tech Stack:** TypeScript (strict, CommonJS), Jest (ts-jest; unit SAP-free, integration trial-gated), Biome, `fast-xml-parser`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-message-class-design.md`. Read it first.
- Repo paths: interfaces = `/home/okyslytsia/prj/mcp-abap-adt-interfaces`, adt-clients = `/home/okyslytsia/prj/mcp-abap-adt-clients`.
- English; Biome (single quotes, semicolons, 2-space). Run `npx biome check --write` on touched files.
- Never bump `package.json` version without explicit user request; after a bump run `npm install --package-lock-only`, verify no `"link": true` / `file:`/`.tgz` for interfaces. Registry-only.
- **Publish-first:** interfaces change is merged + published to npm by the user BEFORE adt-clients bumps its dep. Consumer work is blocked until `npm view @mcp-abap-adt/interfaces version` shows the new minor.
- Endpoint base: `/sap/bc/adt/messageclass`. Object type `MSAG/N`. Names lowercased in URLs (`encodeSapObjectName`).
- Message content lives in the CLASS XML; `GET /messages/{no}` is an empty template (do not use it for content). Message-level `DELETE /messages/{no}` returns 423 (do not use).
- Round-trip preserving: both `IParsedMessageClass` and `IParsedMessage` carry `rawAttrs` so any class-level or message-level attribute (named or future) round-trips verbatim through the full-class PUT.
- Non-applicable ops throw `AdtOperationError` with `code = AdtObjectErrorCodes.UNSUPPORTED_OPERATION`.
- corrNr: Phases 4–5 implement the **local/no-transport path only** (probe-verified). `transport_request` is parsed into config but stays UNUSED until **Task 6.2**, which probe-verifies the exact `corrNr` placement on a transportable package and then wires it. Do not add `corrNr` before Task 6.2.
- Verification baseline per adt-clients task: `npm run build` clean + `SAP_URL= npx jest src/__tests__/unit` green.

---

## File Structure

- `interfaces/src/adt/IAdtMessageClass.ts` — **new**: `ICreate/Read/Update/DeleteMessageClassParams` + message equivalents.
- `interfaces/src/index.ts` — export the new module.
- `adt-clients/src/core/shared/unsupported.ts` — **new**: generic `throwUnsupportedOperation(operation, detail?)`.
- `adt-clients/src/core/messageClass/xml.ts` — **new**: `parseMessageClass` / `buildMessageClassXml` + `IParsedMessageClass`/`IParsedMessage`.
- `adt-clients/src/core/messageClass/types.ts` — **new**: `IMessageClassConfig/State`, `IMessageClassMessageConfig/State`.
- `adt-clients/src/core/messageClass/lock.ts` — **new**: class LOCK + message LOCK_MSG.
- `adt-clients/src/core/messageClass/unlock.ts` — **new**: class UNLOCK + UNLOCK_ALL.
- `adt-clients/src/core/messageClass/create.ts`, `read.ts`, `update.ts`, `delete.ts` — **new**: low-level ops.
- `adt-clients/src/core/messageClass/AdtMessageClass.ts`, `AdtMessageClassMessage.ts` — **new**: the two `IAdtObject` classes.
- `adt-clients/src/core/messageClass/index.ts` — **new**: re-exports.
- `adt-clients/src/clients/AdtClient.ts` — add `getMessageClass()` / `getMessageClassMessage()`.
- `adt-clients/src/index.core.ts` — export the config/state types.
- Tests under `adt-clients/src/__tests__/unit/messageClass*.test.ts` + `integration/core/messageClass/`.

---

## Phase 1 — interfaces param types (minor)

### Task 1.1: Add message-class param types

**Files:**
- Create: `interfaces/src/adt/IAdtMessageClass.ts`
- Modify: `interfaces/src/index.ts`

**Interfaces:** Produces the low-level param types consumers may reference.

- [ ] **Step 1: Create the param types**

```ts
// interfaces/src/adt/IAdtMessageClass.ts
export interface ICreateMessageClassParams {
  name: string;
  description?: string;
  package_name?: string;
  master_language?: string;
  transport_request?: string;
}
export interface IReadMessageClassParams {
  name: string;
}
export interface IUpdateMessageClassParams {
  name: string;
  description?: string;
  transport_request?: string;
}
export interface IDeleteMessageClassParams {
  name: string;
  transport_request?: string;
}
export interface ICreateMessageClassMessageParams {
  class_name: string;
  msgno: string;
  msgtext: string;
  self_explanatory?: boolean;
  description?: string;
  transport_request?: string;
}
export interface IUpdateMessageClassMessageParams {
  class_name: string;
  msgno: string;
  msgtext?: string;         // optional: update may change only description or self_explanatory
  self_explanatory?: boolean;
  description?: string;
  transport_request?: string;
}
export interface IDeleteMessageClassMessageParams {
  class_name: string;
  msgno: string;
  transport_request?: string;
}
```

- [ ] **Step 2: Export from the barrel**

In `interfaces/src/index.ts`, in the adt-domain group, add:
```ts
export type {
  ICreateMessageClassParams,
  IReadMessageClassParams,
  IUpdateMessageClassParams,
  IDeleteMessageClassParams,
  ICreateMessageClassMessageParams,
  IUpdateMessageClassMessageParams,
  IDeleteMessageClassMessageParams,
} from './adt/IAdtMessageClass';
```

- [ ] **Step 3: Build interfaces**

Run: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run build`
Expected: clean.

- [ ] **Step 4: Commit (interfaces)**

```bash
git add src/adt/IAdtMessageClass.ts src/index.ts
git commit -m "feat: message class param types (create/read/update/delete + message)"
```

> **Release gate:** the user bumps the interfaces MINOR, merges, and publishes to npm. Do NOT start Phase 2 until `npm view @mcp-abap-adt/interfaces version` shows the new minor.

---

## Phase 2 — adt-clients dep bump

### Task 2.1: Bump to the published interfaces minor

- [ ] **Step 1:** Confirm published: `npm view @mcp-abap-adt/interfaces version` shows the new minor (e.g. `9.2.0`).
- [ ] **Step 2:** Set that `^X.Y.0` in `adt-clients/package.json`, then `npm install`; verify: `grep -nE 'file:|\.tgz' package-lock.json | grep -i interfaces || echo none` (empty) and `grep -c '"link": true' package-lock.json` (0).
- [ ] **Step 3:** `npm run build` clean.
- [ ] **Step 4:** `git add package.json package-lock.json && git commit -m "build(deps): bump @mcp-abap-adt/interfaces for message class params"`

---

## Phase 3 — shared helpers (adt-clients)

### Task 3.1: `throwUnsupportedOperation`

**Files:**
- Create: `adt-clients/src/core/shared/unsupported.ts`
- Test: `adt-clients/src/__tests__/unit/unsupportedOperation.test.ts`

**Interfaces:** Produces `throwUnsupportedOperation(operation: string, detail?: string): never`.

- [ ] **Step 1: Failing test**

```ts
// adt-clients/src/__tests__/unit/unsupportedOperation.test.ts
import { throwUnsupportedOperation } from '../../core/shared/unsupported';

describe('throwUnsupportedOperation', () => {
  it('throws AdtOperationError with UNSUPPORTED_OPERATION', () => {
    expect.assertions(2);
    try {
      throwUnsupportedOperation('activate', 'message class ZT');
    } catch (e: any) {
      expect(e.code).toBe('ADT_UNSUPPORTED_OPERATION');
      expect(String(e.message)).toContain('activate');
    }
  });
});
```

- [ ] **Step 2:** `SAP_URL= npx jest src/__tests__/unit/unsupportedOperation.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement**

```ts
// adt-clients/src/core/shared/unsupported.ts
import {
  AdtObjectErrorCodes,
  AdtOperationError,
} from '@mcp-abap-adt/interfaces';

/** Throw a typed "operation not supported for this object type" error. */
export function throwUnsupportedOperation(
  operation: string,
  detail?: string,
): never {
  const e = new AdtOperationError(
    `Operation "${operation}" is not supported${detail ? ` for ${detail}` : ''}`,
  );
  e.code = AdtObjectErrorCodes.UNSUPPORTED_OPERATION;
  throw e;
}
```

- [ ] **Step 4:** `SAP_URL= npx jest src/__tests__/unit/unsupportedOperation.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(shared): throwUnsupportedOperation helper`.

### Task 3.2: message-class XML helper (round-trip preserving)

**Files:**
- Create: `adt-clients/src/core/messageClass/xml.ts`
- Test: `adt-clients/src/__tests__/unit/messageClassXml.test.ts`

**Interfaces:**
- Produces: `IParsedMessage`, `IParsedMessageClass`, `parseMessageClass(xml): IParsedMessageClass`, `buildMessageClassXml(cls, opts?): string`.

- [ ] **Step 1: Failing test** — parse a two-message class (with extra attrs), assert fields + rawAttrs, and the round-trip preservation contract.

```ts
// adt-clients/src/__tests__/unit/messageClassXml.test.ts
import {
  buildMessageClassXml,
  parseMessageClass,
} from '../../core/messageClass/xml';

// class with an UNKNOWN root attr (mc:futureflag) + two messages, one carrying extra attrs
const XML = `<?xml version="1.0" encoding="utf-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N" adtcore:description="Desc" adtcore:language="DE" adtcore:masterLanguage="DE" adtcore:masterSystem="TRL" adtcore:responsible="U1" mc:futureflag="X"><adtcore:packageRef adtcore:name="ZP"/><mc:messages adtcore:name="" mc:documented="false" mc:msgno="001" mc:msgtext="T1" mc:selfexplainatory="true"/><mc:messages mc:documented="true" mc:msgno="002" mc:msgtext="T2"/></mc:messageClass>`;

describe('parseMessageClass', () => {
  it('parses named fields + rawAttrs (class and messages)', () => {
    const c = parseMessageClass(XML);
    expect(c.name).toBe('ZT');
    expect(c.description).toBe('Desc');
    expect(c.masterLanguage).toBe('DE');
    expect(c.packageName).toBe('ZP');
    expect(c.rawAttrs?.['mc:futureflag']).toBe('X');
    expect(c.messages.map((m) => m.msgno)).toEqual(['001', '002']);
    expect(c.messages[0].msgtext).toBe('T1');
    expect(c.messages[0].rawAttrs?.['mc:documented']).toBe('false');
  });
});

describe('buildMessageClassXml round-trip preservation', () => {
  it('changing one message keeps other message + class attrs verbatim', () => {
    const c = parseMessageClass(XML);
    // change ONLY msg 001 text
    c.messages[0].msgtext = 'CHANGED';
    const out = buildMessageClassXml(c, { messageLockHandles: { '001': 'LH1' } });
    const re = parseMessageClass(out);
    // class-level future attr preserved
    expect(re.rawAttrs?.['mc:futureflag']).toBe('X');
    expect(re.masterLanguage).toBe('DE');
    // target message: text changed, other attrs kept
    const m1 = re.messages.find((m) => m.msgno === '001')!;
    expect(m1.msgtext).toBe('CHANGED');
    expect(m1.rawAttrs?.['mc:documented']).toBe('false');
    // untouched message preserved
    const m2 = re.messages.find((m) => m.msgno === '002')!;
    expect(m2.msgtext).toBe('T2');
    expect(m2.rawAttrs?.['mc:documented']).toBe('true');
    // lock handle emitted on the target
    expect(out).toContain('mc:lockhandle="LH1"');
    // namespaces appear exactly once (rawAttrs must not duplicate xmlns:*)
    expect(out.match(/xmlns:mc=/g)).toHaveLength(1);
    expect(out.match(/xmlns:adtcore=/g)).toHaveLength(1);
  });

  it('omits a deleted message', () => {
    const c = parseMessageClass(XML);
    c.messages = c.messages.filter((m) => m.msgno !== '002');
    const out = buildMessageClassXml(c);
    expect(out).not.toContain('mc:msgno="002"');
    expect(out).toContain('mc:msgno="001"');
  });
});
```

- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3: Implement `xml.ts`**

```ts
import { XMLParser } from 'fast-xml-parser';

export interface IParsedMessage {
  msgno: string;
  msgtext: string;
  selfExplanatory?: boolean;
  description?: string;
  rawAttrs?: Record<string, string>;
}
export interface IParsedMessageClass {
  name: string;
  description?: string;
  language?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  packageName?: string;
  messages: IParsedMessage[];
  rawAttrs?: Record<string, string>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
});

// Collect attributes, EXCLUDING namespace declarations (xmlns:*). fast-xml-parser
// surfaces xmlns:mc / xmlns:adtcore as attributes; the builder re-emits the
// namespaces from its template, so keeping them here would duplicate them and
// produce invalid XML on round-trip.
const A = (o: Record<string, any>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o))
    if (k.startsWith('@_') && !k.startsWith('@_xmlns'))
      out[k.slice(2)] = String(v);
  return out;
};

export function parseMessageClass(xml: string): IParsedMessageClass {
  const root = parser.parse(xml) as Record<string, any>;
  const mc = root['mc:messageClass'] ?? root.messageClass ?? {};
  const attrs = A(mc);
  const pkgRef = mc['adtcore:packageRef'] ?? mc.packageRef ?? {};
  const rawMsgs = mc['mc:messages'] ?? mc.messages;
  const list = Array.isArray(rawMsgs) ? rawMsgs : rawMsgs ? [rawMsgs] : [];
  const messages: IParsedMessage[] = list.map((m: Record<string, any>) => {
    const ma = A(m);
    return {
      msgno: ma['mc:msgno'] ?? '',
      msgtext: ma['mc:msgtext'] ?? '',
      selfExplanatory: ma['mc:selfexplainatory']
        ? ma['mc:selfexplainatory'] === 'true'
        : undefined,
      description: ma['adtcore:description'] || undefined,
      rawAttrs: ma,
    };
  });
  return {
    name: attrs['adtcore:name'] ?? '',
    description: attrs['adtcore:description'] || undefined,
    language: attrs['adtcore:language'] || undefined,
    masterLanguage: attrs['adtcore:masterLanguage'] || undefined,
    masterSystem: attrs['adtcore:masterSystem'] || undefined,
    responsible: attrs['adtcore:responsible'] || undefined,
    packageName: (A(pkgRef)['adtcore:name'] as string) || undefined,
    messages,
    rawAttrs: attrs,
  };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Merge rawAttrs with named-field overrides into an attribute string. */
function attrString(
  raw: Record<string, string> | undefined,
  overrides: Record<string, string | undefined>,
): string {
  const merged: Record<string, string> = { ...(raw ?? {}) };
  for (const [k, v] of Object.entries(overrides))
    if (v !== undefined) merged[k] = v;
  return Object.entries(merged)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
}

export function buildMessageClassXml(
  cls: IParsedMessageClass,
  opts?: { messageLockHandles?: Record<string, string> },
): string {
  const locks = opts?.messageLockHandles ?? {};
  const rootAttrs = attrString(cls.rawAttrs, {
    'adtcore:name': cls.name,
    'adtcore:description': cls.description,
    'adtcore:language': cls.language,
    'adtcore:masterLanguage': cls.masterLanguage,
    'adtcore:masterSystem': cls.masterSystem,
    'adtcore:responsible': cls.responsible,
    'adtcore:type': 'MSAG/N',
  });
  const pkg = cls.packageName
    ? `<adtcore:packageRef adtcore:name="${esc(cls.packageName)}"/>`
    : '';
  const msgs = cls.messages
    .map((m) => {
      const attrs = attrString(m.rawAttrs, {
        'mc:msgno': m.msgno,
        'mc:msgtext': m.msgtext,
        'mc:selfexplainatory':
          m.selfExplanatory === undefined
            ? undefined
            : String(m.selfExplanatory),
        'adtcore:description': m.description,
        'mc:lockhandle': locks[m.msgno],
      });
      return `<mc:messages ${attrs}/>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" ${rootAttrs}>${pkg}${msgs}</mc:messageClass>`;
}
```

- [ ] **Step 4:** run → PASS (all 3). `npm run build` clean.
- [ ] **Step 5:** commit `feat(messageClass): round-trip preserving XML helper`.

---

## Phase 4 — AdtMessageClass

### Task 4.1: types + low-level ops + AdtMessageClass + wiring

**Files:**
- Create: `adt-clients/src/core/messageClass/types.ts`, `lock.ts`, `unlock.ts`, `create.ts`, `read.ts`, `update.ts`, `delete.ts`, `AdtMessageClass.ts`, `index.ts`
- Modify: `adt-clients/src/clients/AdtClient.ts`, `adt-clients/src/index.core.ts`
- Test: `adt-clients/src/__tests__/unit/messageClass.test.ts`

**Interfaces:**
- Consumes: `parseMessageClass`/`buildMessageClassXml` (Task 3.2), `throwUnsupportedOperation` (Task 3.1), `encodeSapObjectName` (`../../utils/internalUtils`), `getTimeout` (`../../utils/timeouts`), `ACCEPT_LOCK` (`../../constants/contentTypes`).
- Produces: `IMessageClassConfig`, `IMessageClassState`, `AdtMessageClass`, low-level `getMessageClassSource` etc., `AdtClient.getMessageClass()`.

- [ ] **Step 1: Failing unit test (fake connection)** — assert the create/read/update/delete URLs+methods and that unsupported ops throw.

```ts
// adt-clients/src/__tests__/unit/messageClass.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtMessageClass } from '../../core/messageClass/AdtMessageClass';
import { noopLogger } from '../../utils/noopLogger';

const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N" adtcore:description="D"><adtcore:packageRef adtcore:name="ZP"/></mc:messageClass>`;
const LOCK = `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function conn(handler: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return {
    makeAdtRequest: handler,
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('AdtMessageClass', () => {
  it('create POSTs the shell to /messageclass', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtResponse;
      }),
      noopLogger,
    );
    await mc.create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    expect(seen.url).toContain('/sap/bc/adt/messageclass');
    expect(seen.method).toBe('POST');
    expect(String(seen.data)).toContain('adtcore:type="MSAG/N"');
  });

  it('read GETs /messageclass/{name} and parses', async () => {
    const mc = new AdtMessageClass(
      conn(async () => ({ data: CLASS_XML, status: 200, headers: {} }) as IAdtResponse),
      noopLogger,
    );
    const st = await mc.read({ name: 'ZT' });
    expect(st?.messageClass?.name).toBe('ZT');
  });

  it('activate/check/getVersions throw UNSUPPORTED', async () => {
    const mc = new AdtMessageClass(conn(async () => ({}) as IAdtResponse), noopLogger);
    for (const fn of [
      () => mc.activate({ name: 'ZT' }),
      () => mc.check({ name: 'ZT' }),
      () => mc.getVersions({ name: 'ZT' }),
    ]) {
      await expect(fn()).rejects.toMatchObject({ code: 'ADT_UNSUPPORTED_OPERATION' });
    }
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Create `types.ts` (`IMessageClassConfig`/`IMessageClassState` per the spec), `lock.ts` (POST `${base}/${name}?_action=LOCK&accessMode=MODIFY`, Accept `ACCEPT_LOCK`, parse `result['asx:abap']['asx:values'].DATA.LOCK_HANDLE`; requires `connection.setSessionType('stateful')`), `unlock.ts` (POST `?_action=UNLOCK&lockHandle=`), `create.ts` (POST `/messageclass` with `buildMessageClassXml` shell, `Content-Type: application/xml`), `read.ts` (GET `${base}/${name}` Accept `application/vnd.sap.adt.mc.messageclass+xml, application/xml` → `parseMessageClass`), `update.ts` (read current → apply description → `stateful` → lock → PUT `${base}/${name}?lockHandle=${lh}` Content-Type `application/vnd.sap.adt.mc.messageclass+xml; charset=utf-8` with the FULL rebuilt XML (existing messages preserved) → unlock → `stateless`), `delete.ts` (`stateful` → lock → DELETE `${base}/${name}?lockHandle=${lh}` → `stateless`). **No `corrNr` yet — implement the local/no-transport path only (verified by probe); `transport_request` stays parsed-but-unused until Task 6.2 wires it after a transportable-package probe.** Then `AdtMessageClass.ts` implementing `IAdtObject<IMessageClassConfig, IMessageClassState>`: `validate` → GET `/sap/bc/adt/messageclass/validation?objname=${name}&description=${description}`; `create/read/update/delete/lock/unlock` delegate to the low-level ops; `activate/check/getVersions/getVersionSource` → `throwUnsupportedOperation('<op>', 'message class ' + name)`. Wrap makeAdtRequest failures + always unlock + `setSessionType('stateless')` on error (mirror `AdtDomain`/`AdtPackage` cleanup). Add `getMessageClass()` to `AdtClient`, export config/state via `index.core.ts`, re-export from `index.ts`.
- [ ] **Step 4:** run the unit test + `npm run build` → PASS/clean.
- [ ] **Step 5:** commit `feat(messageClass): AdtMessageClass CRUD + validate + unsupported ops`.

---

## Phase 5 — AdtMessageClassMessage

### Task 5.1: message object (read-modify-write) + wiring

**Files:**
- Create: `adt-clients/src/core/messageClass/AdtMessageClassMessage.ts` (+ message ops in `create/read/update/delete.ts` or a `messageOps.ts`)
- Modify: `AdtClient.ts`, `index.core.ts`, `core/messageClass/index.ts`
- Test: `adt-clients/src/__tests__/unit/messageClassMessage.test.ts`

**Interfaces:**
- Consumes: `parseMessageClass`/`buildMessageClassXml`, the class `read`, `throwUnsupportedOperation`, message `LOCK_MSG`/`UNLOCK_ALL` (add to `lock.ts`/`unlock.ts`).
- Produces: `IMessageClassMessageConfig`/`State`, `AdtMessageClassMessage`, `AdtClient.getMessageClassMessage()`.

- [ ] **Step 1: Failing unit test** — read extracts the message from the class; create issues LOCK_MSG + class LOCK + PUT (full class incl. the message with lockhandle) + UNLOCK + UNLOCK_ALL; delete PUTs the class without the message; unsupported ops throw.

```ts
// adt-clients/src/__tests__/unit/messageClassMessage.test.ts
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtMessageClassMessage } from '../../core/messageClass/AdtMessageClassMessage';
import { noopLogger } from '../../utils/noopLogger';

const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="T1"/></mc:messageClass>`;
const LOCK = (h: string) => `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${h}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function recorder() {
  const calls: any[] = [];
  const conn = {
    setSessionType: () => {},
    makeAdtRequest: async (o: any) => {
      calls.push(o);
      if (String(o.url).includes('_action=LOCK_MSG')) return { data: LOCK('MH'), status: 200, headers: {} } as IAdtResponse;
      if (String(o.url).includes('_action=LOCK')) return { data: LOCK('CH'), status: 200, headers: {} } as IAdtResponse;
      if (o.method === 'GET') return { data: CLASS_XML, status: 200, headers: {} } as IAdtResponse;
      return { data: '', status: 200, headers: {} } as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtMessageClassMessage', () => {
  it('read extracts the message from the class', async () => {
    const { conn } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    const st = await m.read({ className: 'ZT', msgno: '001' });
    expect(st?.message?.msgtext).toBe('T1');
  });

  it('update does LOCK_MSG + class LOCK + PUT(full class, lockhandle) + UNLOCK + UNLOCK_ALL', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.update({ className: 'ZT', msgno: '001', msgtext: 'NEW' });
    const urls = calls.map((c) => `${c.method} ${c.url}`);
    expect(urls.some((u) => u.includes('/messages/001?_action=LOCK_MSG'))).toBe(true);
    expect(urls.some((u) => u.includes('?_action=LOCK') && u.includes('msgNo=001') && u.includes('onSave=X'))).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    expect(String(put.data)).toContain('mc:msgtext="NEW"');
    expect(String(put.data)).toContain('mc:lockhandle="MH"');
    expect(urls.some((u) => u.includes('?_action=UNLOCK'))).toBe(true);
    expect(urls.some((u) => u.includes('/messages/001?_action=UNLOCK_ALL'))).toBe(true);
  });

  it('delete PUTs the class without the message', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.delete({ className: 'ZT', msgno: '001' });
    const put = calls.find((c) => c.method === 'PUT');
    expect(String(put.data)).not.toContain('mc:msgno="001"');
  });

  it('activate/lock/getVersions throw UNSUPPORTED', async () => {
    const { conn } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    for (const fn of [
      () => m.activate({ className: 'ZT', msgno: '001' }),
      () => m.lock({ className: 'ZT', msgno: '001' }),
      () => m.getVersions({ className: 'ZT', msgno: '001' }),
    ]) {
      await expect(fn()).rejects.toMatchObject({ code: 'ADT_UNSUPPORTED_OPERATION' });
    }
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Add message locks to `lock.ts` (`lockMessage`: POST `${base}/${name}/messages/${no}?_action=LOCK_MSG&accessMode=MODIFY`, Accept the StatusMessage type, parse `LOCK_HANDLE`; `lockClassForMessage`: POST `${base}/${name}?_action=LOCK&accessMode=MODIFY&msgNo=${no}&onSave=X`) and `unlock.ts` (`unlockAllMessages`: POST `${base}/${name}/messages/${no}?_action=UNLOCK_ALL` body `[${no}]`). Implement `AdtMessageClassMessage` (`IMessageClassMessageConfig`/`State`): `read` = class `read` → find `messages[msgno]` (throw `OBJECT_NOT_FOUND` if absent); `create`/`update` = read class → set/merge the message into `messages` → `stateful` → `lockMessage` (MH) + `lockClassForMessage` (CH) → PUT `${base}/${name}?lockHandle=${CH}` (no `corrNr` yet — local path only, see Task 6.2) with `buildMessageClassXml(cls, { messageLockHandles: { [no]: MH } })` → `unlock` class (CH) + `unlockAllMessages` → `stateless`; `delete` = read class → drop the message → `stateful` → class LOCK (CH) → PUT without it → `unlock` → `stateless`; `activate/check/validate/lock/unlock/getVersions/getVersionSource` → `throwUnsupportedOperation`. Always unlock + `setSessionType('stateless')` on error. Wire `getMessageClassMessage()` into `AdtClient`; export types via `index.core.ts`.
- [ ] **Step 4:** run unit + `npm run build` → PASS/clean; full `SAP_URL= npx jest src/__tests__/unit` green.
- [ ] **Step 5:** commit `feat(messageClass): AdtMessageClassMessage (read-modify-write) + wiring`.

---

## Phase 6 — integration + transport probe (trial)

### Task 6.1: lifecycle integration test (trial-gated)

- [ ] **Step 1:** Create `src/__tests__/integration/core/messageClass/messageClass.test.ts` mirroring the probe (self-skips without `.env`): create class → read → add message via `AdtMessageClassMessage.create` → read message → update it → delete it → `AdtMessageClass.delete`. Use package `ZOK_TEST`, a fresh Z name (e.g. `ZADT_MSG_ITEST`). Assert each step's state; clean up in `finally`.
- [ ] **Step 2 (on request; needs trial browser profile up):** `cp trial.env .env && DEBUG_ADT_TESTS=true npm test -- integration/core/messageClass/messageClass 2>&1 | tee test-run.log` → PASS.
- [ ] **Step 3:** commit `test(messageClass): trial lifecycle integration`.

### Task 6.2: corrNr for a transportable package (probe + wire)

- [ ] **Step 1 (probe, on a transportable package):** create/update a message class in a TRANSPORTABLE package and capture whether `corrNr` goes on the create `POST`, the `LOCK`, and/or the `PUT`/`DELETE`. Record the verified placement.
- [ ] **Step 2:** now (and only now) wire `corrNr` — thread `transport_request` from the configs into `create/update/delete.ts` and the message PUT, appending `?corrNr=${transport_request}` (or `&corrNr=` where the URL already has a query) at exactly the probe-verified spots; add a unit test asserting corrNr is present on those requests when `transportRequest` is set, and ABSENT when it is not.
- [ ] **Step 3:** commit `feat(messageClass): corrNr on mutating flows for transportable packages`.

---

## Phase 7 — finalize

- [ ] **Step 1:** `npm run build && SAP_URL= npx jest src/__tests__/unit` — all green.
- [ ] **Step 2:** dependency hygiene: interfaces dep is the published `^X.Y.0` from the registry, no `file:`/`.tgz`/`link`.
- [ ] **Step 3:** add a short `getMessageClass()` / `getMessageClassMessage()` example to `docs/usage/CLIENT_API_REFERENCE.md`.
- [ ] **Step 4:** update `CHANGELOG.md` on explicit user request (minor: message class CRUD).
- [ ] **Step 5:** delete the spec + this plan (history in git), per repo convention. Commit.

---

## Self-Review Notes

- **Spec coverage:** two IAdtObject (Tasks 4,5) ✓; endpoint contract create/read/update/delete/lock/unlock (Tasks 4,5) ✓; message read-modify-write + no msg-level DELETE (Task 5) ✓; round-trip preserving XML incl. rawAttrs class+message (Task 3.2 with the exact 3-part preservation test) ✓; unsupported ops throw (Tasks 3.1,4,5) ✓; validate via `/messageclass/validation` (Task 4) ✓; transport/corrNr (Task 6.2, both configs carry it) ✓; cross-package publish-first (Phases 1–2) ✓; integration lifecycle (Task 6.1) ✓.
- **Type consistency:** `IParsedMessageClass`/`IParsedMessage` (with `rawAttrs`), `parseMessageClass`/`buildMessageClassXml(cls, {messageLockHandles})`, `throwUnsupportedOperation`, `IMessageClassConfig/State`, `IMessageClassMessageConfig/State` used consistently across tasks; `UNSUPPORTED_OPERATION` = `'ADT_UNSUPPORTED_OPERATION'`.
- **Deferred/flagged:** corrNr exact placement for transportable packages is probe-verified in Task 6.2 (local flow already verified); message-level "re-send untouched without lock handle" confirmed in Task 6.1.
