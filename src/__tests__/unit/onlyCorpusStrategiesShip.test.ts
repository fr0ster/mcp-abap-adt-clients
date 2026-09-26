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
    // The verdicts members applied on their own until 23.0.0; each is a
    // strategy in @mcp-abap-adt/adt-strategies now.
    'packageDeletionRefusal',
    'publicationRefusal',
    'validationUnsupported',
    'validationUnavailable',
    'startedRun',
    'testDoublesVerdict',
    'runId',
  ])('no longer exports %s', (name) => {
    expect(api).not.toHaveProperty(name);
  });
});

/**
 * No member substitutes a reading of its own for the caller's.
 *
 * `options?.analyse ?? someReading` was how seven members decided what counts
 * as a failure when the caller had not said, and three more passed a reading
 * with no way to replace it. The error strategy is the caller's, given with
 * the call; a member hands on what it was given, or nothing.
 */
describe("the error strategy is the caller's", () => {
  const { readdirSync, readFileSync, statSync } = require('node:fs');
  const { join } = require('node:path');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name: string) => {
      const full = join(dir, name);
      if (name === '__tests__') return [];
      return statSync(full).isDirectory()
        ? files(full)
        : full.endsWith('.ts')
          ? [full]
          : [];
    });

  it('no file falls back from analyse to a reading of its own', () => {
    const offenders = files(join(__dirname, '../..')).filter((f) =>
      /analyse\s*\?\?/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
