/**
 * A create refuses a missing required parameter before it reaches the wire.
 *
 * An object created and never bound to a package is the one thing `delete()`
 * cannot remove: the deletion check resolves through the package, so it reports
 * "Object does not exist" while the name stays taken for good. Cleaning that up
 * is SAP GUI territory, which makes it worth being certain this library cannot
 * produce it.
 *
 * It currently cannot — every handler whose object lives in a package refuses a
 * create without one, before any request is built. This is that fact as a
 * check, because it is the kind of guard a refactor removes quietly: the XML
 * builders make `<adtcore:packageRef>` conditional, so dropping the argument
 * check would not fail a compile, would not fail any other test, and would
 * start posting objects with no package.
 *
 * The object's **name** is checked the same way and for a plainer reason: a
 * create without one addresses the wrong resource, and what it makes there is
 * anybody's guess. Two parameters, both required, neither allowed past the
 * argument list.
 *
 * The subject is the factory return type, like the rest of this folder: a
 * consumer never names the class.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { HANDLERS } from './manifest';

/**
 * Objects whose parent is not a package, so `packageName` is not theirs to
 * require. Each says what it belongs to instead — the point of naming them here
 * rather than skipping quietly is that a new handler must be classified.
 */
const NOT_IN_A_PACKAGE: Record<string, string> = {
  functionModule: 'a function group, via containerRef',
  functionInclude: 'a function group, via containerRef',
  messageClassMessage: 'a message class — it is a row, not an object',
  transport: 'nothing; a transport request is not a package object',
  package: 'a superPackage, which it requires instead',
  localTestClass: 'its container class',
  localTypes: 'its container class',
  localDefinitions: 'its container class',
  localMacros: 'its container class',
};

/** Answers nothing: every create here must refuse before it reaches the wire. */
const refusing = (): IAbapConnection =>
  ({
    makeAdtRequest: async () => {
      throw new Error('a create without a package reached the connection');
    },
  }) as unknown as IAbapConnection;

describe('a create without a package', () => {
  const entries = Object.entries(HANDLERS).filter(([, e]) =>
    Object.hasOwn(e.config as Record<string, unknown>, 'packageName'),
  );

  it('has handlers to check', () => {
    // If the manifest stops carrying packageName, this file silently checks
    // nothing — so the count is asserted rather than assumed.
    expect(entries.length).toBeGreaterThan(15);
  });

  for (const [name, entry] of entries) {
    if (NOT_IN_A_PACKAGE[name]) continue;

    it(`is refused by ${name}, before any request`, async () => {
      const client = new AdtClient(refusing());
      // biome-ignore lint/suspicious/noExplicitAny: the manifest is untyped by design
      const handler = entry.factory(client) as any;
      if (typeof handler.create !== 'function') return;

      const { packageName, ...withoutPackage } = entry.config as Record<
        string,
        unknown
      >;
      expect(packageName).toBeDefined();

      // Either shape is a refusal; what must not happen is a request going out.
      // A throw is what the handlers do today: a missing required argument is
      // the caller's mistake, not a verdict from the server.
      let answered: unknown;
      try {
        answered = await handler.create(withoutPackage);
      } catch (error) {
        expect(String((error as Error).message)).toMatch(/package/i);
        return;
      }
      expect(answered).toHaveProperty('ok', false);
    });
  }
});

describe('a create without the object\u2019s name', () => {
  /**
   * The name lives under a different key in every config — `className`,
   * `ddlName`, `functionGroupName` — so it is found rather than listed: the
   * manifest's `subject` ends in the object's name, and exactly one config
   * value matches it.
   */
  const nameKeyOf = (entry: {
    subject: string;
    config: Record<string, unknown>;
  }): string | undefined => {
    const last = entry.subject.split('/').pop()?.toUpperCase();
    if (!last) return undefined;
    return Object.keys(entry.config).find(
      (k) => String(entry.config[k]).toUpperCase() === last,
    );
  };

  for (const [name, entry] of Object.entries(HANDLERS)) {
    const key = nameKeyOf(entry as never);
    if (!key) continue;

    it(`is refused by ${name}, before any request`, async () => {
      const client = new AdtClient(refusing());
      // biome-ignore lint/suspicious/noExplicitAny: the manifest is untyped by design
      const handler = (entry as any).factory(client) as any;
      if (typeof handler.create !== 'function') return;

      const withoutName = { ...(entry.config as Record<string, unknown>) };
      delete withoutName[key];

      let answered: unknown;
      try {
        answered = await handler.create(withoutName);
      } catch (error) {
        expect(String((error as Error).message)).toMatch(/name|required/i);
        return;
      }
      expect(answered).toHaveProperty('ok', false);
    });
  }
});
