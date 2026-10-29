/**
 * The recorded answers the conformance check reads, from
 * `corpus/adt/{typestructure,discovery,conformance,abapunit,informationsystem}/`
 * (corpus README).
 *
 * Files, so read with runtime checks: a sidecar or an index that is not the
 * recorded shape throws, naming the file.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAbapUnitMetadata } from './abapUnitConformance';
import {
  type IListedName,
  type ISearchTypeAnswers,
  quickSearchHits,
  readObjectTypesList,
} from './searchTypesConformance';
import {
  type IReleaseAnswers,
  readDiscovery,
  readSourceLinkTypes,
  readTypeStructure,
  readUrimapperUri,
  type SampleAnswer,
  type UrimapperAnswer,
} from './typeTableConformance';

export const CORPUS = join(__dirname, '../../../corpus/adt');

/** The releases the corpus records, and the table each one is held to. */
export const RELEASES = {
  's4-2025': 'onprem',
  'abap-cloud': 'cloud',
  'basis-740': 'basis740',
} as const;

export type RecordedRelease = keyof typeof RELEASES;

/** A recorded exchange's sidecar, as far as the check reads it. */
export interface IRecordedExchange {
  readonly status: number;
  readonly body: string;
  /** The request's `Accept`, `''` where none was sent. */
  readonly accept: string;
  readonly url: string;
  readonly params: Readonly<Record<string, string>> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringRecord(
  value: unknown,
  what: string,
): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error(`${what}: not an object`);
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string')
      throw new Error(`${what}.${key}: not a string`);
    out[key] = item;
  }
  return out;
}

/** A sidecar `.json` and the body it names, both from `dir`. */
export function readExchange(dir: string, sidecar: string): IRecordedExchange {
  const what = join(dir, sidecar);
  const parsed: unknown = JSON.parse(readFileSync(what, 'utf-8'));
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.request) ||
    !isRecord(parsed.response)
  ) {
    throw new Error(`${what}: not a recorded exchange`);
  }
  const { request, response } = parsed;
  const status = response.status;
  const bodyFile = response.bodyFile;
  const url = request.url;
  if (typeof status !== 'number' || typeof url !== 'string') {
    throw new Error(`${what}: no status or url`);
  }
  const headers = stringRecord(request.headers, `${what} request.headers`);
  const body =
    typeof bodyFile === 'string'
      ? readFileSync(join(dir, bodyFile), 'utf-8')
      : '';
  return {
    status,
    body,
    accept: headers?.Accept ?? '',
    url,
    params: stringRecord(request.params, `${what} request.params`),
  };
}

/** One code's entry of `conformance/<release>/_index.json`. */
export interface IIndexedSample {
  readonly name: string;
  readonly parent: string | null;
  /**
   * Why a read of the sample has no answer to hold to, where the index says
   * so: the metadata read refused (no readable sample), or the release has no
   * urimapper (rule `address` not run).
   */
  readonly reason: string | undefined;
  readonly files: {
    readonly template: string;
    readonly urimapper: string;
    readonly metadata: string;
  };
}

