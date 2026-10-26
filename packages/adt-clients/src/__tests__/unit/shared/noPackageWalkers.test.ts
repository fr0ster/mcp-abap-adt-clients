import { AdtUtils } from '../../../core/shared/AdtUtils';

/**
 * A walk is several requests, and `IResultStrategy` takes one answer. A member
 * that cannot be given a reading has already chosen one for the consumer, so
 * the walk belongs to the consumer — assembled over `fetchNodeStructure`, which
 * is a single request and keeps its slot.
 */
describe('AdtUtils', () => {
  const surface = AdtUtils.prototype as unknown as Record<string, unknown>;

  it.each([
    'getPackageContents',
    'getPackageContentsList',
    'getPackageHierarchy',
  ])('no longer offers %s', (name) => {
    expect(surface[name]).toBeUndefined();
  });

  it('still offers the single-request step the walk was built from', () => {
    expect(typeof surface.fetchNodeStructure).toBe('function');
  });
});
