import * as api from '../../index';

/**
 * This package ships the strategies a consumer needs to collect a corpus of
 * responses, and no reading that turns one into a verdict. Interpreting those
 * responses is the consumer's, built from their own corpus.
 */
describe('the public surface', () => {
  const surface = api as unknown as Record<string, unknown>;

  it('offers the corpus readings', () => {
    expect(typeof surface.rawDocument).toBe('function');
    expect(typeof surface.wireItself).toBe('function');
  });

  it.each([
    'validationRefusal',
    'activationRefusal',
    'deletionRefusal',
    'parseCheckRunResponse',
    'parseDeletionCheck',
    'assertDeletable',
    'assertActivationSucceeded',
    'withRefusalDetection',
    'DeletionNotPermittedError',
  ])('no longer exports %s', (name) => {
    expect(api).not.toHaveProperty(name);
  });
});