/** `conformance/<release>/_index.json`, by code; `undefined` when the release has none. */
export function readSampleIndex(
  release: string,
): ReadonlyMap<string, IIndexedSample> | undefined {
  const file = join(CORPUS, 'conformance', release, '_index.json');
  if (!existsSync(file)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
  if (!isRecord(parsed) || !isRecord(parsed.codes)) {
    throw new Error(`${file}: no codes`);
  }
  const samples = new Map<string, IIndexedSample>();
  for (const [code, value] of Object.entries(parsed.codes)) {
    const what = `${file} ${code}`;
    if (!isRecord(value) || !isRecord(value.sample)) {
      throw new Error(`${what}: no sample`);
    }
    const { name, parent } = value.sample;
    const files = stringRecord(value.files, `${what} files`);
    if (
      typeof name !== 'string' ||
      !(parent === null || typeof parent === 'string') ||
      !files?.template ||
      !files.urimapper ||
      !files.metadata
    ) {
      throw new Error(`${what}: sample or files not the recorded shape`);
    }
    const reason = value.reason;
    if (reason !== undefined && typeof reason !== 'string') {
      throw new Error(`${what}: reason not a string`);
    }
    samples.set(code, {
      name,
      parent,
      reason,
      files: {
        template: files.template,
        urimapper: files.urimapper,
        metadata: files.metadata,
      },
    });
  }
  return samples;
}

/**
 * What a sample's urimapper and metadata reads say, read from their answers —
 * each read on its own.
 *
 * - The metadata read: `200` is a readable sample (rule `source` runs); `403`
 *   or `404` is no readable sample, and no sample rule runs; anything else
 *   throws.
 * - The urimapper read, for a readable sample: `200` is the address to hold
 *   the library's to (rule `address` runs); anything else needs the index's
 *   `reason` — SAP_BASIS 7.40 has no urimapper — and rule `address` is not run
 *   for it, stated by that reason; without one it throws.
 */
export function sampleAnswer(
  sample: IIndexedSample,
  urimapper: { readonly status: number; readonly body: string },
  metadata: { readonly status: number; readonly body: string },
): SampleAnswer {
  if (metadata.status === 403 || metadata.status === 404) {
    return {
      readable: false,
      name: sample.name,
      reason: sample.reason ?? `the metadata read answered ${metadata.status}`,
    };
  }
  if (metadata.status !== 200) {
    throw new Error(`${sample.name}: metadata answered ${metadata.status}`);
  }
  let address: UrimapperAnswer;
  if (urimapper.status === 200) {
    if (sample.reason !== undefined) {
      throw new Error(
        `${sample.name}: the index gives a reason, but urimapper and metadata both answered 200`,
      );
    }
    address = { answered: true, uri: readUrimapperUri(urimapper.body) };
  } else if (sample.reason !== undefined) {
    address = { answered: false, reason: sample.reason };
  } else {
    throw new Error(
      `${sample.name}: urimapper answered ${urimapper.status}, and the index gives no reason`,
    );
  }
  return {
    readable: true,
    name: sample.name,
    parent: sample.parent,
    urimapper: address,
    sourceLinkTypes: readSourceLinkTypes(metadata.body),
  };
}

/** Everything a release recorded, as the check reads it. */
export function recordedAnswers(release: RecordedRelease): IReleaseAnswers {
  const typestructure = readExchange(
    join(CORPUS, 'typestructure'),
    `system-description-${release}--07-typestructure.json`,
  );
  const discovery = readExchange(
    join(CORPUS, 'discovery'),
    `system-description-${release}--03-discovery.json`,
  );
  const index = readSampleIndex(release);
  let samples: Map<string, SampleAnswer> | undefined;
  if (index) {
    const dir = join(CORPUS, 'conformance', release);
    samples = new Map();
    for (const [code, sample] of index) {
      samples.set(
        code,
        sampleAnswer(
          sample,
          readExchange(dir, sample.files.urimapper),
          readExchange(dir, sample.files.metadata),
        ),
      );
    }
  }
  return {
    types: readTypeStructure(typestructure.body),
    collections: readDiscovery(discovery.body),
    samples,
  };
}

/**
 * The codes a release's recorded `GET /abapunit/metadata` lists
 * (`abapunit/<release>/`); `undefined` where the release has no answer —
 * SAP_BASIS 7.40 has no such endpoint. A recorded answer that is not a `200`
 * throws.
 */
export function recordedAbapUnitMetadata(
  release: RecordedRelease,
): string[] | undefined {
  const dir = join(CORPUS, 'abapunit', release);
  const sidecar = 'abapunit-metadata--01-metadata.json';
  if (!existsSync(join(dir, sidecar))) return undefined;
  const exchange = readExchange(dir, sidecar);
  if (exchange.status !== 200) {
    throw new Error(
      `${join(dir, sidecar)}: answered ${exchange.status}, not 200`,
    );
  }
  return readAbapUnitMetadata(exchange.body);
}

/** The step tag of a release's recorded object types list. */
const OBJECT_TYPES_STEP = 'objecttypes';
/** The step tag of a recorded quick search. */
const QUICK_SEARCH_STEP = 'quick-search';

/**
 * What a release recorded for the search names
 * (`informationsystem/<release>/`): the `<case>--<stepTag>` of every
 * exchange — the evidence names it holds —, the object types list where it
 * answered `200`, and each quick search's filter with its hit count. A
 * sidecar that is not the recorded shape, a list answered with another
 * status than `200` or `404`, or a quick search that is no `200` throws.
 */
export function recordedSearchTypes(
  release: RecordedRelease,
): ISearchTypeAnswers {
  const dir = join(CORPUS, 'informationsystem', release);
  const evidence = new Set<string>();
  let listed: ReadonlyMap<string, IListedName> | undefined;
  const searches = new Map<string, number>();
  for (const sidecar of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const what = join(dir, sidecar);
    const parsed: unknown = JSON.parse(readFileSync(what, 'utf-8'));
    if (
      !isRecord(parsed) ||
      typeof parsed.case !== 'string' ||
      typeof parsed.stepTag !== 'string'
    ) {
      throw new Error(`${what}: no case or stepTag`);
    }
    evidence.add(`${parsed.case}--${parsed.stepTag}`);
    const exchange = readExchange(dir, sidecar);
    if (parsed.stepTag === OBJECT_TYPES_STEP) {
      if (exchange.status === 200) {
        listed = readObjectTypesList(exchange.body);
      } else if (exchange.status !== 404) {
        throw new Error(`${what}: answered ${exchange.status}`);
      }
    } else if (parsed.stepTag === QUICK_SEARCH_STEP) {
      const name = exchange.params?.objectType;
      if (exchange.status !== 200 || !name) {
        throw new Error(`${what}: not a 200 with an objectType`);
      }
      if (searches.has(name)) throw new Error(`${what}: ${name} twice`);
      searches.set(name, quickSearchHits(exchange.body));
    } else {
      throw new Error(`${what}: step ${parsed.stepTag} is no search step`);
    }
  }
  return { evidence, listed, searches };
}
