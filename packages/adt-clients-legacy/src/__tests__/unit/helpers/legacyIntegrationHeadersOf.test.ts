/**
 * `integrationHeadersOf` on the legacy handlers: every header member of a
 * legacy client's handler resolves a recorded pair, or is a registered
 * refusal that sends nothing; and the legacy tests that reach SAP take the
 * strict resolver alone, as the root package's
 * `integrationHeadersOf.test.ts` holds for its own. The handler walk is that
 * file's.
 */
import { join } from 'node:path';
import {
  AdtClass,
  AdtClient,
  AdtContentTypesBase,
} from '@mcp-abap-adt/adt-clients';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  integrationHeadersOf,
  TEST_HEADERS,
} from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { resolverOffenders } from '../../../../../adt-clients/src/__tests__/unit/helpers/resolverScan';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { AdtFunctionIncludeLegacy } from '../../../core/functionInclude/AdtFunctionIncludeLegacy';
import { AdtIncludeLegacy } from '../../../core/include/AdtIncludeLegacy';
import { LEGACY_REFUSED } from '../../helpers/legacyMembers';
import { REFUSED_WITHOUT_REQUEST } from '../../helpers/legacyRegistrations';

/**
 * The members that take `options.headers` since 36.0.0 (MIGRATION-36.md):
 * the object handlers' and the utilities', looked up on every handler a
 * client factory hands out, and the standalone classes' own.
 */
const HANDLER_MEMBERS = [
  'create',
  'update',
  'updateMetadata',
  'delete',
  'checkDeletion',
  'check',
  'activate',
  'checkState',
  'removeObject',
  'addObject',
  'createTask',
  'changeTaskType',
  'moveObjects',
  'getWhereUsed',
  'getWhereUsedScope',
  'getVirtualFoldersContents',
  'fetchNodeStructure',
  'activateObjectsGroup',
  'checkDeletionGroup',
  'deleteObjectsGroup',
  'getSqlQuery',
  'getTableContents',
];
/** A mock connection; `sent` counts the requests that reached it. */
function connection(): IAbapConnection & { sent: number } {
  const conn = {
    sent: 0,
    makeAdtRequest: async () => {
      conn.sent++;
      return { status: 200, data: '' };
    },
    setSessionType: jest.fn(),
    getSessionId: jest.fn().mockReturnValue('session'),
  };
  return conn as unknown as IAbapConnection & { sent: number };
}

const logger = { debug() {}, info() {}, warn() {}, error() {} };

type Handler = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** Every handler a client's `get…()` factories hand out, by factory name. */
function handlersOf(
  client: AdtClient,
): { factory: string; handler: Handler }[] {
  const names = new Set<string>();
  let proto: object | null = Object.getPrototypeOf(client);
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto))
      if (/^get[A-Z]/.test(name)) names.add(name);
    proto = Object.getPrototypeOf(proto);
  }
  const found: { factory: string; handler: Handler }[] = [];
  for (const factory of [...names].sort()) {
    const handler = (client as unknown as Record<string, () => unknown>)[
      factory
    ]?.call(client);
    if (handler && typeof handler === 'object')
      found.push({ factory, handler: handler as Handler });
  }
  return found;
}

/** `[label, handler, member]` for every header member a handler has. */
function headerMembers(
  label: string,
  handler: Handler,
  members: readonly string[] = HANDLER_MEMBERS,
): [string, Handler, string][] {
  return members
    .filter((member) => typeof handler[member] === 'function')
    .map((member) => [`${label}.${member}`, handler, member]);
}

