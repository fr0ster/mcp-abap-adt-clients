/**
 * What the ATC probe's verdict is made of: the candidate set, the cloud test,
 * and the arithmetic that decides COMPLETE from INCOMPLETE.
 *
 * Its own module because it is the part with a test, and a test that has to
 * import `probe-atc.ts` imports a script — dotenv, a logger and a connection
 * factory, all executed at import — which printed a real dependency error into
 * a unit run that touches nothing and made the test's isolation a fiction.
 * Nothing here reaches outside itself; `ILogger` is a type and erases.
 */

import type { ILogger } from '@mcp-abap-adt/interfaces';

/** A URI template under test, and who proposes it. */
export interface ITemplate {
  /** How this template is referred to in the manifest and in the spec. */
  label: string;
  build: (name: string) => string;
}

/**
 * The types `AtcObjectType` might name, each with the template a client would
 * have to build for it.
 *
 * The list is **required**, not discovered: it is #68's six (the set the spec
 * says must be measured) plus the three the spec adds — DDL source, table and
 * behavior definition — which #68 does not map at all, and which therefore
 * cannot be checked through it even if ATC accepts them.
 *
 * Every template here is the one this repository already uses for that object
 * elsewhere. `include` carries **two**: #68 sends includes to
 * `/programs/programs/`, while the library builds `/programs/includes/`. They
 * cannot both be right, so both are run.
 */
export interface ICandidate {
  key: string;
  /** ADT type codes a package listing may report for this kind. */
  typeCodes: string[];
  /**
   * The `adtcore:type` a worklist uses for this kind — `CLAS`, not `CLAS/OC`.
   * Confirmation compares BOTH this and the name: a run at
   * `/programs/programs/{NAME}` can come back listing a PROG with that name,
   * and matching on the name alone would then confirm `include` on the
   * strength of a program. Raised in review, 2026-08-16.
   */
  worklistTypeCode: string;
  templates: ITemplate[];
  /** Whether #68 maps this type at all. */
  mappedBy68: boolean;
  /**
   * `cloud` — v1 needs this confirmed, and an unconfirmed one fails the probe.
   * `onprem` — the object cannot exist on ABAP Cloud, so this trial can never
   * confirm it. Reported, never counted against the run: the spec ships the
   * cloud-confirmed union and widens it from an on-prem probe.
   */
  scope: 'cloud' | 'onprem';
}

