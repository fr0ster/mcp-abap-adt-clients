/**
 * The conformance check of the ADT type tables (spec 4): what a release's
 * `typestructure`, `discovery` and per-sample `urimapper` and metadata answers
 * say, held against one table of `@mcp-abap-adt/interfaces-adt`.
 *
 * The answers are read here from their text — recorded in the corpus or read
 * live — so the same check runs in CI (`unit/conformance`) and on a system
 * (`integration/shared/typeTablesConformance`). Nothing here decides what a
 * finding means: a conflict is reported with its rule, and the tests compare
 * what is found with the committed divergence list and the recorded coverage.
 *
 * The answers are data from outside the type system, so they are read with
 * runtime checks: a document that is not the expected shape throws, naming it.
 * The tables are typed and read as typed.
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  type AdtApiName,
  type AdtApiTable,
  type AdtOperation,
  type AdtTypeCode,
  type EnhancementType,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { AdtClient } from '../../clients/AdtClient';
import {
  type AdtAddressableCode,
  NO_OWN_ADDRESS,
  PARENTED_SEGMENT,
} from '../../endpoints/codes';
import { buildObjectUri } from '../../utils/activationUtils';
import { integrationHeadersOf } from './adtHeaders';
import { isAdtTypeCode } from './typeCode';
import { attributeOf, elementsNamed, textOf } from './xmlTree';

// ---------------------------------------------------------------------------
// The answers
// ---------------------------------------------------------------------------

/** One `SEU_ADT_OBJECT_TYPE_DESCRIPTOR` of `typestructure`. */
export interface ITypeDescriptor {
  readonly code: string;
  readonly label: string;
  /** `PARENT_OBJECT_TYPE`; `''` where the element is empty. */
  readonly parent: string;
  readonly nameMaxLength: number;
  /** `CAPABILITIES`: `EXECUTE`, `PROFILE`, `CREATE`, … */
  readonly capabilities: ReadonlySet<string>;
}

/** A `templateLink` of a discovery collection. */
export interface ITemplateLink {
  readonly template: string;
  /** Its `type` attribute; `''` where it has none. */
  readonly type: string;
}

/** One collection `href` of `discovery`, every workspace that names it merged. */
export interface ICollection {
  /** The non-empty `app:accept` values. */
  readonly accepts: readonly string[];
  readonly templateLinks: readonly ITemplateLink[];
}

/** What one sample object's reads answered. */
export type SampleAnswer =
  | {
      readonly readable: true;
      readonly name: string;
      readonly parent: string | null;
      /** `adtcore:uri` of the `urimapper` answer. */
      readonly urimapperUri: string;
      /**
       * The media types of the metadata document's `…/relations/source`
       * links, `''` for an untyped one (rule `source`).
       */
      readonly sourceLinkTypes: readonly string[];
    }
  | {
      readonly readable: false;
      readonly name: string;
      /** Why the sample-based rules are not run for it. */
      readonly reason: string;
    };

/** What one release answered, as the check reads it. */
export interface IReleaseAnswers {
  readonly types: ReadonlyMap<string, ITypeDescriptor>;
  readonly collections: ReadonlyMap<string, ICollection>;
  /**
   * Per code, its sample — or `undefined` where the release has no recorded
   * samples, and the sample-based rules (`address`, `source`) are not run.
   * A code of the table missing from a given map is a conflict (`sample`).
   */
  readonly samples: ReadonlyMap<string, SampleAnswer> | undefined;
}

/** An ADT document as a tree: prefixes dropped, attributes `@_name`, text kept as text. */
export function parseAnswer(text: string, what: string): unknown {
  const valid = XMLValidator.validate(text);
  if (valid !== true) {
    throw new Error(
      `${what} is not XML: ${valid.err.msg} (line ${valid.err.line})`,
    );
  }
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    // A code, a label, a length: read as written, never as a number.
    parseTagValue: false,
  }).parse(text);
}

