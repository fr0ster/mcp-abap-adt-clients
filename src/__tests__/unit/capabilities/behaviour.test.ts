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

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { createLibraryLogger } from '../../helpers/testLogger';
import {
  ATOM_METHODS,
  type Atom,
  HANDLERS,
  type HandlerEntry,
} from './manifest';

type Recorded = { url: string; method: string };

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
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (req: Recorded) => {
      calls.push({ url: req.url, method: req.method });
      return {
        status: 200,
        statusText: 'OK',
        headers: { location: '/sap/bc/adt/abapunit/runs/GUARD' },
        data: bodyFor(req.url, activationBody),
      } as IAdtResponse;
    },
  } as unknown as IAbapConnection;

  // The factories assert the connection is connected, but only when it says it
  // can answer that — a connection without isConnected() is taken at its word,
  // which is what this stub is.
  const client = new AdtClient(connection, createLibraryLogger());
  return { client, calls };
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
  // Not every object is deleted by a DELETE on its own URI: ADT has a deletion
  // service — POST /deletion/check then POST /deletion/delete — and the handlers
  // that carry external references go through it. Both count, and nothing else
  // does. (The spec's flat "delete → DELETE" is an over-generalisation; found by
  // this assertion the first time it ran.)
  delete: { method: 'DELETE', url: /.*/ },
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
  // Feature toggles are validated by asking the collection whether the name is
  // taken — GET /sfw/featuretoggles.
  'featureToggle.validate': 'GET',
  // A function include's name is validated the same way, against its group.
  'functionInclude.validate': 'GET',
  // A service binding's validation starts with a GET on the bindingtypes
  // discovery endpoint; a transport check POSTs after it.
  'service.validate': 'GET',
  'serviceBinding.validate': 'GET',
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
const VERB_NOT_REACHED: Record<string, string> = {
  'dataElement.update':
    'read-modify-write; the generic body has no doma/dtel structure to patch',
  'ddl.update': 'read-modify-write over DDL source metadata',
  'metadataExtension.update': 'read-modify-write over DDLX metadata',
  'structure.update': 'read-modify-write over DDIC structure XML',
  'table.update': 'read-modify-write over DDIC table XML',
  'tableType.update': 'read-modify-write over DDIC table-type XML',
  'package.update': 'read-modify-write over package XML',
  'featureToggle.update':
    'reads the toggle collection first; the generic body carries no toggle',
  'transport.update':
    'reads the request first; the generic body is not a tm:request',
  'service.update':
    'reads the binding first; the generic body is not a binding',
  'serviceBinding.update': 'as service.update',
  'service.create':
    'asks the bindingtypes discovery endpoint first and refuses when the generic body lists no variant',
  'serviceBinding.create': 'as service.create',
};

/** The content URI `getVersionSource` is handed, and must fetch. */
const VERSION_CONTENT_URI = '/sap/bc/adt/guard/versions/1';

/**
 * Where a method addresses a resource that is neither the object nor one of the
 * shared services — verified by reading the handler, like the verb deviations.
 */
