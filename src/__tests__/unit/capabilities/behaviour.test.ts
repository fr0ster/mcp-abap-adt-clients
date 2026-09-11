/**
 * Check 3 — every capability a handler claims does what that capability means.
 *
 * Types are not enough here, and the two failures this catches are the two the
 * plan exists for:
 *
 * - a method that **carries** an atom and refuses when called. That is a stub,
 *   and the shape check cannot see it: a class with a throwing `getVersions`
 *   satisfies `IAdtVersionable` perfectly.
 * - a method that issues **no request at all** and returns an empty state,
 *   which reads to a caller as success. `unitTest.validate` and
 *   `transport.validate` both did exactly that.
 *
 * So each claimed capability is called against a recording connection, and the
 * assertion is that a request went out. Every method of every atom, not one per
 * atom — `readMetadata`, `unlock` and `getVersionSource` are where stubs hid.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { createLibraryLogger } from '../../helpers/testLogger';
import type { RequestSpec } from './manifest';
import {
  ATOM_METHODS,
  type Atom,
  HANDLERS,
  type HandlerEntry,
} from './manifest';

type Recorded = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  /** What deadline the request actually carried, if any. */
  timeout?: number;
};

/**
 * The URL as it would go on the wire.
 *
 * Some handlers put `_action=LOCK` in the URL and some pass it as `params`,
 * which axios folds into the query. A recorder that reads only `url` cannot
 * tell a lock from an unlock for the second kind — found while distinguishing
 * the two, 2026-08-15.
 */
