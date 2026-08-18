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
  assertKnownKeys,
  CANDIDATES,
  exitCodeFor,
  looksUnambiguouslyCloud,
  requiredKeysFor,
  verdictFor,
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

/**
 * The permissive branch — "this is cloud, so the cloud default is safe" — is
 * the only way back to a false COMPLETE, so what opens it has to be proof.
 *
 * The first version used `isCloudEnvironment()`, which falls back to asking
 * whether `/sap/bc/adt/core/http/systeminformation` answers. A **modern
 * on-prem serves that endpoint too**, so a 7.5x system could be taken for
 * cloud, get the cloud-only default, and hand back COMPLETE with `program` and
 * `include` uncounted. The detector would have reintroduced the exact bug.
 */
describe('probe-atc — what counts as proof of cloud', () => {
  it.each([
    'https://abc.abap.eu10.hana.ondemand.com',
    'https://x.abap.us21.hana.ondemand.com/sap/bc/adt',
    'https://tenant.abap.cloud.sap',
  ])('%s is proof', (url) => {
    expect(looksUnambiguouslyCloud(url)).toBe(true);
  });

  it.each([
    // A modern on-prem, which is what makes the endpoint fallback unusable.
    ['https://e19.corp.example:44300', 'on-prem host'],
    ['http://sap-dev:8000', 'on-prem host with a port'],
    // A host that merely *contains* a cloud domain. `includes` would pass it.
    ['https://hana.ondemand.com.attacker.example', 'suffix only as substring'],
    ['https://notondemand.com', 'no dot boundary'],
    ['not a url at all', 'unparseable'],
    ['', 'empty'],
  ])('%s is not proof (%s)', (url) => {
    expect(looksUnambiguouslyCloud(url)).toBe(false);
  });

  it('no URL at all is not proof', () => {
    expect(looksUnambiguouslyCloud(undefined)).toBe(false);
  });

  // The consequence, stated as its own case: not-proof plus no --require is a
  // refusal, which is what keeps an unrecognised cloud host safe rather than
  // silently judged.
  it('an unrecognised host without --require refuses instead of defaulting', () => {
    const url = 'https://some-new-cloud-host.example';

    const result = requiredKeysFor(
      undefined,
      looksUnambiguouslyCloud(url),
      silentLogger() as never,
    );

    expect(result.refuse).toBe(true);
  });
});

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

  // `--require=` and `--require=,,,` both reach here as `[]`, which is truthy,
  // so they read as an explicit statement. A run required to confirm nothing
  // confirms it and exits 0 — a clean pass that decided nothing, which is the
  // bug this whole change exists to remove, reachable by a stray keystroke.
  it.each([
    [[] as string[]],
    [[''] as string[]],
  ])('an empty --require (%p after trimming) throws rather than requiring nothing', (keys) => {
    const cleaned = keys.map((k) => k.trim()).filter(Boolean);

    expect(() => assertKnownKeys(cleaned)).toThrow(/no candidate/i);
    expect(() =>
      requiredKeysFor(cleaned, false, silentLogger() as never),
    ).toThrow(/no candidate/i);
  });

  it('the candidate set still holds the two types an on-prem run is for', () => {
    expect(ONPREM_KEYS).toEqual(expect.arrayContaining(['program', 'include']));
  });
});

/**
 * The verdict string is what goes into `manifest.json` and what a person reads.
 * It needs its own tests because the first pass at this fix gave the exit code
 * a pure function and left this inline: a refusing run still wrote `COMPLETE`
 * into the artefact. An exit code does not survive into a file; the string does.
 */
describe('probe-atc — the verdict line', () => {
  const base = {
    requiredKeys: ['class', 'interface'],
    source: '--require',
    confirmed: 2,
    unconfirmed: [],
    refuse: false,
  };

  it('a refusing run is never COMPLETE, even with everything it counted confirmed', () => {
    const verdict = verdictFor({
      ...base,
      source: 'none given',
      refuse: true,
    });

    expect(verdict).not.toMatch(/COMPLETE/);
    expect(verdict).toMatch(/^REFUSED/);
    // And it says how to get an answer, not merely that it has none.
    expect(verdict).toContain('--require');
  });

  it('a refusing run still reports what it did confirm, rather than hiding it', () => {
    const verdict = verdictFor({
      ...base,
      source: 'none given',
      refuse: true,
    });

    expect(verdict).toContain('2 of 2 required type(s)');
  });

  it('COMPLETE names the counted set, so it cannot be read wider than it is', () => {
    const verdict = verdictFor(base);

    expect(verdict).toMatch(/^COMPLETE/);
    expect(verdict).toContain('[class, interface]');
    expect(verdict).toContain('set from --require');
  });

  it('INCOMPLETE names each unconfirmed candidate and why', () => {
    const verdict = verdictFor({
      ...base,
      confirmed: 1,
      unconfirmed: [{ key: 'interface', why: 'never asked' }],
    });

    expect(verdict).toMatch(/^INCOMPLETE/);
    expect(verdict).toContain('interface [never asked]');
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
