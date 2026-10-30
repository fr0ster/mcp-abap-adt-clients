/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (7.40 SP04)
 *
 * Every override below refuses without a request, answered through `failed()`
 * (spec §2.1, §10.2), except `activateObjectsGroup`, which sends the legacy
 * request.
 *
 * Not in the legacy discovery catalogue, refused:
 * - getTableColumns → /sap/bc/adt/datapreview/ddic/{name}/metadata
 * - getTableContents → /sap/bc/adt/datapreview/ddic
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle
 * - getObjectProperties → /sap/bc/adt/repository/informationsystem/objectproperties/values
 *
 * Measured over RFC on SAP_BASIS 7.40 SP04 — the endpoint answered `404` —
 * refused:
 * - getWhereUsed, getWhereUsedScope → .../informationsystem/usageReferences
 * - getVirtualFoldersContents → .../informationsystem/virtualfolders/contents
 * - getAllTypes → .../informationsystem/objecttypes
 * - checkDeletionGroup, deleteObjectsGroup → /sap/bc/adt/deletion/*
 * - readObjectMetadata for a domain, a data element, a structure, a package
 *   and a table (the table family, §10.1); readObjectSource for a structure
 *   and a table
 *
 * Not measured and not advertised, refused until measured:
 * - readObjectMetadata and readObjectSource for a table type
 *
 * In readObjectMetadata/readObjectSource every alias `objectWire` accepts for
 * those types is refused, in any case; every other type goes to the base
 * unchanged, so an unknown type is still thrown.
 *
 * Refused because a legacy group activation has no run:
 * - getActivationRun, getActivationResults → /sap/bc/adt/activation/runs,
 *   /results (not advertised). `activateObjectsGroup` here sends the
 *   synchronous /sap/bc/adt/activation, not /activation/runs, and yields no
 *   run id to ask about.
 *
 * A further override refused `getTransaction`
 * (/sap/bc/adt/repository/informationsystem/objectproperties, also absent). It
 * went with the base method, which nobody called: the only code that ever
 * mentioned `getTransaction` was its own doc comment and this refusal of it.
 *
 * The base class exposes that endpoint again as `getObjectProperties`
 * (/sap/bc/adt/repository/informationsystem/objectproperties/values), so this
 * class refuses it again: legacy discovery still does not list it.
 */

import {
  type AdtActivationCode,
  type AdtDeletionCheckCode,
  type AdtDeletionCode,
  type AdtMetadataReadCodeOf,
  type AdtSourceReadCodeOf,
  type AdtStructureCode,
  AdtUtils,
  type AdtWhereUsedCode,
  answering,
  buildObjectUri,
  DATA_ELEMENT,
  DOMAIN,
  failed,
  type IAdtGroupReference,
  PACKAGE,
  type ParentedArguments,
  requestHeaders,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
  type utilDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtApiTable,
  AdtSourceTypeCode,
  AdtTypeCode,
  AdtTypeCodeOf,
  IAdtCodedReference,
  IAdtHeaders,
  IAdtSearchObjectsParamsOf,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IObjectReference,
  IReadOptions,
  IUtilResults,
} from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_SEARCH_TYPES_BASIS_740,
  ADT_TYPES_BASIS_740,
  ADT_UTILITY_CODES_BASIS_740,
  AdtObjectErrorCodes,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtOperationOptions,
  type IAdtResponse,
  type IGetNodeContentsOptions,
  type IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import {
  legacyRefusal,
  legacyUnmeasuredRefusal,
  noDeletionApi,
  noDeletionCheck,
} from './refusalLegacy';

const RIS = '/sap/bc/adt/repository/informationsystem';
const WHERE_USED = `${RIS}/usageReferences`;
const WHERE_USED_SCOPE = `${RIS}/usageReferences/scope`;
const VIRTUAL_FOLDERS = `${RIS}/virtualfolders/contents`;
const OBJECT_TYPES = `${RIS}/objecttypes`;
const ACTIVATION_RUNS = '/sap/bc/adt/activation/runs';
const ACTIVATION_RESULTS = '/sap/bc/adt/activation/results';
const WHERE_USED_ON_740 =
  '7.40 serves where-used through the RIS sequence fullnamemapping → metadata → whereused?RIS_REQUEST_TYPE=WHERE_USED_LAZY, which this library does not implement.';
