/**
 * The recorded answers the conformance check reads, from
 * `corpus/adt/{typestructure,discovery,conformance}/` (corpus README).
 *
 * Files, so read with runtime checks: a sidecar or an index that is not the
 * recorded shape throws, naming the file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type IReleaseAnswers,
  readDiscovery,
  readSourceLinkTypes,
  readTypeStructure,
  readUrimapperUri,
  type SampleAnswer,
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
  /** Why the release has no readable sample, where the index says so. */
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

/** What a sample's urimapper and metadata reads say, read from their answers. */
export function sampleAnswer(
  sample: IIndexedSample,
  urimapper: { readonly status: number; readonly body: string },
  metadata: { readonly status: number; readonly body: string },
): SampleAnswer {
  // A metadata read the system refused is no readable sample (brief: 403).
  if (metadata.status === 403) {
    return {
      readable: false,
      name: sample.name,
      reason: sample.reason ?? 'the metadata read answered 403',
    };
  }
  if (sample.reason !== undefined) {
    return { readable: false, name: sample.name, reason: sample.reason };
  }
  if (urimapper.status !== 200 || metadata.status !== 200) {
    throw new Error(
      `${sample.name}: urimapper answered ${urimapper.status}, metadata ${metadata.status}`,
    );
  }
  return {
    readable: true,
    name: sample.name,
    parent: sample.parent,
    urimapperUri: readUrimapperUri(urimapper.body),
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