/** `POST /repository/typestructure`, by code. A repeated code throws. */
export function readTypeStructure(
  xml: string,
): ReadonlyMap<string, ITypeDescriptor> {
  const tree = parseAnswer(xml, 'typestructure');
  const types = new Map<string, ITypeDescriptor>();
  for (const descriptor of elementsNamed(
    tree,
    'SEU_ADT_OBJECT_TYPE_DESCRIPTOR',
  )) {
    const code = textOf(descriptor, 'OBJECT_TYPE');
    if (!code)
      throw new Error('typestructure: a descriptor without OBJECT_TYPE');
    if (types.has(code)) throw new Error(`typestructure: ${code} twice`);
    const length = textOf(descriptor, 'OBJNAME_MAXLENGTH');
    const nameMaxLength = Number(length);
    if (!Number.isInteger(nameMaxLength)) {
      throw new Error(`typestructure: ${code} OBJNAME_MAXLENGTH '${length}'`);
    }
    // 7.40 has no CAPABILITIES element where the type has none: read as none.
    const lists = elementsNamed(descriptor, 'CAPABILITIES');
    if (lists.length > 1) {
      throw new Error(
        `typestructure: ${code} has ${lists.length} CAPABILITIES`,
      );
    }
    const capabilities = lists.flatMap((list) =>
      elementsNamed(list, 'SEU_ACTION').map((action) => textOf(action)),
    );
    types.set(code, {
      code,
      label: textOf(descriptor, 'OBJECT_TYPE_LABEL'),
      parent: textOf(descriptor, 'PARENT_OBJECT_TYPE'),
      nameMaxLength,
      capabilities: new Set(capabilities),
    });
  }
  if (types.size === 0) throw new Error('typestructure: no descriptor');
  return types;
}

/** `GET /discovery`, by collection `href`. */
export function readDiscovery(xml: string): ReadonlyMap<string, ICollection> {
  const tree = parseAnswer(xml, 'discovery');
  const merged = new Map<
    string,
    { accepts: string[]; templateLinks: ITemplateLink[] }
  >();
  for (const collection of elementsNamed(tree, 'collection')) {
    const href = attributeOf(collection, 'href');
    if (!href) throw new Error('discovery: a collection without href');
    const into = merged.get(href) ?? { accepts: [], templateLinks: [] };
    merged.set(href, into);
    for (const accept of elementsNamed(collection, 'accept')) {
      const value = textOf(accept).trim();
      if (value && !into.accepts.includes(value)) into.accepts.push(value);
    }
    for (const link of elementsNamed(collection, 'templateLink')) {
      into.templateLinks.push({
        template: attributeOf(link, 'template'),
        type: attributeOf(link, 'type'),
      });
    }
  }
  if (merged.size === 0) throw new Error('discovery: no collection');
  return merged;
}

/** `GET /vit/urimapper`: the one `adtcore:objectReference`'s `uri`. */
export function readUrimapperUri(xml: string): string {
  const references = elementsNamed(
    parseAnswer(xml, 'urimapper'),
    'objectReference',
  );
  const [only] = references;
  if (references.length !== 1 || !only) {
    throw new Error(
      `urimapper: expected one objectReference, found ${references.length}`,
    );
  }
  const uri = attributeOf(only, 'uri');
  if (!uri) throw new Error('urimapper: objectReference without uri');
  return uri;
}

const SOURCE_RELATION = 'http://www.sap.com/adt/relations/source';

/**
 * The media types of every link of an object's metadata document whose `rel`
 * is exactly `…/relations/source`, anywhere in it — a class links its source
 * from its `main` include, not from its root. `''` stands for an untyped link.
 */
export function readSourceLinkTypes(xml: string): string[] {
  return elementsNamed(parseAnswer(xml, 'metadata'), 'link')
    .filter((link) => attributeOf(link, 'rel') === SOURCE_RELATION)
    .map((link) => mediaType(attributeOf(link, 'type')));
}

/** A media type without its parameters, lower-cased. */
function mediaType(value: string): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// The library's side
// ---------------------------------------------------------------------------

/**
 * A connection the handlers below are built over to be asked their media
 * types: nothing is sent through it. A request a member makes is recorded —
 * its URL and its `Accept` — and refused, so the member answers a failure.
 */
class NoRequests implements IAbapConnection {
  readonly asked: { readonly url: string; readonly accept: string }[] = [];
  async connect(): Promise<void> {}
  async getBaseUrl(): Promise<string> {
    return '';
  }
  getSessionId(): string | null {
    return null;
  }
  setSessionType(): void {}
  async makeAdtRequest<T = unknown, D = unknown>(
    options: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    this.asked.push({
      url: options.url,
      accept: options.headers?.Accept ?? '',
    });
    throw new Error('the conformance check sends no request');
  }
}

