/**
 * The root package's completeness check (`completeness.test.ts` there), held
 * against the legacy client: every factory on `AdtClientLegacy` is in the
 * manifest or in `NOT_HANDLERS` with a reason.
 *
 * `AdtClientLegacy` is walked by its whole prototype chain:
 * `Object.getOwnPropertyNames(AdtClientLegacy.prototype)` lists only what the
 * subclass declares, so the inherited factories would vanish from a check whose
 * entire job is to notice what is missing.
 */

import { factoryOf } from '../../../../../adt-clients/src/__tests__/unit/capabilities/behaviourGuard';
import {
  HANDLERS,
  NOT_HANDLERS,
} from '../../../../../adt-clients/src/__tests__/unit/capabilities/manifest';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

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

describe('capability guard — completeness', () => {
  it('every factory on AdtClientLegacy is accounted for too', () => {
    const claimedFactories = new Set(Object.values(HANDLERS).map(factoryOf));
    const unaccounted = factoryNames(AdtClientLegacy).filter(
      (name) => !claimedFactories.has(name) && !(name in NOT_HANDLERS),
    );

    expect(unaccounted).toEqual([]);
  });
});