const OBJECT_TYPES_ON_740 =
  '7.40 serves object types through repository/typestructure: getTypeStructure.';
const NO_RUN_ID =
  'A legacy activateObjectsGroup is the synchronous /sap/bc/adt/activation: its answer is the result, and there is no run id to ask about.';

const PACKAGE_ITEM = `${PACKAGE.collection}/{name}`;

/**
 * The codes of the ADT type tables that 7.40's table lacks: what a legacy
 * client refuses by type. A caller typed against the 7.40 variant never names
 * one; these maps answer the caller outside the type system.
 */
type AbsentOn740 = Exclude<AdtTypeCode, AdtTypeCodeOf<'basis740'>>;

/**
 * The DDIC types 7.40 does not serve through these reads, by code, to the
 * endpoint it lacks. Keyed by the codes of the tables since interfaces-adt
 * 21.0.0: the friendly names and lower-case spellings it was keyed by before
 * (`domain`, `stru/dt`, `ttyp/df`, …) name these codes.
 */
const METADATA_REFUSED: { readonly [C in AbsentOn740]?: string } = {
  'DOMA/DD': DOMAIN.collection,
  'DTEL/DE': DATA_ELEMENT.collection,
  'TABL/DS': STRUCTURE.collection,
  'TABL/DT': TABLE.collection,
  'TTYP/DA': TABLE_TYPE.collection,
  'DEVC/K': PACKAGE_ITEM,
};
/**
 * The source types among them. A table type has none (`TTYP/DA` is no
 * `AdtSourceTypeCode`), so it is not here.
 */
const SOURCE_REFUSED: { readonly [C in AbsentOn740]?: string } = {
  'TABL/DS': STRUCTURE.collection,
  'TABL/DT': TABLE.collection,
};

/** The endpoint 7.40 lacks for `objectType`, or `undefined` when it is served. */
function refusedFor(
  table: { readonly [C in AbsentOn740]?: string },
  objectType: AdtTypeCode,
): string | undefined {
  const refused: Readonly<Partial<Record<AdtTypeCode, string>>> = table;
  return Object.hasOwn(refused, objectType) ? refused[objectType] : undefined;
}

/**
 * The refusal of a read of `objectType` at `endpoint`: the table type is only
 * absent from discovery, not measured, so its refusal says that; the other
 * families answered `404`.
 */
function refuseRead<T, E extends IAdtError>(
  operation: string,
  endpoint: string,
): IAdtResponse<T, E> {
  return endpoint === TABLE_TYPE.collection
    ? legacyUnmeasuredRefusal<T, E>(operation, endpoint)
    : legacyRefusal<T, E>(operation, endpoint);
}

function unsupportedError(operation: string, endpoint: string): string {
  return (
    `${operation} is not supported on a legacy system (7.40 SP04): ` +
    `its ADT discovery catalogue (/sap/bc/adt/discovery) does not list ${endpoint}.`
  );
}

/** ADT_TYPES_BASIS_740, read as the entry shape it satisfies. */
const TABLE_740: AdtApiTable<string> = ADT_TYPES_BASIS_740;

/** The codes ADT_TYPES_BASIS_740 lists: all a legacy `getUtils` member takes. */
const CODES_740: ReadonlySet<string> = new Set(
  Object.values(TABLE_740).flatMap((entry) =>
    entry ? Object.keys(entry.codes) : [],
  ),
);

/**
 * The codes a 7.40 group activation activates: those 7.40's table lists
 * `activate` for, and those its utility table lists `groupActivation` for
 * (`VIEW/DV`) — `AdtActivationCode<'basis740'>`.
 */
const ACTIVATED_740: ReadonlySet<string> = new Set([
  ...Object.values(TABLE_740).flatMap((entry) =>
    Object.entries(entry?.codes ?? {})
      .filter(([, facts]) => facts.operations.includes('activate'))
      .map(([code]) => code),
  ),
  ...Object.entries(ADT_UTILITY_CODES_BASIS_740)
    .filter(([, facts]) =>
      facts.operations.some((operation) => operation === 'groupActivation'),
    )
    .map(([code]) => code),
]);