/** Each API's handler, from the client's own factory. */
const HANDLER: {
  readonly [A in AdtApiName]: (client: AdtClient<'onprem'>) => object;
} = {
  class: (c) => c.getClass(),
  interface: (c) => c.getInterface(),
  program: (c) => c.getProgram(),
  include: (c) => c.getInclude(),
  functionGroup: (c) => c.getFunctionGroup(),
  functionModule: (c) => c.getFunctionModule(),
  functionInclude: (c) => c.getFunctionInclude(),
  package: (c) => c.getPackage(),
  ddl: (c) => c.getDdl(),
  table: (c) => c.getTable(),
  structure: (c) => c.getStructure(),
  appendStructure: (c) => c.getAppendStructure(),
  tableType: (c) => c.getTableType(),
  domain: (c) => c.getDomain(),
  dataElement: (c) => c.getDataElement(),
  accessControl: (c) => c.getAccessControl(),
  behaviorDefinition: (c) => c.getBehaviorDefinition(),
  behaviorImplementation: (c) => c.getBehaviorImplementation(),
  metadataExtension: (c) => c.getMetadataExtension(),
  serviceDefinition: (c) => c.getServiceDefinition(),
  serviceBinding: (c) => c.getServiceBinding(),
  scalarFunction: (c) => c.getScalarFunction(),
  scalarFunctionImplementation: (c) => c.getScalarFunctionImplementation(),
  transformation: (c) => c.getTransformation(),
  messageClass: (c) => c.getMessageClass(),
  messageClassMessage: (c) => c.getMessageClassMessage(),
  featureToggle: (c) => c.getFeatureToggle(),
  authorizationField: (c) => c.getAuthorizationField(),
  enhancement: (c) => c.getEnhancement(),
  localTestClass: (c) => c.getLocalTestClass(),
  localTypes: (c) => c.getLocalTypes(),
  localDefinitions: (c) => c.getLocalDefinitions(),
  localMacros: (c) => c.getLocalMacros(),
  request: (c) => c.getRequest(),
};

/** Whether a table key is an API name: every key of a typed table is. */
function isApiName(key: string): key is AdtApiName {
  return Object.hasOwn(HANDLER, key);
}

/** An enhancement's document type is its subtype's, chosen by the config. */
const ENHANCEMENT_SUBTYPE: Readonly<Partial<Record<string, EnhancementType>>> =
  {
    'ENHO/XHH': 'enhoxhh',
    'ENHO/XHB': 'enhoxhb',
    'ENHS/XSB': 'enhsxsb',
  };

let lookupClient: AdtClient<'onprem'> | undefined;

/**
 * The media type `updateMetadata` sends for `api`'s `code`, without
 * parameters: the pair the library's harness records for the handler's
 * member (`integrationHeadersOf`); `undefined` where none is recorded.
 */
export function updateMetadataMediaType(
  api: AdtApiName,
  code: string | undefined,
): string | undefined {
  lookupClient ??= new AdtClient<'onprem'>(new NoRequests());
  const handler = HANDLER[api](lookupClient);
  const subtype = code === undefined ? undefined : ENHANCEMENT_SUBTYPE[code];
  try {
    const pair = integrationHeadersOf(
      handler,
      'updateMetadata',
      subtype ? { enhancementType: subtype } : undefined,
    );
    return mediaType(pair.contentType);
  } catch {
    return undefined;
  }
}

/**
 * Each API's source read, as a consumer calls it: the member the table's
 * `source` names (`read`, or a feature toggle's `readSource`), for an object
 * named `name` (and, for an enhancement, the code's subtype).
 */
