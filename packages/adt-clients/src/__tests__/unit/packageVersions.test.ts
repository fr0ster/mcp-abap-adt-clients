/**
 * A package has no version history, and now says so by having no method.
 *
 * This test used to assert that `getVersions` threw `ADT_UNSUPPORTED_OPERATION`
 * without issuing a request — the best that could be asserted while the method
 * existed. It is gone, so the assertion moves to what replaced it: the class
 * carries neither version method, and `getPackage()`'s declared type never
 * offered them.
 */

import { AdtPackage } from '../../core/package/AdtPackage';

describe('AdtPackage version history (non-source)', () => {
  it('has no version methods at all', () => {
    const pkg = new AdtPackage({} as never);

    expect('getVersions' in pkg).toBe(false);
    expect('getVersionSource' in pkg).toBe(false);
  });

  it('has no activate either — ADT activates no package', () => {
    const pkg = new AdtPackage({} as never);

    expect('activate' in pkg).toBe(false);
  });
});