function wireUrl(req: {
  url: string;
  params?: Record<string, unknown>;
}): string {
  if (!req.params) return req.url;
  const query = Object.entries(req.params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');
  return query
    ? `${req.url}${req.url.includes('?') ? '&' : '?'}${query}`
    : req.url;
}

/**
 * Answers every request with a body the low-level parsers accept.
 *
 * A realistic body matters: an empty one is what let read-modify-write corrupt
 * updates silently, and it would let this guard pass vacuously too.
 */
/**
 * The connection answers by what was asked, not with one body for everything.
 *
 * A single body cannot serve both: a LOCK is parsed out of `asx:abap` and an
 * object read is patched through its `adtcore:` attributes, so whichever shape
 * you pick, the other chain breaks at its first step — and then "a request went
 * out" is true while the method under test never reached its own verb. That is
 * how an earlier version of this file reported four read-modify-write handlers
 * green without one of them ever issuing a PUT.
 */
const LOCK_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>GUARD-LOCK</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

const OBJECT_BODY = `<?xml version="1.0" encoding="utf-8"?>
<adtcore:mainObject xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom"
  adtcore:name="ZGUARD" adtcore:description="guard" adtcore:masterLanguage="EN"
  adtcore:responsible="GUARD" adtcore:version="active">
  <adtcore:packageRef adtcore:name="$TMP"/>
  <atom:link href="/sap/bc/adt/cts/transportrequests/DEVK900000" rel="http://www.sap.com/adt/relations/transportrequest" adtcore:name="DEVK900000" title="guard"/>
</adtcore:mainObject>`;

const VERSIONS_FEED = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core">
  <atom:entry><atom:title>000001</atom:title><atom:content src="/sap/bc/adt/guard/versions/1"/></atom:entry>
</atom:feed>`;

const ACTIVATION_OK = `<?xml version="1.0" encoding="utf-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"/>`;

/** ADT's answer to "may this be deleted": yes, nothing references it. */
const DELETION_PERMITTED = `<?xml version="1.0" encoding="utf-8"?>
<del:object xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"
  del:isDeletable="true" del:externalStrongReferences="0" del:externalWeakReferences="0"
  adtcore:name="ZGUARD" adtcore:type="CLAS/OC">
  <del:message del:priority="0" del:type="S"><del:text/></del:message>
</del:object>`;

/** Pick the body this request would really have come back with. */
function bodyFor(url: string, activationBody: string): string {
  if (/_action=(LOCK|UNLOCK)/.test(url)) return LOCK_BODY;
  if (url.includes('/activation')) return activationBody;
  if (url.includes('/versions')) return VERSIONS_FEED;
  if (url.includes('/deletion/')) return DELETION_PERMITTED;
  return OBJECT_BODY;
}

function recordingClient(activationBody: string = ACTIVATION_OK) {
  const calls: Recorded[] = [];
  const sessionTypes: string[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: (type: string) => {
      sessionTypes.push(type);
    },
    makeAdtRequest: async (
      req: Recorded & { params?: Record<string, unknown> },
    ) => {
      calls.push({
        url: wireUrl(req),
        method: req.method,
        headers: req.headers,
        timeout: (req as { timeout?: number }).timeout,
      });
      return {
        status: 200,
        statusText: 'OK',
        headers: { location: '/sap/bc/adt/abapunit/runs/GUARD' },
        data: bodyFor(req.url, activationBody),
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;

  // The factories assert the connection is connected, but only when it says it
  // can answer that — a connection without isConnected() is taken at its word,
  // which is what this stub is.
  const client = new AdtClient(connection, createLibraryLogger());
  return { client, calls, sessionTypes };
}

/**
 * Nobody builds a session type into a request.
 *
 * `x-sap-adt-sessiontype` is the connection's, written by the connection from
 * its own mode. Five low-level functions used to put it in the headers
 * themselves — `featureToggle`'s lock, unlock, update and source write, and
 * `functionInclude`'s source write — and the guard below could not see it,
 * because that guard asks who calls `setSessionType` and these called nobody.
 *
 * The cost was not a duplicate header. The connection's own mode was stateless
 * while the request said stateful, so a write ran inside a session the
 * connection did not know it was in — and what the server takes during such a
 * request is held by that session, long after the object is gone.
 */
describe('the session type is the connection’s, never a request’s', () => {
  it('no member puts x-sap-adt-sessiontype in its headers', async () => {
    const offenders: string[] = [];

    for (const [name, entry] of Object.entries(HANDLERS)) {
      for (const atom of Object.keys(ATOM_METHODS) as Atom[]) {
        for (const method of ATOM_METHODS[atom]) {
          const { client, calls } = recordingClient();
          const handler = entry.factory(client) as unknown as Record<
            string,
            unknown
          >;
          if (typeof handler[method] !== 'function') continue;
          try {
            await invoke(
              handler,
              method,
              entry.config as Record<string, unknown>,
            );
          } catch {
            // A member that refuses is fine here; what it sent is the subject.
          }
          for (const call of calls) {
            const hit = Object.keys(call.headers ?? {}).find(
              (h) => h.toLowerCase() === 'x-sap-adt-sessiontype',
            );
            if (hit) offenders.push(`${name}.${method} → ${call.url} [${hit}]`);
          }
        }
      }
    }

    expect(offenders).toStrictEqual([]);
  });
});

/**
 * The request each method must actually issue.
 *
 * "A request went out" is not an assertion: a read-modify-write `update` that
 * locks, reads, fails to patch and unlocks issues three requests and never its
 * PUT — and that is exactly what four handlers did under the earlier fixture
 * while this file reported them green. Caught in review, 2026-08-14.
 *
 * The verbs are the spec's, and they are invariant: `create` → POST,
 * `read` → GET, `update` → PUT, `delete` → DELETE, `check` → POST,
 * `activate` → POST. A lock and an unlock are POSTs with an `_action`.
 */
const ATOM_VERB: Record<string, string | { method: string; url: RegExp }> = {
  create: 'POST',
  read: 'GET',
  readMetadata: 'GET',
  update: 'PUT',
  updateMetadata: 'PUT',
  // Not every object is deleted by a DELETE on its own URI: ADT has a deletion
  // service — POST /deletion/check then POST /deletion/delete — and the handlers
  // that carry external references go through it. Both count, and nothing else
  // does. (The spec's flat "delete → DELETE" is an over-generalisation; found by
  // this assertion the first time it ran.)
  delete: { method: 'DELETE', url: /.*/ },
  // The approval ADT wants before a delete: `POST /deletion/check`, everywhere
  // it is offered, because the deletion service is asked about a URI.
  checkDeletion: 'POST',
  validate: 'POST',
  check: 'POST',
  activate: 'POST',
  lock: 'POST',
  unlock: 'POST',
  getVersions: 'GET',
  getVersionSource: 'GET',
  readTransport: 'GET',
};

/**
 * Where the request a method issues is genuinely not the atom's default verb.
 *
 * Each of these was read out of the handler and confirmed against what ADT
 * offers. They are deviations from the default table above, not from honesty —
 * and listing them is what stops the table being quietly loosened for everyone.
 */
const VERB_BY_HANDLER: Record<string, string> = {
  // Deleting an include means writing an empty one: ADT has no resource to
  // DELETE, because the include exists only as part of its class.
  'localTestClass.delete': 'PUT',
  'localTypes.delete': 'PUT',
  'localDefinitions.delete': 'PUT',
  'localMacros.delete': 'PUT',
  'unitTest.delete': 'PUT',
  // A message is added and removed the same way: by rewriting its class's XML,
  // and the class is PUT. There is no collection to POST to — the message is
  // not a resource of its own.
  'messageClassMessage.create': 'PUT',
  'messageClassMessage.delete': 'PUT',
  // A function include's name is validated the same way, against its group.
  'functionInclude.validate': 'GET',
  // A transport request's deletion check is a GET on the request itself. The
  // deletion service answers `No URI-Mapping defined for URI …` for a transport
  // — measured on the cloud trial — so asking it there would report a fact
  // about the address rather than about the request.
  'transport.checkDeletion': 'GET',
  // A binding's `update` is its publication: one POST to a job endpoint, not a
  // PUT on the object. Since 18.0.0 it is exactly that one request — it used to
  // GET the binding first, to derive the service and to check the transition —
  // and this entry is what keeps a second request from creeping back during the
  // ordinary run. The live publish and unpublish are deliberately manual, in
  // `integration/core/serviceBinding/publication.test.ts`: they take ~133
  // seconds of server time each, which is no place for a suite that runs on
  // every change. The shape is checked here instead, in milliseconds, against
  // a stub.
  'service.update': 'POST',
  'serviceBinding.update': 'POST',
  // Its transport is checked through POST /cts/transportchecks rather than read
  // from the object.
  'service.readTransport': 'POST',
  'serviceBinding.readTransport': 'POST',
};

/**
 * Where a generic fixture cannot drive the method to its request at all.
 *
 * These are gaps in **this check**, not properties of the handlers: each method
 * is real, and a per-handler response body shaped like the object it reads
 * would reach the write. They are listed so the gap is counted rather than
 * passing silently, and the assertion fails if one starts working and is left
 * here.
 */
/**
 * Members that legitimately issue more than the request their capability names.
 *
 * The list is short on purpose and each entry says why, because "one member,
 * one request" is the rule this release established: an entry here is a
 * documented exception, not a place to put a member that grew a second call.
 */
const EXTRA_REQUESTS: Record<string, string> = {
  // A message is a row inside its class's document: the write is one PUT, but
  // it needs two lock handles and a read-modify-write of XML this library
  // assembles.
  'messageClassMessage.create': 'read-modify-write of the class document',
  'messageClassMessage.update': 'as create',
  'messageClassMessage.delete': 'as create',

  // **Read-modify-write, and the two that are left.**
  //
  // These objects *are* their document and the endpoint takes it whole, so
  // changing one field means fetching the XML, patching it and PUTting it back.
  // Since 19.0.0 that read is the caller's: `config.document` carries what they
  // built, and domain, dataElement, tableType, package and transport each issue
  // one PUT.
  //
  // Two have not been converted yet and still read first. They are listed as
  // debt, not as shape.
  'messageClass.updateMetadata': 'GET the document, patch it, PUT it back',
  'authorizationField.updateMetadata': 'as messageClass',
  'functionGroup.updateMetadata': 'as messageClass, plus its own check',

  // **Not a step of the operation.** `getSystemInformation()` answers whether
  // this is cloud or on-premise, which decides content types and which
  // endpoints exist at all. It is asked once and cached on the client; the
  // guard sees it because each of these tests builds a fresh one.
  'behaviorImplementation.create': 'systeminformation, then the POST',
  'service.create': 'as behaviorImplementation.create',
  'serviceBinding.create': 'as behaviorImplementation.create',
};

/**
 * Members the guard cannot reach with its generic fixture.
 *
 * Empty since 19.0.0. The three that were here — dataElement, package and
 * transport — were unreachable because they read the current document before
 * writing, and the guard's generic body was not a document they could patch.
 * They write what the caller passes now, so a generic body is exactly what they
 * send.
 */
const VERB_NOT_REACHED: Record<string, string> = {};

/** The content URI `getVersionSource` is handed, and must fetch. */
const VERSION_CONTENT_URI = '/sap/bc/adt/guard/versions/1';

/**
 * Which resource the matching request has to have addressed.
 *
 * The verb alone is not the capability: `getLocalTestClass().getVersions()`
 * reading `includes/main/versions` instead of `includes/testclasses/versions`
 * is a GET either way, and would have passed. Caught in review, 2026-08-15.
 *
 * Most methods address the object itself. The rest address an ADT service that
 * takes the object as an argument — one activation endpoint, one check runner,
 * one deletion service — and those are named here once rather than per handler.
 */
function expectedResource(
  entry: HandlerEntry,
  method: string,
  defaultVerb: string,
): {
  describe: string;
  all: { method: string; path: string }[];
  action?: string;
} {
  // The URI `getVersionSource` was handed. It comes from a version list, not
  // from the object's path, so it is the one request the manifest cannot name.
  if (method === 'getVersionSource') {
    return {
      describe: VERSION_CONTENT_URI,
      all: [{ method: 'GET', path: VERSION_CONTENT_URI.toLowerCase() }],
    };
  }

  const declared = entry.requests?.[method];
  if (!declared) {
    return {
      describe: `a request the manifest names for ${method} — this entry claims the capability and names none`,
      all: [{ method: defaultVerb, path: '\u0000never' }],
    };
  }

  const specs = Array.isArray(declared)
    ? (declared as RequestSpec[])
    : [declared as RequestSpec];
  const all = specs.map((spec) =>
    typeof spec === 'string'
      ? { method: defaultVerb, path: spec.toLowerCase() }
      : { method: spec.method, path: spec.path.toLowerCase() },
  );

  // A lock and an unlock are the same POST on the same resource, told apart by
  // `_action` alone — which a path comparison drops.
  const action =
    method === 'lock' ? 'LOCK' : method === 'unlock' ? 'UNLOCK' : undefined;

  return {
    describe:
      all.map((r) => `${r.method} ${r.path}`).join(' and ') +
      (action ? `?_action=${action}` : ''),
    all,
    action,
  };
}

/** Call one method of one atom with arguments that fit its signature. */
async function invoke(
  handler: Record<string, unknown>,
  method: string,
  config: Record<string, unknown>,
): Promise<void> {
  const fn = handler[method] as (...args: unknown[]) => Promise<unknown>;
  switch (method) {
    case 'unlock':
      await fn.call(handler, config, 'GUARD-LOCK');
      return;
    case 'getVersionSource':
      await fn.call(handler, VERSION_CONTENT_URI);
      return;
    case 'check':
      await fn.call(handler, config, 'inactive');
      return;
    case 'update':
    case 'updateMetadata':
      // The source travels in the options, which is the only channel now: the
      // fallback to `config.sourceCode` is gone, so a write with neither is
      // refused before the request — correctly, and not what this guard is
      // measuring. `xmlContent` for the same reason on the document writes.
      await fn.call(handler, config, {
        sourceCode: String(config.sourceCode ?? '" guard'),
        xmlContent: String(config.xmlContent ?? '<guard/>'),
        lockHandle: 'GUARD-LOCK',
      });
      return;
    default:
      await fn.call(handler, config);
  }
}

/**
 * `invoke`, with an options bag merged in.
 *
 * The members take options in their second or third position depending on the
 * member, which is why this mirrors `invoke`'s switch rather than trying to be
 * clever about arity.
 */
/** Where the options bag sits for a given member, 1-based. */
const OPTIONS_POSITION: Record<string, number> = {
  check: 3,
  read: 3,
  update: 2,
  updateMetadata: 2,
};

/**
 * Whether a member has anywhere to put an options bag.
 *
 * A member that declares none makes no per-call promise, so the guard has
 * nothing to check on it. Read from the function's arity rather than kept as a
 * list, so a member that gains or loses the parameter is covered without anyone
 * remembering to edit this file.
 */
function takesOptions(
  handler: Record<string, unknown>,
  method: string,
): boolean {
  const fn = handler[method] as ((...args: unknown[]) => unknown) | undefined;
  if (typeof fn !== 'function') return false;
  if (method === 'unlock' || method === 'getVersionSource') return false;
  return fn.length >= (OPTIONS_POSITION[method] ?? 2);
}

async function invokeWithOptions(
  handler: Record<string, unknown>,
  method: string,
  config: Record<string, unknown>,
  options: Record<string, unknown>,
): Promise<void> {
  const fn = handler[method] as (...args: unknown[]) => Promise<unknown>;
  switch (method) {
    case 'unlock':
      await fn.call(handler, config, 'GUARD-LOCK');
      return;
    case 'getVersionSource':
      await fn.call(handler, VERSION_CONTENT_URI);
      return;
    case 'check':
      await fn.call(handler, config, 'inactive', options);
      return;
    case 'read':
      await fn.call(handler, config, undefined, options);
      return;
    case 'update':
    case 'updateMetadata':
      await fn.call(handler, config, {
        ...options,
        sourceCode: String(config.sourceCode ?? '" guard'),
        xmlContent: String(config.xmlContent ?? '<guard/>'),
        lockHandle: 'GUARD-LOCK',
      });
      return;
    default:
      await fn.call(handler, config, options);
  }
}

/**
 * Activation once had a section here asserting that an error-severity message
 * came back as a failure. Nothing in this package reads an activation
 * checklist any more: ADT answers 200, the exchange succeeded, and the
 * document is the result. Whether it says the activation happened is the
 * caller's reading, through the `analyse` they pass, so the assertion moved
 * out with the strategy it was about.
 */

describe('capability guard — behaviour', () => {
  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    describe(name, () => {
      for (const atom of entry.capabilities) {
        for (const method of ATOM_METHODS[atom as Atom]) {
          it(`${atom}: ${method} issues a request`, async () => {
            const { client, calls } = recordingClient();
            const handler = entry.factory(client) as unknown as Record<
              string,
              unknown
            >;

            expect(typeof handler[method]).toBe('function');

            let refusal: unknown;
            try {
              await invoke(handler, method, entry.config);
            } catch (error) {
              refusal = error;
            }

            // A method that issued nothing returned success without doing
            // anything, which is the shape of every stub this plan removed.
            if (calls.length === 0) {
              throw new Error(
                refusal
                  ? `${name}.${method} refused without issuing a request: ${String(refusal)}`
                  : `${name}.${method} returned without issuing any request — an empty success`,
              );
            }

            // And it has to be the right request. Anything else means the
            // method did some of its chain and stopped short.
            const key = `${name}.${method}`;
            const fallback = ATOM_VERB[method];
            const verb =
              VERB_BY_HANDLER[key] ??
              (typeof fallback === 'string' ? fallback : fallback.method);
            const issued =
              method === 'delete' && verb === 'DELETE'
                ? calls.some(
                    (c) =>
                      c.method === 'DELETE' ||
                      (c.method === 'POST' &&
                        c.url.includes('/deletion/delete')),
                  )
                : calls.some((c) => c.method === verb);
            if (key in VERB_NOT_REACHED) {
              // Listed as unreachable: it must still be unreachable, or the
              // list is stale and says the check covers less than it does.
              expect(issued).toBe(false);
              return;
            }
            if (!issued) {
              throw new Error(
                `${name}.${method} issued ${calls
                  .map((c) => c.method)
                  .join(', ')} but never a ${verb}` +
                  (refusal ? ` — it refused: ${String(refusal)}` : ''),
              );
            }

            // And on the right resource. A verb on the wrong URL is still the
            // wrong request — the whole point of naming a capability.
            const resource = expectedResource(entry, method, verb);
            const made = calls
              .filter(
                (c) =>
                  !resource.action ||
                  new RegExp(`_action=${resource.action}(&|$)`, 'i').test(
                    c.url,
                  ),
              )
              .map((c) => ({
                method: c.method,
                path: c.url.toLowerCase().split('?')[0],
              }));

            // Every named request, method and path together: an operation whose
            // chain mixes verbs — POST the class, then PUT the tests into it —
            // is only half done if the second never happens, and a list under
            // one implied verb could not say that.
            const missing = resource.all.filter(
              (want) =>
                !made.some(
                  (c) =>
                    c.path === want.path &&
                    (c.method === want.method ||
                      (method === 'delete' &&
                        want.method === 'DELETE' &&
                        c.path.includes('/deletion/delete'))),
                ),
            );
            if (missing.length > 0) {
              throw new Error(
                `${name}.${method} never made ${resource.describe} — it made ${made.map((c) => `${c.method} ${c.path}`).join(', ') || 'nothing'}`,
              );
            }

            // **And nothing besides.** Naming the right request proves it
            // happened, not that it happened alone — a member that reads the
            // object first and then writes it passes every assertion above.
            // That is exactly what `AdtServiceBinding.update` did until this
            // release, and what 61 other members did before the chains came
            // out, so the count is the invariant this whole change is about.
            if (!(key in EXTRA_REQUESTS)) {
              expect({
                member: key,
                issued: calls.map((c) => `${c.method} ${c.url.split('?')[0]}`),
              }).toEqual({
                member: key,
                issued: calls
                  .slice(0, resource.all.length)
                  .map((c) => `${c.method} ${c.url.split('?')[0]}`),
              });
            }
          });
        }
      }
    });
  }
});

/**
 * A member does not touch the session.
 *
 * Statefulness belongs to the lock window, and since 18.0.0 a lock window is
 * something the consumer opens: it calls `lock`, then the write, then `unlock`,
 * and it is the one that knows whether those three belong to the same session.
 * A member that flipped the connection to stateful and back would take that
 * decision away — and worse, would reset it under a *different* handler that
 * happens to hold a lock on the same connection. That was the E19 incident, and
 * this is the assertion that keeps its cause from coming back.
 *
 * `lock` and `unlock` are exempt on purpose: they are the session, not a
 * request that happens inside one.
 */
describe('capability guard — a member leaves the session alone', () => {
  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    for (const atom of entry.capabilities) {
      for (const method of ATOM_METHODS[atom as Atom]) {
        if (method === 'lock' || method === 'unlock') continue;
        // The one exception in the library, and it is named rather than
        // skipped: a message is a row inside its class's document, so writing
        // one takes two lock handles and a read-modify-write of XML this
        // library assembles. Its session handling is the write's own.
        const exempt =
          name === 'messageClassMessage' &&
          (method === 'create' || method === 'update' || method === 'delete');
        it(`${name}.${method} ${exempt ? 'owns its session window' : 'never calls setSessionType'}`, async () => {
          const { client, sessionTypes } = recordingClient();
          const handler = entry.factory(client) as unknown as Record<
            string,
            unknown
          >;
          try {
            await invoke(handler, method, entry.config);
          } catch {
            // What the member answered is another test's subject. Even a
            // refusal must not have moved the session on its way out.
          }
          if (exempt) {
            expect(sessionTypes.length).toBeGreaterThan(0);
            expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
            return;
          }
          expect(sessionTypes).toEqual([]);
        });
      }
    }
  }
});

/**
 * A lock window that fails still puts the session back.
 *
 * The guard above asks that ordinary members never touch `setSessionType`.
 * `lock` and `unlock` are exempt there — they *are* the session — and that
 * exemption is exactly where the defect lived: all three methods of
 * `LockCapability`, and the same pattern hand-written in twenty-six handlers,
 * set stateful, ran the request, and set stateless **as the last statement of
 * the success path**. A refused `LOCK` — an object someone else holds, an
 * expired session, a dropped connection — jumped over the restore.
 *
 * The connection is shared, so the cost is not confined to the caller that
 * failed: the next unrelated request goes out inside a session nobody asked
 * for, and what the server takes during it is held until that session ends.
 *
 * This asserts the invariant rather than the implementation, so it holds for
 * whichever way a handler spells its cleanup — `inStatefulSession`, a bare
 * `finally`, or `chain`'s `onScopeEnd`.
 */
describe('capability guard — a failed lock window restores the session', () => {
  /** Every request is refused, which is the whole point. */
  function refusingClient() {
    const sessionTypes: string[] = [];
    const connection = {
      connect: async () => {},
      getBaseUrl: async () => 'https://example',
      getSessionId: () => null,
      setSessionType: (type: string) => {
        sessionTypes.push(type);
      },
      makeAdtRequest: async () => {
        throw new Error('guard: the server refused this request');
      },
    } as unknown as IAbapConnection;
    const client = new AdtClient(connection, createLibraryLogger());
    return { client, sessionTypes };
  }

  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    if (!entry.capabilities.includes('lockable')) continue;
    for (const method of ['lock', 'unlock']) {
      it(`${name}.${method} leaves the session stateless when the request fails`, async () => {
        const { client, sessionTypes } = refusingClient();
        const handler = entry.factory(client) as unknown as Record<
          string,
          unknown
        >;
        try {
          await invoke(handler, method, entry.config);
        } catch {
          // Whether the refusal arrives as an answer or a throw is another
          // test's subject. Either way the session must be back.
        }

        // The invariant is "never left stateful", and only that. A member that
        // switched nothing asked the server nothing, or was refused before the
        // wire; a member that only ever sets stateless is making a different
        // choice, right or wrong, and this guard is not about that choice. What
        // must not happen is going stateful and stopping there.
        if (!sessionTypes.includes('stateful')) return;
        expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
      });
    }
  }
});

/**
 * The caller's deadline reaches the wire.
 *
 * Since 18.0.0 this library sends no client-side timeout of its own —
 * `SAP_TIMEOUT_DEFAULT` defaults to `0` — and the CHANGELOG and the API
 * reference both tell a caller that `IAdtOperationOptions.timeout` is how they
 * ask for one. That was untrue for every member but the service binding's
 * publication: the low-level functions end in
 * `makeAdtRequest({ …, timeout: getTimeout('default') })` at 444 places, and
 * none of them could see the option. So a caller who wanted a deadline had a
 * documented parameter that did nothing, and the only real control was a
 * process-wide environment variable.
 *
 * This asserts the promise rather than the mechanism: whatever a member does
 * internally, a request it issues carries the number the caller passed.
 */
describe('capability guard — options.timeout reaches the wire', () => {
  const DEADLINE = 4321;

  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    for (const atom of entry.capabilities) {
      for (const method of ATOM_METHODS[atom as Atom]) {
        // `lock` and `unlock` take no options bag — the lock window's shape is
        // the caller's own sequence, and neither member has one to read.
        if (method === 'lock' || method === 'unlock') continue;

        it(`${name}.${method} carries the caller's timeout`, async () => {
          const { client, calls } = recordingClient();
          const handler = entry.factory(client) as unknown as Record<
            string,
            unknown
          >;
          // A member with no options parameter promises nothing per call.
          if (!takesOptions(handler, method)) return;
          try {
            await invokeWithOptions(handler, method, entry.config, {
              timeout: DEADLINE,
            });
          } catch {
            // A member that refuses before the wire issued no request, and the
            // check below is about requests that were issued.
          }

          const issued = calls.filter((c) => c.timeout !== undefined);
          if (calls.length === 0) return;
          expect(issued.map((c) => c.timeout)).toEqual(
            calls.map(() => DEADLINE),
          );
        });
      }
    }
  }
});