const SOURCE_READ: {
  readonly [A in AdtApiName]?: (
    client: AdtClient<'onprem'>,
    name: string,
    code: string,
  ) => Promise<unknown>;
} = {
  class: (c, name) => c.getClass().read({ className: name }, undefined, JUDGED),
  interface: (c, name) =>
    c.getInterface().read({ interfaceName: name }, undefined, JUDGED),
  program: (c, name) =>
    c.getProgram().read({ programName: name }, undefined, JUDGED),
  include: (c, name) =>
    c.getInclude().read({ includeName: name }, undefined, JUDGED),
  functionGroup: (c, name) =>
    c.getFunctionGroup().read({ functionGroupName: name }, undefined, JUDGED),
  functionModule: (c, name) =>
    c
      .getFunctionModule()
      .read(
        { functionModuleName: name, functionGroupName: 'ZFG' },
        undefined,
        JUDGED,
      ),
  functionInclude: (c, name) =>
    c
      .getFunctionInclude()
      .read({ includeName: name, functionGroupName: 'ZFG' }, undefined, JUDGED),
  ddl: (c, name) => c.getDdl().read({ ddlName: name }, undefined, JUDGED),
  table: (c, name) => c.getTable().read({ tableName: name }, undefined, JUDGED),
  structure: (c, name) =>
    c.getStructure().read({ structureName: name }, undefined, JUDGED),
  appendStructure: (c, name) =>
    c
      .getAppendStructure()
      .read({ appendStructureName: name }, undefined, JUDGED),
  accessControl: (c, name) =>
    c.getAccessControl().read({ accessControlName: name }, undefined, JUDGED),
  behaviorDefinition: (c, name) =>
    c.getBehaviorDefinition().read({ name }, undefined, JUDGED),
  behaviorImplementation: (c, name) =>
    c.getBehaviorImplementation().read({ className: name }, undefined, JUDGED),
  metadataExtension: (c, name) =>
    c.getMetadataExtension().read({ name }, undefined, JUDGED),
  serviceDefinition: (c, name) =>
    c
      .getServiceDefinition()
      .read({ serviceDefinitionName: name }, undefined, JUDGED),
  scalarFunction: (c, name) =>
    c.getScalarFunction().read({ scalarFunctionName: name }, undefined, JUDGED),
  scalarFunctionImplementation: (c, name) =>
    c
      .getScalarFunctionImplementation()
      .read(
        { implementationName: name, scalarFunctionName: name },
        undefined,
        JUDGED,
      ),
  transformation: (c, name) =>
    c.getTransformation().read({ transformationName: name }, undefined, JUDGED),
  featureToggle: (c, name) =>
    c
      .getFeatureToggle()
      .readSource({ featureToggleName: name }, undefined, JUDGED),
  // Only a source-code plugin has a source the library reads.
  enhancement: async (c, name, code) =>
    code === 'ENHO/XHH'
      ? c
          .getEnhancement()
          .read(
            { enhancementName: name, enhancementType: 'enhoxhh' },
            undefined,
            JUDGED,
          )
      : undefined,
};

/** The analyse a harness call passes (`integrationCallsAreJudged`). */
const JUDGED = { analyse: analyseException };

/** The media types an `Accept` names, without parameters. */
function acceptedMediaTypes(accept: string): string[] {
  return accept
    .split(',')
    .map(mediaType)
    .filter((type) => type !== '');
}

/**
 * The media types the library asks for when it reads `api`'s `code` source:
 * the `Accept` of every request its source read makes to a `…/source/…`
 * address, read off a connection that records it. `undefined` where the
 * library has no source read for the API.
 */
export async function librarySourceTypes(
  api: AdtApiName,
  code: string,
): Promise<readonly string[] | undefined> {
  const read = SOURCE_READ[api];
  if (!read) return undefined;
  const connection = new NoRequests();
  await read(new AdtClient<'onprem'>(connection), 'ZSAMPLE', code).catch(
    () => undefined,
  );
  const types = connection.asked
    .filter((request) => request.url.includes('/source/'))
    .flatMap((request) => acceptedMediaTypes(request.accept));
  return types.length > 0 ? [...new Set(types)] : undefined;
}

/**
 * The library's source types for every entry of `table` that lists `source`,
 * keyed `<api> <code>`: what rule `source` admits as the object's source.
 */
export async function librarySourceTypesOf(
  table: AdtApiTable<string>,
): Promise<ReadonlyMap<string, readonly string[]>> {
  const found = new Map<string, readonly string[]>();
  for (const api of Object.keys(table)) {
    if (!isApiName(api)) continue;
    const entry = table[api];
    if (!entry) continue;
    for (const [code, facts] of Object.entries(entry.codes)) {
      if (!facts.operations.includes('source')) continue;
      const types = await librarySourceTypes(api, code);
      if (types) found.set(`${api} ${code}`, types);
    }
  }
  return found;
}

/** A code with no address of its own: `MSAG/NN`. */
type ThroughParentCode = Exclude<AdtTypeCode, AdtAddressableCode>;

/**
 * Where the library reads a code that has no address of its own: a message is
 * a row of its class's document, which the library reads and writes
 * (`NO_OWN_ADDRESS`).
 */
