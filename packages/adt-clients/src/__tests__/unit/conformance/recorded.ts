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
 *
 * The coverage (the types no entry serves, and the codes that list `CREATE`
 * that no entry creates) is the longer list, in `coverage.json`, by code: the
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
  /** The API, or `*` for a rule judged per code over every entry. */
  readonly api: string;
  readonly code: string;
  /** The conflict's detail, exactly as the check words it. */
  readonly detail: string;
  readonly reason: string;
}

const MESSAGE_OWN_URI =
  'open: the owner decides whether the message reads its own URI';

const FUNCTION_GROUP_SOURCE =
  "open: the owner decides whether the function group serves its source — its metadata document links the group's main program (source/main, text/plain); the table lists no source for FUGR/F";

const JSON_SOURCE =
  'open: the owner decides whether rule source admits the source type the library reads — the document links its source as application/json, not text/plain or untyped';

const TOGGLE_SOURCE =
  'open: the owner decides whether rule source admits the source type the library reads — the document links its source as application/vnd.sap.adt.toggle.content.v2+json, not text/plain or untyped';

const MESSAGE_CLASS_ACCEPT =
  'open: the owner decides how rule metadata-type reads a collection that advertises no app:accept — /sap/bc/adt/messageclass has none on this release, and the library sends the type it measured (200)';

const EMPTY_ACCEPT =
  'open: the owner decides how rule metadata-type reads a collection whose app:accept is empty — the release advertises <app:accept/> for it, and the library sends the type it measured';

const FUNCTION_MODULE_RUN =
  'open: the owner decides whether the library runs and profiles a function module — typestructure lists EXECUTE and PROFILE for FUGR/FF, and no entry lists run or profile';

const CLOUD_PROGRAM_RUN =
  'open: the owner decides whether the library runs and profiles a program on ABAP cloud — typestructure lists EXECUTE and PROFILE for PROG/P, and the cloud table lists neither';

const BASIS_740_RUN =
  'open: the owner decides whether the library runs and profiles a class and a program on SAP_BASIS 7.40 — typestructure lists EXECUTE and PROFILE, and the 7.40 table lists neither';

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
      rule: 'source',
      api: 'scalarFunctionImplementation',
      code: 'DSFI/SFI',
      detail:
        'source listed, the metadata document links no text/plain or untyped source',
      reason: JSON_SOURCE,
    },
    {
      rule: 'metadata-type',
      api: 'messageClass',
      code: 'MSAG/N',
      detail:
        "application/vnd.sap.adt.mc.messageclass+xml is not among /sap/bc/adt/messageclass's app:accept []",
      reason: MESSAGE_CLASS_ACCEPT,
    },
    {
      rule: 'address',
      api: 'messageClassMessage',
      code: 'MSAG/NN',
      detail:
        'the library addresses /sap/bc/adt/messageclass/saplwosa, urimapper answers /sap/bc/adt/messageclass/saplwosa/messages/001',
      reason: MESSAGE_OWN_URI,
    },
    {
      rule: 'metadata-type',
      api: 'featureToggle',
      code: 'FTG2/FT',
      detail:
        "application/vnd.sap.adt.blues.v1+xml is not among /sap/bc/adt/sfw/featuretoggles's app:accept []",
      reason: EMPTY_ACCEPT,
    },
    {
      rule: 'source',
      api: 'featureToggle',
      code: 'FTG2/FT',
      detail:
        'source listed, the metadata document links no text/plain or untyped source',
      reason: TOGGLE_SOURCE,
    },
    {
      rule: 'execute',
      api: '*',
      code: 'FUGR/FF',
      detail: 'EXECUTE listed, no entry runs it',
      reason: FUNCTION_MODULE_RUN,
    },
    {
      rule: 'profile',
      api: '*',
      code: 'FUGR/FF',
      detail: 'PROFILE listed, no entry profiles it',
      reason: FUNCTION_MODULE_RUN,
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
      rule: 'source',
      api: 'scalarFunctionImplementation',
      code: 'DSFI/SFI',
      detail:
        'source listed, the metadata document links no text/plain or untyped source',
      reason: JSON_SOURCE,
    },
    {
      rule: 'metadata-type',
      api: 'messageClass',
      code: 'MSAG/N',
      detail:
        "application/vnd.sap.adt.mc.messageclass+xml is not among /sap/bc/adt/messageclass's app:accept []",
      reason: MESSAGE_CLASS_ACCEPT,
    },
    {
      rule: 'address',
      api: 'messageClassMessage',
      code: 'MSAG/NN',
      detail:
        'the library addresses /sap/bc/adt/messageclass/sapmtran, urimapper answers /sap/bc/adt/messageclass/sapmtran/messages/000',
      reason: MESSAGE_OWN_URI,
    },
    {
      rule: 'metadata-type',
      api: 'enhancement',
      code: 'ENHO/XHH',
      detail:
        "application/vnd.sap.adt.enh.enhoxhh.v3+xml is not among /sap/bc/adt/enhancements/enhoxhh's app:accept []",
      reason: EMPTY_ACCEPT,
    },
    {
      rule: 'execute',
      api: '*',
      code: 'PROG/P',
      detail: 'EXECUTE listed, no entry runs it',
      reason: CLOUD_PROGRAM_RUN,
    },
    {
      rule: 'profile',
      api: '*',
      code: 'PROG/P',
      detail: 'PROFILE listed, no entry profiles it',
      reason: CLOUD_PROGRAM_RUN,
    },
    {
      rule: 'execute',
      api: '*',
      code: 'FUGR/FF',
      detail: 'EXECUTE listed, no entry runs it',
      reason: FUNCTION_MODULE_RUN,
    },
    {
      rule: 'profile',
      api: '*',
      code: 'FUGR/FF',
      detail: 'PROFILE listed, no entry profiles it',
      reason: FUNCTION_MODULE_RUN,
    },
  ],
  'basis-740': [
    {
      rule: 'execute',
      api: '*',
      code: 'CLAS/OC',
      detail: 'EXECUTE listed, no entry runs it',
      reason: BASIS_740_RUN,
    },
    {
      rule: 'profile',
      api: '*',
      code: 'CLAS/OC',
      detail: 'PROFILE listed, no entry profiles it',
      reason: BASIS_740_RUN,
    },
    {
      rule: 'execute',
      api: '*',
      code: 'PROG/P',
      detail: 'EXECUTE listed, no entry runs it',
      reason: BASIS_740_RUN,
    },
    {
      rule: 'profile',
      api: '*',
      code: 'PROG/P',
      detail: 'PROFILE listed, no entry profiles it',
      reason: BASIS_740_RUN,
    },
    {
      rule: 'execute',
      api: '*',
      code: 'FUGR/FF',
      detail: 'EXECUTE listed, no entry runs it',
      reason: FUNCTION_MODULE_RUN,
    },
    {
      rule: 'profile',
      api: '*',
      code: 'FUGR/FF',
      detail: 'PROFILE listed, no entry profiles it',
      reason: FUNCTION_MODULE_RUN,
    },
  ],
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
  return {
    notCreated: codes(field('notCreated'), `${file}: ${release}.notCreated`),
    unserved: codes(field('unserved'), `${file}: ${release}.unserved`),
  };
}
