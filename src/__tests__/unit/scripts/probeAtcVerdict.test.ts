/**
 * What the ATC probe's verdict is allowed to count.
 *
 * The probe is a script rather than library code, and it would normally carry
 * no test. This part does, because the bug it fixes was a *false pass*: on an
 * on-prem run the verdict counted the cloud-scope types, printed `COMPLETE`
 * and exited 0, while `program` and `include` — the two types an on-prem run
 * exists to settle — were probed and then left out of the arithmetic. A reader
 * would have concluded the on-prem question was closed.
 *
 * So the rule under test is narrow and blunt: **a run that has not said what it
 * requires does not get to pass on a system this probe cannot reason about.**
 */

import {
  CANDIDATES,
  exitCodeFor,
  requiredKeysFor,
} from '../../../../scripts/probe-atc';

const silentLogger = () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const CLOUD_KEYS = CANDIDATES.filter((c) => c.scope === 'cloud').map(
  (c) => c.key,
);
const ONPREM_KEYS = CANDIDATES.filter((c) => c.scope === 'onprem').map(
  (c) => c.key,
);

describe('probe-atc — what the verdict counts', () => {
  // The regression. Before the fix this combination produced a clean pass.
  it('refuses to pass on a non-cloud system when nothing was required', () => {
    const logger = silentLogger();

    const result = requiredKeysFor(undefined, false, logger as never);

    expect(result.refuse).toBe(true);
    expect(result.source).toBe('none given');
    // It must also say what to do, not merely fail.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('--require'),
    );
  });

  it('names the on-prem-only types in the advice, since they are the point', () => {
    const logger = silentLogger();

    requiredKeysFor(undefined, false, logger as never);

    const advice = logger.error.mock.calls.map((c) => String(c[0])).join(' ');
    for (const key of ONPREM_KEYS) {
      expect(advice).toContain(key);
    }
  });

  it('on cloud, the default stays what it was and passes', () => {
    const logger = silentLogger();

    const result = requiredKeysFor(undefined, true, logger as never);

    expect(result.refuse).toBe(false);
    expect(result.keys).toEqual(CLOUD_KEYS);
    expect(logger.error).not.toHaveBeenCalled();
  });

  // An explicit set is the caller's statement, and detection does not override
  // it in either direction — that would be the same silent inference again.
  it('an explicit --require is honoured on cloud and on anything else', () => {
    for (const isCloud of [true, false]) {
      const result = requiredKeysFor(
        ['class', 'program'],
        isCloud,
        silentLogger() as never,
      );

      expect(result).toMatchObject({
        keys: ['class', 'program'],
        source: '--require',
        refuse: false,
      });
    }
  });

  it('--require=all is every candidate, on-prem-only ones included', () => {
    // `all` is expanded by the argument parser, so what is asserted here is
    // that the expansion it produces is accepted whole.
    const every = CANDIDATES.map((c) => c.key);

    const result = requiredKeysFor(every, false, silentLogger() as never);

    expect(result.refuse).toBe(false);
    expect(result.keys).toEqual(expect.arrayContaining(ONPREM_KEYS));
  });

  // A typo in --require must not quietly shrink what the run is judged on:
  // requiring `programs` and being told COMPLETE is the original bug wearing a
  // different hat.
  it('an unknown key throws instead of being dropped', () => {
    expect(() =>
      requiredKeysFor(['class', 'programs'], false, silentLogger() as never),
    ).toThrow(/programs/);
  });

  it('the candidate set still holds the two types an on-prem run is for', () => {
    expect(ONPREM_KEYS).toEqual(expect.arrayContaining(['program', 'include']));
  });
});

/**
 * `$?` is what a caller and a CI job read, and it is the half of the fix that
 * a first pass left untested: the refusal was computed, `main` acted on it, and
 * deleting the line that set the exit code broke nothing anyone checked.
 */
describe('probe-atc — the exit code', () => {
  it('a refused run exits non-zero even with everything it counted confirmed', () => {
    expect(exitCodeFor({ unconfirmed: 0, refuse: true })).toBe(1);
  });

  it('an unconfirmed candidate exits non-zero', () => {
    expect(exitCodeFor({ unconfirmed: 1, refuse: false })).toBe(1);
  });

  it('only a run that confirmed what it required, and said so, exits zero', () => {
    expect(exitCodeFor({ unconfirmed: 0, refuse: false })).toBe(0);
  });

  /**
   * **What these tests do not cover**, said out loud rather than left to be
   * discovered: the single line in `main()` that assigns this function's result
   * to `process.exitCode`. `main()` needs a live SAP connection, so no unit
   * test reaches it — replacing that assignment with `process.exitCode = 0`
   * passes everything here. The decision is tested; the wiring is one line, and
   * it is on the reviewer.
   */
});