const RESOURCE_BY_HANDLER: Record<string, string> = {
  // A binding's variant is validated against the discovery endpoint that lists
  // the variants this system offers — a sibling of the binding, not an
  // ancestor of it.
  'service.validate': '/sap/bc/adt/businessservices/bindings/bindingtypes',
  'serviceBinding.validate':
    '/sap/bc/adt/businessservices/bindings/bindingtypes',
  // Creating a message writes the class it lives in.
  'messageClassMessage.create': '/sap/bc/adt/messageclass/zguard_msg',
};

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
  key: string,
  entry: HandlerEntry,
  method: string,
): { test: (url: string) => boolean; describe: string } {
  const declared = RESOURCE_BY_HANDLER[key];
  if (declared) {
    return {
      test: (url: string) => {
        const u = url.toLowerCase().split('?')[0];
        return u === declared || u.startsWith(`${declared}/`);
      },
      describe: declared,
    };
  }
  const subject = entry.subject.toLowerCase();
  const collection = subject.slice(0, subject.lastIndexOf('/'));
  const part = entry.include ? `${subject}/includes/${entry.include}` : subject;
  /** The path, with the query dropped — the query is never the resource. */
  const pathOf = (url: string) => url.toLowerCase().split('?')[0];
  /** Exactly this resource, and not a neighbour whose name starts the same. */
  const exactly = (path: string) => ({
    test: (url: string) => pathOf(url) === path,
    describe: path,
  });
  /**
   * This resource or something beneath it — with the boundary checked, so
   * `/versions/1` does not accept `/versions/1-wrong`, and a collection does
   * not accept a lock on one of its members.
   */
  const under = (path: string) => ({
    test: (url: string) => {
      const u = pathOf(url);
      return u === path || u.startsWith(`${path}/`);
    },
    describe: path,
  });
  const anyOf = (...paths: string[]) => ({
    test: (url: string) => paths.some((path) => under(path).test(url)),
    describe: paths.join(' or '),
  });

  switch (method) {
    // The object's own resource — or, for a handler whose subject is one part
    // of an object, that part. This is the case the review was about.
    case 'read':
    case 'update':
    case 'getVersions':
      return under(part);
    // Metadata, the lock and the transport are the whole object's, even when
    // the handler writes only a part of it.
    case 'readMetadata':
    case 'lock':
    case 'unlock':
    case 'readTransport':
      return anyOf(subject, '/sap/bc/adt/cts/transportchecks');
    // Creating means POSTing to the collection the object will live in — and
    // only that. A chain may validate the name first, but a validation is not
    // evidence that anything was created, and accepting it here let a create
    // that stopped after the check pass. Caught in review, 2026-08-15.
    case 'create':
      return exactly(collection);
    // Deleting is either a DELETE on the object or the deletion service; for a
    // part, it is a write to that part.
    case 'delete':
      return anyOf(part, '/sap/bc/adt/deletion/delete');
    // Shared services, each taking the object as an argument.
    case 'check':
      return anyOf('/sap/bc/adt/checkruns', subject);
    case 'activate':
      return anyOf('/sap/bc/adt/activation', subject);
    // A name is validated wherever names live: a dedicated validation
    // resource, a check run over the source, or the namespace the object
    // would sit in — which for a function include is its group, and for a
    // feature toggle is the collection.
    case 'validate':
      return {
        test: (url: string) => {
          const u = url.toLowerCase().split('?')[0];
          return (
            u.includes('/validation') ||
            u.includes('/checkruns') ||
            subject.startsWith(u)
          );
        },
        describe: `a validation resource, a check run, or an ancestor of ${subject}`,
      };
    // Takes a content URI from a version list, so the object's own path is not
    // in it — but the URI it was handed is, and a method free to fetch anything
    // it likes is not being checked at all.
    case 'getVersionSource':
      return exactly(VERSION_CONTENT_URI.toLowerCase());
    default:
      return under(subject);
  }
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
      ) => Promise<{ errors?: unknown[] }>;

      let reached = false;
      try {
        const state = await activate.call(handler, entry.config);
        reached = (state?.errors?.length ?? 0) > 0;
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
            const resource = expectedResource(key, entry, method);
            const onSubject = calls.filter(
              (c) =>
                (c.method === verb ||
                  (method === 'delete' &&
                    c.url.includes('/deletion/delete'))) &&
                resource.test(c.url),
            );
            if (onSubject.length === 0) {
              throw new Error(
                `${name}.${method} issued its ${verb} but never on ${resource.describe} — it went to ` +
                  calls
                    .filter((c) => c.method === verb)
                    .map((c) => c.url.split('?')[0])
                    .join(', '),
              );
            }
          });
        }
      }
    });
  }
});