export const CANDIDATES: ICandidate[] = [
  {
    key: 'class',
    worklistTypeCode: 'CLAS',
    scope: 'cloud',
    typeCodes: ['CLAS/OC'],
    templates: [
      { label: 'oo/classes', build: (n) => `/sap/bc/adt/oo/classes/${n}` },
    ],
    mappedBy68: true,
  },
  {
    key: 'interface',
    worklistTypeCode: 'INTF',
    scope: 'cloud',
    typeCodes: ['INTF/OI'],
    templates: [
      {
        label: 'oo/interfaces',
        build: (n) => `/sap/bc/adt/oo/interfaces/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'program',
    worklistTypeCode: 'PROG',
    scope: 'onprem',
    typeCodes: ['PROG/P'],
    templates: [
      {
        label: 'programs/programs',
        build: (n) => `/sap/bc/adt/programs/programs/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'include',
    worklistTypeCode: 'PROG',
    scope: 'onprem',
    typeCodes: ['PROG/I'],
    templates: [
      // #68 sends includes here, to the program URI.
      {
        label: 'programs/programs (as #68 builds it)',
        build: (n) => `/sap/bc/adt/programs/programs/${n}`,
      },
      // The library builds this one for includes everywhere else.
      {
        label: 'programs/includes (as this library builds it)',
        build: (n) => `/sap/bc/adt/programs/includes/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'function_group',
    worklistTypeCode: 'FUGR',
    scope: 'cloud',
    typeCodes: ['FUGR/F', 'FUGR'],
    templates: [
      {
        label: 'functions/groups',
        build: (n) => `/sap/bc/adt/functions/groups/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'package',
    worklistTypeCode: 'DEVC',
    scope: 'cloud',
    typeCodes: ['DEVC/K', 'DEVC'],
    templates: [
      { label: 'packages', build: (n) => `/sap/bc/adt/packages/${n}` },
    ],
    mappedBy68: true,
  },
  {
    key: 'ddl_source',
    worklistTypeCode: 'DDLS',
    scope: 'cloud',
    typeCodes: ['DDLS/DF'],
    templates: [
      {
        label: 'ddic/ddl/sources',
        build: (n) => `/sap/bc/adt/ddic/ddl/sources/${n}`,
      },
    ],
    mappedBy68: false,
  },
  {
    key: 'table',
    worklistTypeCode: 'TABL',
    scope: 'cloud',
    typeCodes: ['TABL/DT'],
    templates: [
      { label: 'ddic/tables', build: (n) => `/sap/bc/adt/ddic/tables/${n}` },
    ],
    mappedBy68: false,
  },
  {
    key: 'behavior_definition',
    worklistTypeCode: 'BDEF',
    scope: 'cloud',
    typeCodes: ['BDEF/BDO'],
    templates: [
      {
        label: 'bo/behaviordefinitions',
        build: (n) => `/sap/bc/adt/bo/behaviordefinitions/${n}`,
      },
    ],
    mappedBy68: false,
  },
];

/**
 * Host suffixes that only ABAP Cloud uses. Deliberately short.
 *
 * A name missing from this list costs one `--require` flag. A name wrongly on
 * it costs a false COMPLETE, which is the failure this whole file is about, so
 * the list only grows against a system somebody has actually seen.
 */
const CLOUD_HOST_SUFFIXES = ['.hana.ondemand.com', '.abap.cloud.sap'];

/**
 * Whether the base URL *proves* this is ABAP Cloud.
 *
 * Not `isCloudEnvironment()`, and the difference is the point. That helper
 * falls back to "does `/sap/bc/adt/core/http/systeminformation` answer" — an
 * endpoint a **modern on-prem serves too**. Using it here would let a 7.5x
 * system be taken for cloud, apply the cloud-only default, and hand back
 * `COMPLETE` with `program` and `include` uncounted: exactly the bug this file
 * was changed to remove, reintroduced through the detector.
 *
 * The asymmetry is deliberate. Refusing on a false negative costs one flag;
 * passing on a false positive costs a wrong answer that reads like a right one.
 * So the permissive branch demands proof, and everything else — an unknown
 * host, an unparseable URL, no URL at all — asks the caller to say what they
 * require.
 */
export function looksUnambiguouslyCloud(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  // Suffix on a host boundary, not `includes`: `ondemand.com.example.org` is
  // somebody else's domain, and a substring test would hand it the cloud path.
  return CLOUD_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Reject a candidate key nobody defines, naming the ones that exist.
 *
 * Called at argument-parse time as well as from `requiredKeysFor`, so a typo
 * costs nothing: on an on-prem system the alternative is connecting, probing,
 * and only then being told the flag was misspelled — and an on-prem session is
 * not cheap to repeat.
 */
export function assertKnownKeys(keys: string[]): void {
  // `--require=` and `--require=,,,` both survive split/trim/filter as an empty
  // array, which is truthy, so it read as an explicit statement — and a run
  // required to confirm nothing confirms it, exits 0 and decides nothing. A
  // caller who passes the flag means to name something.
  if (keys.length === 0) {
    throw new Error(
      `--require was given with no candidate in it. Name at least one, or pass --require=all. Known: ${CANDIDATES.map((c) => c.key).join(', ')}`,
    );
  }
  const unknown = keys.filter((k) => !CANDIDATES.some((c) => c.key === k));
  if (unknown.length) {
    throw new Error(
      `--require names ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is not a candidate' : 'are not candidates'}. Known: ${CANDIDATES.map((c) => c.key).join(', ')}`,
    );
  }
}

/**
 * The candidate keys a run is judged on, and the reason for the choice.
 *
 * The verdict used to count cloud-scope candidates and nothing else. On the
 * trial that was right — a classic program cannot exist on ABAP Cloud, and
 * counting it would have left the probe permanently INCOMPLETE. Run on an
 * **on-prem** system it became a trap: `program` and `include` were probed,
 * reported on a line of their own, and then left out of the verdict, so the
 * probe printed `COMPLETE` and exited 0 on exactly the run whose purpose was
 * to settle them.
 *
 * The fix is not to infer the set from the system. **The caller states what
 * must be confirmed**, and `isCloud` here means *proven* cloud — see
 * `looksUnambiguouslyCloud`, and note that the first attempt at this used
 * `isCloudEnvironment()`, whose endpoint fallback a modern on-prem also
 * answers, which let the trap back in through the detector.
 */
export function requiredKeysFor(
  explicit: string[] | undefined,
  isCloud: boolean,
  logger: ILogger,
): { keys: string[]; source: string; refuse: boolean } {
  if (explicit) {
    assertKnownKeys(explicit);
    return { keys: explicit, source: '--require', refuse: false };
  }

  const cloudKeys = CANDIDATES.filter((c) => c.scope === 'cloud').map(
    (c) => c.key,
  );

  if (isCloud) {
    return {
      keys: cloudKeys,
      source: 'default for a cloud system',
      refuse: false,
    };
  }

  // Not cloud, and nobody said what to require. The honest answer is that this
  // probe does not know which types this system can hold — a 7.40 on-prem has
  // no behaviour definitions, a 7.5x has both those and classic programs — and
  // guessing produces either a false COMPLETE or a permanent INCOMPLETE.
  logger.error(
    'The base URL does not prove this is ABAP Cloud, and --require was not given. It may well be a cloud system under a host this probe does not recognise — that is precisely why it will not decide for you.',
  );
  logger.error(
    `Say what this run must confirm, e.g. --require=${[...cloudKeys, 'program', 'include'].join(',')} on a modern on-prem, or --require=all. Every candidate is probed either way; --require decides what the VERDICT counts.`,
  );
  return { keys: cloudKeys, source: 'none given', refuse: true };
}

/**
 * The exit code, as a value rather than a side effect.
 *
 * Split out because the first version of the refusal was unreachable from a
 * test: `requiredKeysFor` returned `refuse: true` and `main` acted on it, so
 * deleting the line that set the exit code broke nothing that anyone checked.
 * A verdict nobody can act on is the same failure as a verdict that lies —
 * whatever the log says, `$?` is what a caller and a CI job read.
 */
export function exitCodeFor(opts: {
  unconfirmed: number;
  refuse: boolean;
}): 0 | 1 {
  return opts.unconfirmed > 0 || opts.refuse ? 1 : 0;
}

/**
 * The verdict line — the one written into `manifest.json` and read by people.
 *
 * Pure and tested for the same reason `exitCodeFor` is, and it was missed the
 * first time: the exit code became a value while this stayed inline, so a run
 * that refused to judge still wrote `COMPLETE` into the manifest and logged it.
 * The exit code was 1, but `$?` does not survive into an artefact — the string
 * does, and a reader or a consumer of the manifest takes it at its word.
 *
 * So refusal is a verdict of its own, not a footnote under a good one.
 */
export function verdictFor(opts: {
  requiredKeys: string[];
  source: string;
  confirmed: number;
  unconfirmed: { key: string; why: string }[];
  refuse: boolean;
}): string {
  const countedAs = `${opts.requiredKeys.length} required type(s) [${opts.requiredKeys.join(', ')}] — set from ${opts.source}`;
  const unconfirmed = opts.unconfirmed.length
    ? `; unconfirmed: ${opts.unconfirmed.map((o) => `${o.key} [${o.why}]`).join(', ')}`
    : '';

  if (opts.refuse) {
    return `REFUSED — this run did not say what it must confirm, and this system is not one whose type inventory the probe knows. ${opts.confirmed} of ${countedAs} confirmed${unconfirmed}. Nothing here decides the on-prem-only types; re-run with --require.`;
  }

  return opts.unconfirmed.length
    ? `INCOMPLETE — ${opts.confirmed} of ${countedAs}${unconfirmed}`
    : `COMPLETE — all of ${countedAs}`;
}
