import { AdtUtils } from '../../../core/shared/AdtUtils';

/**
 * Three members read an object's node structure, found the child type's node
 * id, and read that node. Two requests each, so no reading could be given for
 * one — `IResultStrategy` takes a single answer — and the list shape was fixed
 * at `string[]` for every caller.
 *
 * `fetchNodeStructure` is the step they were built from, and it stays.
 */
describe('AdtUtils', () => {
  const surface = AdtUtils.prototype as unknown as Record<string, unknown>;

  it.each([
    'getIncludesList',
    'listFunctionModules',
    'listFunctionGroupIncludes',
  ])('no longer offers %s', (name) => {
    expect(surface[name]).toBeUndefined();
  });

  it('keeps the single-request step and the members beside it', () => {
    expect(typeof surface.fetchNodeStructure).toBe('function');
    expect(typeof surface.getInclude).toBe('function');
    expect(typeof surface.readObjectSource).toBe('function');
  });
});