const READ_THROUGH_PARENT: {
  readonly [C in ThroughParentCode]: (name: string, parent: string) => string;
} = {
  'MSAG/NN': (_name, parent) => buildObjectUri(parent, 'MSAG/N'),
};

function isThroughParentCode(code: string): code is ThroughParentCode {
  return Object.hasOwn(READ_THROUGH_PARENT, code);
}

function isAddressableCode(code: string): code is AdtAddressableCode {
  return isAdtTypeCode(code) && NO_OWN_ADDRESS[code] === undefined;
}

/**
 * The address the library sends for an object of `code`: `buildObjectUri`,
 * or, for a code with no address of its own, its parent's.
 */
export function libraryAddress(
  code: string,
  name: string,
  parent: string | null,
): string {
  if (isThroughParentCode(code)) {
    if (!parent) throw new Error(`${code} ${name}: the sample names no parent`);
    return READ_THROUGH_PARENT[code](name, parent);
  }
  if (!isAddressableCode(code)) {
    throw new Error(`${code} is no code of the ADT type tables`);
  }
  return buildObjectUri(name, code, parent ?? undefined);
}

/** Parented codes' segments, read by any code. */
const SEGMENT_BY_CODE: Readonly<Partial<Record<string, string>>> =
  PARENTED_SEGMENT;

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/** Each conflict rule of spec 4, by name. */
export type ConformanceRule =
  /** 1: the code is in the release's `typestructure`. */
  | 'listed'
  /** 2: the parent API's code is the listed `PARENT_OBJECT_TYPE`. */
  | 'parent'
  /** 3: `nameMaxLength` does not exceed `OBJNAME_MAXLENGTH`. */
  | 'name-length'
  /** 4: the collection is advertised in `discovery`. */
  | 'collection'
  /** 5: the library's address for the sample is the `urimapper` answer. */
  | 'address'
  /** 6: `run` needs `EXECUTE`. */
  | 'execute'
  /** 6: `profile` needs `PROFILE`. */
  | 'profile'
  /**
   * 9: `source` iff the sample's metadata links a source the library reads
   * (untyped, or of a type its source read asks for); without `source`, no
   * link typed `text/plain` or untyped.
   */
  | 'source'
  /** 10: `updateMetadata`'s media type is among the collection's `app:accept`. */
  | 'metadata-type'
  /** A code of the table on a release with samples has a readable record. */
  | 'sample';

/** One conflict: its rule, where, and what was found. */
export interface IConflict {
  readonly rule: ConformanceRule;
  readonly api: string;
  /** `''` for a codeless entry. */
  readonly code: string;
  readonly detail: string;
}

/** What the check reports for one table against one release's answers. */
export interface IConformanceReport {
  readonly conflicts: readonly IConflict[];
  /** 7: codes an entry creates whose type lacks `CREATE`, sorted. */
  readonly createWithoutCapability: readonly string[];
  /** 8: codes whose type lists `CREATE` that no entry creates, sorted. */
  readonly notCreated: readonly string[];
  /**
   * Coverage: codes whose type lists `EXECUTE` or `PROFILE` that no entry
   * runs or profiles, code → the capabilities unused. Not a conflict.
   */
  readonly capabilityNotUsed: Readonly<Record<string, readonly string[]>>;
  /** Coverage: the release's types no entry serves, code → label. */
  readonly unserved: Readonly<Record<string, string>>;
  /** Samples whose sample-based rules were not run, code → reason. */
  readonly unreadable: Readonly<Record<string, string>>;
}

/** A conflict as one line: what the divergence list and the messages compare. */
export function conflictLine(conflict: IConflict): string {
  const where = conflict.code
    ? `${conflict.api} ${conflict.code}`
    : conflict.api;
  return `${conflict.rule}: ${where}: ${conflict.detail}`;
}

const sorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort();

/** The keys of an object, sorted, as a plain record. */
function sortedRecord(entries: [string, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of entries.sort(([a], [b]) => (a < b ? -1 : 1)))
    out[key] = value;
  return out;
}

/** The accepted types of `collection` for `code`: a parented code's are its template link's. */
function acceptedTypes(
  collections: ReadonlyMap<string, ICollection>,
  href: string,
  code: string | undefined,
): readonly string[] {
  const collection = collections.get(href);
  if (!collection) return [];
  const segment = code === undefined ? undefined : SEGMENT_BY_CODE[code];
  if (!segment) return collection.accepts.map(mediaType);
  return collection.templateLinks
    .filter(
      (link) =>
        link.template.startsWith(`${href}/`) &&
        link.template.endsWith(`/${segment}`),
    )
    .map((link) => mediaType(link.type))
    .filter(Boolean);
}

