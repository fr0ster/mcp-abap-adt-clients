/**
 * What the conformance check is expected to find, committed beside it
 * (spec 4; `typeTablesConformance.test.ts`, and the live check in
 * `integration/shared/typeTablesConformance.test.ts`).
 *
 * **Known divergences are data, never silent skips.** Each entry is a conflict
 * the check reports against the recorded answers, kept with the reason it
 * stands. An entry whose reason starts `open:` waits for the owner's decision;
 * the library is not changed to make it pass. A finding that is fixed — in the
 * table, the library or the answer — fails the test until its entry is
 * removed here, and a new one fails it until it is entered with its reason.
 * The others are the owner's rulings, stated in their reason.
 *
 * The coverage (the types no entry serves, the codes that list `CREATE` that
 * no entry creates, and those that list `EXECUTE` or `PROFILE` that no entry
 * runs or profiles) is the longer list, in `coverage.json`, by code: the
 * labels the check reports with them are the system's text, read from the
 * answer, and are not copied here.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordedRelease } from '../../helpers/recordedConformance';
import type { SearchTypeRule } from '../../helpers/searchTypesConformance';
import type { ConformanceRule } from '../../helpers/typeTableConformance';

/** A conflict the check reports and the reason it stands. */
export interface IDivergence {
  readonly rule: ConformanceRule;
  /** The API the entry is. */
  readonly api: string;
  readonly code: string;
  /** The conflict's detail, exactly as the check words it. */
  readonly detail: string;
  readonly reason: string;
}

const MESSAGE_OWN_URI =
  'the message\'s own address answers a GET with an empty <msg:message msg:msgno="" msg:msgtext=""/> even for a message number that does not exist; the message\'s content is only in the class document; measured on S/4HANA 2025 and ABAP cloud 2026-10-29 (owner: the library reads it from the class); by code: the route /messageclass/{mc_name}/messages/{msg_no} is CL_ADT_MSG_ATOM_RES_CONT, whose do_get reads only the short text (CL_ADT_MESSAGE_CLASS_API=>READ, no IV_FETCH_ALL) and serialises it with ST_ADT_MESSAGE, whose template writes msg:msgno and msg:msgtext with no tt:value — always empty; message 000 is initial as symsgno, so no body';

/** Per release, every conflict the check reports against its recorded answers. */
export const DIVERGENCES: { readonly [R in RecordedRelease]: IDivergence[] } = {
  's4-2025': [
    {
      rule: 'address',
      api: 'messageClassMessage',
      code: 'MSAG/NN',
      detail:
        'the library addresses /sap/bc/adt/messageclass/saplwosa, urimapper answers /sap/bc/adt/messageclass/saplwosa/messages/001',
      reason: MESSAGE_OWN_URI,
    },
  ],
  'abap-cloud': [
    {
      rule: 'address',
      api: 'messageClassMessage',
      code: 'MSAG/NN',
      detail:
        'the library addresses /sap/bc/adt/messageclass/sapmtran, urimapper answers /sap/bc/adt/messageclass/sapmtran/messages/000',
      reason: MESSAGE_OWN_URI,
    },
  ],
  'basis-740': [],
};

/**
 * Rule 7, listed apart: the codes an entry creates whose type does not list
 * `CREATE`. `CREATE` reflects what ADT's own create resource offers; these
 * types are created through their own collection (spec 1.2), so the list
 * explains, it does not fill.
 */
export const CREATE_WITHOUT_CAPABILITY: {
  readonly [R in RecordedRelease]: readonly string[];
} = {
  's4-2025': [
    'AUTH',
    'BDEF/BDO',
    'DDLS/DF',
    'DDLX/EX',
    'DSFD/SCF',
    'DSFI/SFI',
    'ENHO/XHB',
    'ENHO/XHH',
    'ENHS/XSB',
    'FTG2/FT',
    'MSAG/NN',
    'SRVB/SVB',
    'SRVD/SRV',
  ],
  'abap-cloud': [
    'AUTH',
    'BDEF/BDO',
    'DDLS/DF',
    'DDLX/EX',
    'DSFD/SCF',
    'DSFI/SFI',
    'ENHO/XHB',
    'ENHO/XHH',
    'ENHS/XSB',
    'MSAG/NN',
    'SRVB/SVB',
    'SRVD/SRV',
  ],
  'basis-740': ['DDLS/DF', 'MSAG/NN'],
};

/**
 * Rule 10, listed apart: the collections whose recorded `discovery` advertises
 * no `app:accept` for a code whose entry lists `updateMetadata` — the media
 * type the library sends there is checked against nothing the release says.
 * A recorded answer that loses (or gains) a collection's `app:accept` changes
 * this list, and the check fails until it is edited here.
 */
export const METADATA_TYPE_UNADVERTISED: {
  readonly [R in RecordedRelease]: readonly string[];
} = {
  's4-2025': ['/sap/bc/adt/messageclass', '/sap/bc/adt/sfw/featuretoggles'],
  'abap-cloud': [
    '/sap/bc/adt/enhancements/enhoxhh',
    '/sap/bc/adt/messageclass',
  ],
  // SAP_BASIS 7.40 SP04's discovery advertises no app:accept at all.
  'basis-740': ['/sap/bc/adt/functions/groups'],
};