/**
 * A code 7.40's table does not list, from a caller outside the type system:
 * refused, as every legacy refusal is, and nothing is sent.
 */
function refuseCode<T, E extends IAdtError>(
  operation: string,
  code: string,
): IAdtResponse<T, E> {
  return legacyRefusal<T, E>(
    `${operation}(${code})`,
    `${code} in ADT_TYPES_BASIS_740`,
    'Nothing is sent.',
  );
}

export class AdtUtilsLegacy<
  R extends IUtilResults = typeof utilDocuments,
> extends AdtUtils<R, 'basis740'> {
  /**
   * Legacy group activation — synchronous POST to /sap/bc/adt/activation
   *
   * Modern systems use async /sap/bc/adt/activation/runs with polling.
   * Legacy systems use synchronous /sap/bc/adt/activation. A success answers
   * `200` with an empty body, not a checklist: BASIS 7.40 activated six objects
   * that way, and only `/activation/inactiveobjects` afterwards said so
   * (measured on premise, 2026-10-01; docs/LEGACY.md, "Measured
   * on BASIS 7.40").
   *
   * Read through the same `activation` slot as the modern run. The default keeps
   * the document, which here is the result itself; `utilActivationRunId` would
   * find no run id in it and answer `''`, so a caller on a legacy system does
   * not pass that one.
   */
  override async activateObjectsGroup<E extends IAdtError = IAdtError>(
    objects: IAdtCodedReference<AdtActivationCode<'basis740'>>[],
    preauditRequested: boolean = false,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The type admits only the codes 7.40's table activates; a caller outside
    // the type system is answered the refusal, and nothing is sent.
    const foreign = objects.find((o) => !ACTIVATED_740.has(o.type));
    if (foreign)
      return refuseCode<ReturnType<R['activation']>, E>(
        'activateObjectsGroup',
        foreign.type,
      );
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`;

    const objectReferences = objects
      .map((obj) => {
        const uri = buildObjectUri(obj.name, obj.type, obj.parentName);
        return `  <adtcore:objectReference adtcore:uri="${uri}" adtcore:type="${obj.type}" adtcore:name="${obj.name}"/>`;
      })
      .join('\n');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

    return answering(
      () =>
        this.connection.makeAdtRequest({
          url,
          method: 'POST',
          timeout: 0,
          data: xmlBody,
          headers: requestHeaders(options.headers),
        }),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /**
   * Refused, and answered as a failure rather than thrown.
   *
   * The contract says a member answers `IAdtResponse`; a caller branches on `ok`
   * and reads `getError()`. Throwing here would make one implementation of a
   * member behave unlike the other for reasons the caller cannot see in the
   * type — the substitution decision 13 is about, broken by the half that is
   * meant to be interchangeable.
   *
   * `origin` is `'refusal'` with `UNSUPPORTED_OPERATION`: this system's
   * discovery catalogue does not list the endpoint, so the operation is not
   * offered here. It was `'connection'`, which tells a caller to reauthenticate
   * or restore reachability over a request that was never sent — nothing about
   * the connection failed.
   *
   * No request is made, so there is no answer for the caller's `analyse` to
   * read; the option is accepted for the contract's shape.
   */
  override async getTableColumns<E extends IAdtError = IAdtError>(
    _tableName: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['columns']>, E>> {
    return this.refuse(
      'Table columns',
      '/sap/bc/adt/datapreview/ddic/{name}/metadata',
    );
  }

  override async getTableContents<E extends IAdtError = IAdtError>(
    _params: IGetTableContentsParams,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['contents']>, E>> {
    return this.refuse('Table contents', '/sap/bc/adt/datapreview/ddic');
  }

  override async getSqlQuery<E extends IAdtError = IAdtError>(
    _params: IGetSqlQueryParams,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['query']>, E>> {
    return this.refuse('SQL query', '/sap/bc/adt/datapreview/freestyle');
  }

  override async getObjectProperties<E extends IAdtError = IAdtError>(
    _objectUri: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['objectProperties']>, E>> {
    return this.refuse(
      'Object properties',
      '/sap/bc/adt/repository/informationsystem/objectproperties/values',
    );
  }

  /**
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5, §10.2).
   */
  override async checkDeletionGroup<E extends IAdtError = IAdtError>(
    _objects: IAdtCodedReference<AdtDeletionCheckCode<'basis740'>>[],
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>(
      'checkDeletionGroup',
    );
  }

  /**
   * Refused without a request: the group delete is
   * `/sap/bc/adt/deletion/check` then `/deletion/delete`, which 7.40 does not
   * serve (spec §4.3, §10.2).
   */
  override async deleteObjectsGroup<E extends IAdtError = IAdtError>(
    _objects: IAdtCodedReference<AdtDeletionCode<'basis740'>>[],
    _transportRequest: string | undefined,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    return noDeletionApi<ReturnType<R['deletion']>, E>(
      'deleteObjectsGroup',
      "Delete each object through its handler's delete() with the object's lock handle, from lock().",
    );
  }

  /**
   * Refused without a request: `usageReferences` answered `404` over RFC on
   * 7.40 SP04 (spec §10.2). Refused before the type is read, so an unknown
   * type is not thrown here: the member itself is not offered.
   */
  override async getWhereUsed<E extends IAdtError = IAdtError>(
    _params: IGetWhereUsedParams<AdtWhereUsedCode<'basis740'>>,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['whereUsed']>, E>> {
    return legacyRefusal<ReturnType<R['whereUsed']>, E>(
      'getWhereUsed',
      WHERE_USED,
      WHERE_USED_ON_740,
    );
  }

  /** Refused without a request, like {@link getWhereUsed} (spec §10.2). */
  override async getWhereUsedScope<E extends IAdtError = IAdtError>(
    _params: IGetWhereUsedScopeParams<AdtWhereUsedCode<'basis740'>>,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['whereUsedScope']>, E>> {
    return legacyRefusal<ReturnType<R['whereUsedScope']>, E>(
      'getWhereUsedScope',
      WHERE_USED_SCOPE,
      WHERE_USED_ON_740,
    );
  }

  /**
   * Refused without a request: `virtualfolders/contents` answered `404` over
   * RFC on 7.40 SP04 (spec §10.2). A package's contents are served by
   * `fetchNodeStructure` with `DEVC/K`, measured on 7.40.
   */
  override async getVirtualFoldersContents<E extends IAdtError = IAdtError>(
    _params: IGetVirtualFoldersContentsParams,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['folders']>, E>> {
    return legacyRefusal<ReturnType<R['folders']>, E>(
      'getVirtualFoldersContents',
      VIRTUAL_FOLDERS,
      "A package's contents: fetchNodeStructure with the package and type DEVC/K.",
    );
  }

  /**
   * Refused without a request: `objecttypes` answered `404` over RFC on 7.40
   * SP04 (spec §10.2).
   */
  override async getAllTypes<E extends IAdtError = IAdtError>(
    _maxItemCount?: number,
    _name?: string,
    _data?: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return legacyRefusal<ReturnType<R['types']>, E>(
      'getAllTypes',
      OBJECT_TYPES,
      OBJECT_TYPES_ON_740,
    );
  }

  /**
   * Refused without a request: a legacy group activation is synchronous and
   * yields no run id, and `/activation/runs` is not advertised (spec §10.2).
   */
  override async getActivationRun<E extends IAdtError = IAdtError>(
    _runId: string,
    _options?: { withLongPolling?: boolean } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return legacyRefusal<ReturnType<R['run']>, E>(
      'getActivationRun',
      ACTIVATION_RUNS,
      NO_RUN_ID,
    );
  }

  /** Refused without a request, like {@link getActivationRun} (spec §10.2). */
  override async getActivationResults<E extends IAdtError = IAdtError>(
    _runId: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['results']>, E>> {
    return legacyRefusal<ReturnType<R['results']>, E>(
      'getActivationResults',
      ACTIVATION_RESULTS,
      NO_RUN_ID,
    );
  }

  /**
   * A domain, a data element, a structure, a table, a table type or a package
   * is refused without a request — a known type 7.40 lacks is answered, not
   * thrown (spec §10.2). Every other type goes to the base as it is, so an
   * unknown one is still the caller's mistake and thrown.
   */
  override async readObjectMetadata<
    C extends AdtMetadataReadCodeOf<'basis740'>,
    E extends IAdtError = IAdtError,
  >(
    objectType: C,
    objectName: string,
    ...rest: ParentedArguments<
      C,
      [options?: IReadOptions & IAdtAnalyseOptions<E>]
    >
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const endpoint = refusedFor(METADATA_REFUSED, objectType);
    if (endpoint)
      return refuseRead<ReturnType<R['metadata']>, E>(
        `readObjectMetadata(${objectType})`,
        endpoint,
      );
    if (!CODES_740.has(objectType))
      return refuseCode<ReturnType<R['metadata']>, E>(
        'readObjectMetadata',
        objectType,
      );
    return super.readObjectMetadata(objectType, objectName, ...rest);
  }

  /**
   * A structure or a table is refused without a request with its measured
   * endpoint (spec §10.2); any other code 7.40's table lacks with the
   * generic refusal; a 7.40 code goes to the base as it is.
   */
  override async readObjectSource<
    C extends AdtSourceReadCodeOf<'basis740'>,
    E extends IAdtError = IAdtError,
  >(
    objectType: C,
    objectName: string,
    ...rest: ParentedArguments<
      C,
      [
        version?: 'active' | 'inactive',
        options?: IReadOptions & IAdtAnalyseOptions<E>,
      ]
    >
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const endpoint = refusedFor(SOURCE_REFUSED, objectType);
    if (endpoint)
      return refuseRead<ReturnType<R['source']>, E>(
        `readObjectSource(${objectType})`,
        endpoint,
      );
    if (!CODES_740.has(objectType))
      return refuseCode<ReturnType<R['source']>, E>(
        'readObjectSource',
        objectType,
      );
    return super.readObjectSource(objectType, objectName, ...rest);
  }

  /**
   * A search filtered by a name 7.40 is not measured to select
   * (`ADT_SEARCH_TYPES_BASIS_740`) is refused without a request: 7.40 answers
   * an alias (`STRU`) or an unknown name with no hits, silently, which the
   * caller could not tell from an empty search.
   */
  override async search<E extends IAdtError = IAdtError>(
    criteria: IAdtSearchObjectsParamsOf<'basis740'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['search']>, E>> {
    if (
      criteria.objectType !== undefined &&
      !Object.hasOwn(ADT_SEARCH_TYPES_BASIS_740, criteria.objectType)
    )
      return legacyRefusal<ReturnType<R['search']>, E>(
        `search(${criteria.objectType})`,
        `${criteria.objectType} in ADT_SEARCH_TYPES_BASIS_740`,
        'Nothing is sent.',
      );
    return super.search(criteria, options);
  }

  /**
   * A node structure of a code 7.40's table lacks is refused without a
   * request — but a package's, measured served on 7.40 (`AdtStructureCode`).
   */
  override async fetchNodeStructure<E extends IAdtError = IAdtError>(
    parentType: AdtStructureCode<'basis740'>,
    parentName: string,
    options: { headers: IAdtHeaders } & IGetNodeContentsOptions &
      IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['node']>, E>> {
    if (!CODES_740.has(parentType) && parentType !== 'DEVC/K')
      return refuseCode<ReturnType<R['node']>, E>(
        'fetchNodeStructure',
        parentType,
      );
    return super.fetchNodeStructure(parentType, parentName, options);
  }

  /** An object structure of a code 7.40's table lacks is refused without a request. */
  override async getObjectStructure<E extends IAdtError = IAdtError>(
    objectType: AdtStructureCode<'basis740'>,
    objectName: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['objectStructure']>, E>> {
    if (!CODES_740.has(objectType) && objectType !== 'DEVC/K')
      return refuseCode<ReturnType<R['objectStructure']>, E>(
        'getObjectStructure',
        objectType,
      );
    return super.getObjectStructure(objectType, objectName, options);
  }

  private refuse<T, E extends IAdtError>(
    operation: string,
    endpoint: string,
  ): IAdtResponse<T, E> {
    // The library's own verdict, so `E` is its default `IAdtError` here — the
    // same cast `answering` makes when no strategy supplied one.
    return failed<T, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message: unsupportedError(operation, endpoint),
    } as E);
  }
}