/** Hold `table` to `answers`: every conflict rule, the capability lists and the coverage. */
export function checkTypeTable(
  table: AdtApiTable<string>,
  answers: IReleaseAnswers,
  /** {@link librarySourceTypesOf} of `table`: what rule `source` admits. */
  sourceTypes: ReadonlyMap<string, readonly string[]>,
): IConformanceReport {
  const conflicts: IConflict[] = [];
  const conflict = (
    rule: ConformanceRule,
    api: string,
    code: string,
    detail: string,
  ) => conflicts.push({ rule, api, code, detail });

  const createWithoutCapability: string[] = [];
  const unreadable: [string, string][] = [];
  /** Per code, the operations of every entry that holds it. */
  const opsByCode = new Map<string, Set<AdtOperation>>();
  const sampleChecked = new Set<string>();

  for (const api of Object.keys(table)) {
    if (!isApiName(api)) throw new Error(`table key ${api} is no API name`);
    const entry = table[api];
    if (!entry) continue;
    const codes = Object.entries(entry.codes);

    if (codes.length === 0) {
      // A codeless entry (R4): no code to list, no sample; its collection and
      // its metadata type are still the release's to advertise.
      if (!answers.collections.has(entry.collection)) {
        conflict(
          'collection',
          api,
          '',
          `${entry.collection} is not advertised`,
        );
      }
      const accepted = acceptedTypes(
        answers.collections,
        entry.collection,
        undefined,
      );
      if (entry.operations?.includes('updateMetadata') && accepted.length > 0) {
        const type = updateMetadataMediaType(api, undefined);
        if (type === undefined) {
          conflict(
            'metadata-type',
            api,
            '',
            'no updateMetadata pair is recorded',
          );
        } else if (!accepted.includes(type)) {
          conflict(
            'metadata-type',
            api,
            '',
            `${type} is not among ${entry.collection}'s app:accept [${accepted.join(', ')}]`,
          );
        }
      }
      continue;
    }

    for (const [code, facts] of codes) {
      const ops = opsByCode.get(code) ?? new Set<AdtOperation>();
      opsByCode.set(code, ops);
      for (const op of facts.operations) ops.add(op);

      const type = answers.types.get(code);
      if (!type) {
        conflict('listed', api, code, 'not in typestructure');
        continue;
      }

      // 2: the parent.
      const parentCodes =
        facts.parent === null
          ? []
          : Object.keys(table[facts.parent]?.codes ?? {});
      const expected = parentCodes.join(',');
      if (expected !== type.parent) {
        conflict(
          'parent',
          api,
          code,
          `the table's parent ${facts.parent ?? '(none)'} has code(s) [${expected}], typestructure lists '${type.parent}'`,
        );
      }

      // 3: the name length.
      if (facts.nameMaxLength > type.nameMaxLength) {
        conflict(
          'name-length',
          api,
          code,
          `nameMaxLength ${facts.nameMaxLength} exceeds OBJNAME_MAXLENGTH ${type.nameMaxLength}`,
        );
      }

      // 4: the collection the code lives in.
      const href = facts.collection ?? entry.collection;
      if (!answers.collections.has(href)) {
        conflict('collection', api, code, `${href} is not advertised`);
      }

      // 6: run and profile need their capability. A capability no entry
      // uses goes into the coverage, below.
      if (
        facts.operations.includes('run') &&
        !type.capabilities.has('EXECUTE')
      ) {
        conflict('execute', api, code, 'run listed, EXECUTE is not');
      }
      if (
        facts.operations.includes('profile') &&
        !type.capabilities.has('PROFILE')
      ) {
        conflict('profile', api, code, 'profile listed, PROFILE is not');
      }

      // 7: create without CREATE is listed apart, not a conflict.
      if (
        facts.operations.includes('create') &&
        !type.capabilities.has('CREATE')
      ) {
        createWithoutCapability.push(code);
      }

      // 10: the metadata type, where the collection advertises any.
      const accepted = acceptedTypes(answers.collections, href, code);
      if (facts.operations.includes('updateMetadata') && accepted.length > 0) {
        const media = updateMetadataMediaType(api, code);
        if (media === undefined) {
          conflict(
            'metadata-type',
            api,
            code,
            'no updateMetadata pair is recorded',
          );
        } else if (!accepted.includes(media)) {
          conflict(
            'metadata-type',
            api,
            code,
            `${media} is not among ${href}'s app:accept [${accepted.join(', ')}]`,
          );
        }
      }

      // 5 and 9: what the sample says.
      if (!answers.samples) continue;
      const sample = answers.samples.get(code);
      if (!sample) {
        conflict('sample', api, code, 'no sample is recorded');
        continue;
      }
      if (!sample.readable) {
        unreadable.push([code, sample.reason]);
        continue;
      }
      if (!sampleChecked.has(code)) {
        sampleChecked.add(code);
        const built = libraryAddress(code, sample.name, sample.parent);
        if (built !== sample.urimapperUri) {
          conflict(
            'address',
            api,
            code,
            `the library addresses ${built}, urimapper answers ${sample.urimapperUri}`,
          );
        }
      }
      const links = sample.sourceLinkTypes;
      if (facts.operations.includes('source')) {
        const read = sourceTypes.get(`${api} ${code}`);
        if (!read) {
          conflict(
            'source',
            api,
            code,
            'source listed, the library reads none',
          );
        } else if (!links.some((type) => type === '' || read.includes(type))) {
          conflict(
            'source',
            api,
            code,
            `source listed, the metadata document links none the library reads [${read.join(', ')}]`,
          );
        }
      } else if (links.some((type) => type === '' || type === 'text/plain')) {
        conflict(
          'source',
          api,
          code,
          'source not listed, the metadata document links a text/plain or untyped source',
        );
      }
    }
  }

  // 8 and the coverage.
  const notCreated: string[] = [];
  const unserved: [string, string][] = [];
  const capabilityNotUsed: Record<string, string[]> = {};
  for (const type of [...answers.types.values()].sort((a, b) =>
    a.code < b.code ? -1 : 1,
  )) {
    const ops = opsByCode.get(type.code);
    const unused = [
      ...(type.capabilities.has('EXECUTE') && !ops?.has('run')
        ? ['EXECUTE']
        : []),
      ...(type.capabilities.has('PROFILE') && !ops?.has('profile')
        ? ['PROFILE']
        : []),
    ];
    if (unused.length > 0) capabilityNotUsed[type.code] = unused;
    if (type.capabilities.has('CREATE') && !ops?.has('create')) {
      notCreated.push(type.code);
    }
    if (!ops) unserved.push([type.code, type.label]);
  }

  return {
    conflicts,
    createWithoutCapability: sorted(createWithoutCapability),
    notCreated: sorted(notCreated),
    capabilityNotUsed,
    unserved: sortedRecord(unserved),
    unreadable: sortedRecord(unreadable),
  };
}