/**
 * The samples with no readable answer: their metadata read answered 403 (or
 * 404), so the sample-based rules (`address`, `source`) are not asserted for
 * them. A sample whose metadata was read is readable, with or without a
 * urimapper answer (`ADDRESS_NOT_RUN`).
 */
export const NO_READABLE_SAMPLE: {
  readonly [R in RecordedRelease]: Readonly<Record<string, string>>;
} = {
  's4-2025': {},
  'abap-cloud': {
    'ENHO/XHH': 'no readable sample: every candidate answered 403',
    'FTG2/FT': 'no readable sample: every candidate answered 403',
  },
  'basis-740': {},
};

/**
 * Why SAP_BASIS 7.40 has no urimapper answer, as its `_index.json` gives it
 * for every code.
 */
const NO_URIMAPPER_740 =
  "SAP_BASIS 7.40 has no /sap/bc/adt/vit/urimapper: discovery does not list it and a GET answers 404 'No application class found for URI' (text/plain), so there is no urimapper answer to hold the library's address to";

/**
 * The readable samples with no urimapper answer: rule `address` is not
 * applicable there and is not run, for the reason given; rule `source` is.
 * The urimapper is asked only of the newer releases (spec 4, rule 5).
 */
export const ADDRESS_NOT_RUN: {
  readonly [R in RecordedRelease]: Readonly<Record<string, string>>;
} = {
  's4-2025': {},
  'abap-cloud': {},
  'basis-740': Object.fromEntries(
    [
      'CLAS/OC',
      'DDLS/DF',
      'FUGR/F',
      'FUGR/FF',
      'FUGR/I',
      'INTF/OI',
      'MSAG/N',
      'MSAG/NN',
      'PROG/I',
      'PROG/P',
    ].map((code) => [code, NO_URIMAPPER_740]),
  ),
};

/** The coverage of one release, as `coverage.json` records it. */
export interface IRecordedCoverage {
  readonly notCreated: readonly string[];
  readonly unserved: readonly string[];
  /** Codes whose type lists `EXECUTE` / `PROFILE` that no entry uses, with those. */
  readonly capabilityNotUsed: Readonly<Record<string, readonly string[]>>;
}

/** A list of codes, read from the file. */
function codes(value: unknown, what: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((code): code is string => typeof code === 'string')
  ) {
    throw new Error(`${what} is not a list of codes`);
  }
  return value;
}

/** `coverage.json`, read with the checks a file needs. */
export function recordedCoverage(release: RecordedRelease): IRecordedCoverage {
  const file = join(__dirname, 'coverage.json');
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
  const entry: unknown =
    parsed && typeof parsed === 'object'
      ? Object.getOwnPropertyDescriptor(parsed, release)?.value
      : undefined;
  if (!entry || typeof entry !== 'object') {
    throw new Error(`${file}: no coverage for ${release}`);
  }
  const field = (name: string): unknown =>
    Object.getOwnPropertyDescriptor(entry, name)?.value;
  const unused = field('capabilityNotUsed');
  if (!unused || typeof unused !== 'object') {
    throw new Error(`${file}: ${release}.capabilityNotUsed is not an object`);
  }
  const capabilityNotUsed: Record<string, string[]> = {};
  for (const [code, value] of Object.entries(unused)) {
    capabilityNotUsed[code] = codes(
      value,
      `${file}: ${release}.capabilityNotUsed.${code}`,
    );
  }
  return {
    notCreated: codes(field('notCreated'), `${file}: ${release}.notCreated`),
    unserved: codes(field('unserved'), `${file}: ${release}.unserved`),
    capabilityNotUsed,
  };
}

/**
 * Why a 7.40 search name answered no hit in its recorded search, though it
 * selects: the recorded searches ask for one hit (`maxResults=1`); the
 * unrecorded run of the same day with `maxResults=200` answered 197 `PROG/P`
 * hits for `PROG` and 199 `FUGR/F` hits for `FUGR`, fewer than the 200 asked.
 * Inference: the server caps the hits before it filters them by type, and the
 * one hit the capped search took was of another type.
 */
const CAPPED_TO_NOTHING =
  "open: the recorded quick search (query=*, maxResults=1) answered no hit; the measurement behind ADT_SEARCH_TYPES_BASIS_740 (maxResults=200, 2026-10-29, not recorded) answered hits of the name's own type; to record the search again with more hits, or to keep the name on the unrecorded measurement (owner)";

/** A search-name conflict the check reports and the reason it stands. */
export interface ISearchTypeDivergence {
  readonly rule: SearchTypeRule;
  readonly name: string;
  readonly detail: string;
  readonly reason: string;
}

/** Per release, every search-name conflict the check reports (spec 3.6). */
export const SEARCH_TYPE_DIVERGENCES: {
  readonly [R in RecordedRelease]: readonly ISearchTypeDivergence[];
} = {
  's4-2025': [],
  'abap-cloud': [],
  'basis-740': [
    {
      rule: 'no-hits',
      name: 'FUGR',
      detail: 'the recorded search for FUGR answered no hit',
      reason: CAPPED_TO_NOTHING,
    },
    {
      rule: 'no-hits',
      name: 'PROG',
      detail: 'the recorded search for PROG answered no hit',
      reason: CAPPED_TO_NOTHING,
    },
  ],
};
