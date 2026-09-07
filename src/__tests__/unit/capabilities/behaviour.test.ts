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

type Recorded = { url: string; method: string };

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
      calls.push({ url: wireUrl(req), method: req.method });
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

  // **Read-modify-write, and ADT's shape rather than this library's choice.**
  // These objects *are* their document, and the endpoint takes it whole: to
  // change one field you fetch the XML, patch it and PUT it back. A caller who
  // has the whole document can hand it over in `options.xmlContent`, which is
  // the seam that exists for it; without one there is no single request that
  // changes a domain's length.
  'domain.updateMetadata': 'GET the document, patch it, PUT it back',
  'dataElement.updateMetadata': 'as domain',
  'tableType.updateMetadata': 'as domain',
  'package.updateMetadata': 'as domain',
  'messageClass.updateMetadata': 'as domain',
  'authorizationField.updateMetadata': 'as domain',
  'functionGroup.updateMetadata': 'as domain, plus its own check',

  // **Not a step of the operation.** `getSystemInformation()` answers whether
  // this is cloud or on-premise, which decides content types and which
  // endpoints exist at all. It is asked once and cached on the client; the
  // guard sees it because each of these tests builds a fresh one.
  'behaviorImplementation.create': 'systeminformation, then the POST',
  'service.create': 'as behaviorImplementation.create',
  'serviceBinding.create': 'as behaviorImplementation.create',
};

const VERB_NOT_REACHED: Record<string, string> = {
  'tableType.updateMetadata':
    'read-modify-write: it GETs the table type first, and the generic body is not one to patch',
  'dataElement.updateMetadata':
    'read-modify-write; the generic body has no doma/dtel structure to patch',
  'package.updateMetadata': 'read-modify-write over package XML',
  'transport.updateMetadata':
    'reads the request first; the generic body is not a tm:request',
};

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
 * Activation is judged by the messages, and a failure has to reach the caller.
 *
 * This is the one assertion that would have caught `functionGroup.activate`:
 * it POSTed correctly and then ignored the answer, so a failed activation came
 * back as `errors: []`. Asserting only that a POST went out would have passed.
 */
const FAILED_ACTIVATION = `<?xml version="1.0" encoding="utf-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <msg objDescr="ZGUARD" type="E" line="1" href="/sap/bc/adt/guard">
    <shortText><txt>Object could not be activated</txt></shortText>
  </msg>
</chkl:messages>`;

describe('capability guard — activation reports failure', () => {
  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    if (!entry.capabilities.includes('activatable')) continue;

    it(`${name}: an error-severity message reaches the caller`, async () => {
      const { client } = recordingClient(FAILED_ACTIVATION);
      const handler = entry.factory(client) as unknown as Record<
        string,
        unknown
      >;
      const activate = handler.activate as (
        c: unknown,
      ) => Promise<IAdtResponse<unknown>>;

      // The failure half, or a throw. Either reaches the caller; what must not
      // happen is a success — which is what `errors: []` was, and why this
      // assertion exists at all. ADT answers a refused activation with 200 and
      // a `<msg type="E">`, so nothing below the contract can tell.
      let reached = false;
      try {
        reached = !(await activate.call(handler, entry.config)).ok;
      } catch {
        reached = true;
      }

      expect(reached).toBe(true);
    });
  }
});

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