// ---------------------------------------------------------------------------
// One meaning per code
// ---------------------------------------------------------------------------

/** The three tables, by variant. */
export const TYPE_TABLES: Readonly<Record<string, AdtApiTable<string>>> = {
  onprem: ADT_TYPES_ONPREM,
  cloud: ADT_TYPES_CLOUD,
  basis740: ADT_TYPES_BASIS_740,
};

/**
 * Every code of every entry of every table, duplicates inside a table
 * included, grouped: the codes with more than one kind, or more than one
 * collection — `buildObjectUri` reads the first table that names a code, so a
 * code that lived elsewhere in another table would be addressed wrongly there.
 */
export function codesWithTwoMeanings(
  tables: Readonly<Record<string, AdtApiTable<string>>>,
): string[] {
  const kinds = new Map<string, Set<string>>();
  const collections = new Map<string, Set<string>>();
  for (const table of Object.values(tables)) {
    for (const entry of Object.values(table)) {
      if (!entry) continue;
      for (const [code, facts] of Object.entries(entry.codes)) {
        const k = kinds.get(code) ?? new Set<string>();
        k.add(entry.kind);
        kinds.set(code, k);
        const c = collections.get(code) ?? new Set<string>();
        c.add(facts.collection ?? entry.collection);
        collections.set(code, c);
      }
    }
  }
  const found: string[] = [];
  for (const [code, k] of kinds) {
    if (k.size > 1) found.push(`${code}: kinds ${sorted(k).join(', ')}`);
  }
  for (const [code, c] of collections) {
    if (c.size > 1) found.push(`${code}: collections ${sorted(c).join(', ')}`);
  }
  return found.sort();
}
