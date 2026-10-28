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

const FUNCTION_GROUP_SOURCE =
  "open: the function group's source/main answers 200 text/plain (the function pool's main program, measured 2026-10-29 on both releases); the table lists no source — interfaces-adt patch pending the owner";

/** Per release, every conflict the check reports against its recorded answers. */
export const DIVERGENCES: { readonly [R in RecordedRelease]: IDivergence[] } = {
  's4-2025': [
    {
      rule: 'source',
      api: 'functionGroup',
      code: 'FUGR/F',
      detail:
        'source not listed, the metadata document links a text/plain or untyped source',
      reason: FUNCTION_GROUP_SOURCE,
    },
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
      rule: 'source',
      api: 'functionGroup',
      code: 'FUGR/F',
      detail:
        'source not listed, the metadata document links a text/plain or untyped source',
      reason: FUNCTION_GROUP_SOURCE,
    },
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
 * The samples with no readable answer: their metadata read answered 403, so
 * the sample-based rules (`address`, `source`) are not asserted for them.
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
