/**
 * Check 2 — every factory is accounted for, in both directions.
 *
 * This is what stops a new object type, copied from an existing one, arriving
 * unchecked. Package exports are not the registry to compare against: 18 of the
 * 37 factories return a class the package root exports, and the other 19 return
 * a type only. The registry is the list of factories itself.
 *
 * `AdtClientLegacy` is walked too, and by its whole prototype chain:
 * `Object.getOwnPropertyNames(AdtClientLegacy.prototype)` lists only what the
 * subclass declares, so the inherited factories would vanish from a check whose
 * entire job is to notice what is missing.
 */

import { AdtClient } from '../../../clients/AdtClient';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import type { HandlerEntry } from './manifest';
import { HANDLERS, NOT_HANDLERS } from './manifest';

/** Every `get*` on the prototype chain, subclass overrides included. */
function factoryNames(ctor: { prototype: object }): string[] {
  const names = new Set<string>();
  let proto: object | null = ctor.prototype;
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name.startsWith('get')) names.add(name);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return [...names].sort();
}

/** The factory each manifest entry names, read back out of its closure. */
const claimedFactories = new Set(
  Object.values(HANDLERS).map((entry) => {
    const source = entry.factory.toString();
    const match = source.match(/\.(get\w+)\(/);
    if (!match) {
      throw new Error(`Manifest entry does not name a factory: ${source}`);
    }
    return match[1];
  }),
);

describe('capability guard — completeness', () => {
  it('every factory on AdtClient is in the manifest or in NOT_HANDLERS with a reason', () => {
    const unaccounted = factoryNames(AdtClient).filter(
      (name) => !claimedFactories.has(name) && !(name in NOT_HANDLERS),
    );

    expect(unaccounted).toEqual([]);
  });

  it('every factory on AdtClientLegacy is accounted for too', () => {
    const unaccounted = factoryNames(AdtClientLegacy).filter(
      (name) => !claimedFactories.has(name) && !(name in NOT_HANDLERS),
    );

    expect(unaccounted).toEqual([]);
  });

  it('every manifest entry names a factory that exists', () => {
    const existing = new Set(factoryNames(AdtClient));
    const missing = [...claimedFactories].filter((name) => !existing.has(name));

    expect(missing).toEqual([]);
  });

  it('nothing is excluded without a written reason', () => {
    for (const [name, reason] of Object.entries(NOT_HANDLERS)) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(20);
      expect(claimedFactories.has(name)).toBe(false);
    }
  });

  it('every entry claims at least one capability, and a narrow one says why', () => {
    // A capability this package refuses is a claim about ADT, and a claim
    // about ADT with no reason beside it is the kind of thing this whole plan
    // exists to remove. Entries that carry the full set need no note.
    const narrowWithoutReason = Object.entries(
      HANDLERS as Record<string, HandlerEntry>,
    )
      .filter(([, e]) => e.capabilities.length < 10 && !e.why?.trim())
      .map(([name]) => name);

    expect(narrowWithoutReason).toEqual([]);
    for (const entry of Object.values(HANDLERS)) {
      expect(entry.capabilities.length).toBeGreaterThan(0);
    }
  });
});