describe('integrationHeadersOf', () => {
  it('throws for a handler shaped like a legacy refusal that is not one', () => {
    const sent: unknown[] = [];
    const send = async (_config: unknown, options: { headers: unknown }) => {
      sent.push(options.headers);
    };
    // An objectType the legacy client does not refuse.
    expect(() =>
      integrationHeadersOf({ objectType: 'Class', create: send }, 'create'),
    ).toThrow('Object.create');
    // A refused type's name and keys, but a member that sends.
    const real = new AdtClientLegacy(connection(), logger).getDomain();
    const forged: Record<string, unknown> = { ...real, create: send };
    expect(() => integrationHeadersOf(forged, 'create')).toThrow(
      'Object.create',
    );
    // A class that only borrows a legacy refusal's name.
    class AdtPackageLegacy {
      async create(_config: unknown, options: { headers: unknown }) {
        sent.push(options.headers);
      }
    }
    expect(() =>
      integrationHeadersOf(new AdtPackageLegacy(), 'create'),
    ).toThrow('AdtPackageLegacy.create');
    // The real ones still pass.
    expect(integrationHeadersOf(real, 'create')).toBe(TEST_HEADERS);
    expect(
      integrationHeadersOf(
        new AdtClientLegacy(connection(), logger).getPackage(),
        'create',
      ),
    ).toBe(TEST_HEADERS);
    expect(sent).toEqual([]);
  });

  it('resolves every header member of every legacy handler, or proves it sends nothing', async () => {
    const conn = connection();
    const legacy = handlersOf(new AdtClientLegacy(conn, logger)).flatMap(
      ({ factory, handler }) => headerMembers(`${factory}()`, handler),
    );
    expect(legacy.length).toBeGreaterThan(150);
    const sentWithTestHeaders: string[] = [];
    let refusals = 0;
    for (const [label, handler, member] of legacy) {
      // Throws, and fails the test, for a member with no pair at all.
      const pair = integrationHeadersOf(handler, member);
      if (pair !== TEST_HEADERS) continue;
      refusals++;
      const before = conn.sent;
      const answer = (await handler[member]?.call(handler, {}, undefined, {
        headers: pair,
      })) as { ok?: boolean };
      if (answer?.ok !== false || conn.sent !== before)
        sentWithTestHeaders.push(label);
    }
    // The absent types and the legacy package, request and data-preview
    // refusals: each was called, and none sent a request.
    expect(refusals).toBeGreaterThan(50);
    expect(sentWithTestHeaders).toEqual([]);
  });

  /**
   * `REFUSED_WITHOUT_REQUEST` and the inventory's refused rows are one list
   * (spec §11.1 "Refusals"): every member a legacy class handler refuses is
   * one `integrationHeadersOf` lets through without a pair, and no other. The
   * inventory (`legacyMemberInventory.test.ts`) calls each of those rows and
   * proves it sends nothing, so this agreement is what carries that proof
   * here. Left out, each for its reason:
   * - an `absentOnLegacy` object's rows — `isAbsentOnLegacy` recognises those
   *   by their refusal, not by a list;
   * - a row by case (`member[case]`) — that member sends for its other cases,
   *   so a per-member entry would let a sending call go without a pair.
   */
  it('lets through exactly the members the inventory refuses on a legacy class handler', () => {
    const conn = connection();
    const owners: Record<string, object> = {};
    for (const client of [
      new AdtClientLegacy(conn, logger),
      new AdtExecutorLegacy(conn, logger),
    ]) {
      for (const getter of Object.keys(LEGACY_REFUSED)) {
        const make = (client as unknown as Record<string, unknown>)[getter];
        if (typeof make === 'function') owners[getter] = make.call(client);
      }
    }
    const fromInventory = new Set<string>();
    for (const [getter, rows] of Object.entries(LEGACY_REFUSED)) {
      const handler = owners[getter];
      if (!handler) throw new Error(`No legacy getter ${getter}`);
      if (Object.getPrototypeOf(handler) === Object.prototype) continue;
      for (const member of Object.keys(rows)) {
        if (member.endsWith(']')) continue;
        let proto: object | null = handler;
        while (proto && !Object.hasOwn(proto, member))
          proto = Object.getPrototypeOf(proto);
        const owner = (proto as { constructor?: { name?: string } } | null)
          ?.constructor?.name;
        fromInventory.add(`${owner}.${member}`);
      }
    }
    const fromHelper = REFUSED_WITHOUT_REQUEST.flatMap(
      ([implementation, members]) =>
        members.map(
          (member) => `${(implementation as { name?: string }).name}.${member}`,
        ),
    );
    expect(fromHelper.length).toBeGreaterThan(30);
    expect([...fromHelper].sort()).toEqual([...fromInventory].sort());
  });

  it('hands out the inherited stateless class update on a legacy client', () => {
    const cls = new AdtClientLegacy(connection(), logger, {
      contentTypes: new AdtContentTypesBase(false),
    }).getClass();
    expect(cls.update).toBe(AdtClass.prototype.update);
    expect(integrationHeadersOf(cls, 'update')).toEqual({
      accept: 'text/plain',
      contentType: 'text/plain',
    });
  });

  it('records the measured v1 pair for the function include create on a legacy client', () => {
    const include = new AdtClientLegacy(
      connection(),
      logger,
    ).getFunctionInclude();
    expect(include).toBeInstanceOf(AdtFunctionIncludeLegacy);
    const v1 = 'application/vnd.sap.adt.functions.fincludes+xml';
    expect(integrationHeadersOf(include, 'create')).toEqual({
      accept: v1,
      contentType: v1,
    });
    // The modern client keeps v2.
    expect(
      integrationHeadersOf(
        new AdtClient(connection(), logger).getFunctionInclude(),
        'create',
      ).contentType,
    ).toBe('application/vnd.sap.adt.functions.fincludes.v2+xml');
  });

  it('records the measured unversioned pair for the include create on a legacy client', () => {
    const include = new AdtClientLegacy(connection(), logger).getInclude();
    expect(include).toBeInstanceOf(AdtIncludeLegacy);
    const unversioned = 'application/vnd.sap.adt.programs.includes+xml';
    expect(integrationHeadersOf(include, 'create')).toEqual({
      accept: unversioned,
      contentType: unversioned,
    });
    // The modern client keeps v2.
    expect(
      integrationHeadersOf(
        new AdtClient(connection(), logger).getInclude(),
        'create',
      ).contentType,
    ).toBe('application/vnd.sap.adt.programs.includes.v2+xml');
  });

  it('is the only resolver in the legacy tests that reach SAP', () => {
    expect(
      resolverOffenders(
        join(__dirname, '..', '..'),
        join(
          __dirname,
          '../../../../../adt-clients/src/__tests__/helpers',
          'adtHeaders',
        ),
      ),
    ).toEqual([]);
  });
});
