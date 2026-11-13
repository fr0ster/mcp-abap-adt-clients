import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (7.40 SP04)
 *
 * Every override below refuses without a request, answered through `failed()`
 * (spec §2.1, §10.2). The group activation of 7.40 is the inherited
 * `activateObjects`: the synchronous `POST /sap/bc/adt/activation`.
 *
 * Not in the legacy discovery catalogue, refused:
 * - getTableColumns → /sap/bc/adt/datapreview/ddic/{name}/metadata
 * - getTableContents → /sap/bc/adt/datapreview/ddic
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle
 * - getObjectProperties → /sap/bc/adt/repository/informationsystem/objectproperties/values
 * - getStructureElementInfo → /sap/bc/adt/ddic/elementinfo
 * - getServiceDefinitionElementInfo → /sap/bc/adt/ddic/srvd/elementinfo
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
 * Refused because 7.40 offers no activation runs (not in its discovery):
 * - activateObjectsGroup, getActivationRun, getActivationResults →
 *   /sap/bc/adt/activation/runs, /results. The group activation is the
 *   inherited activateObjects, which yields no run id to ask about.
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
  DATA_ELEMENT,
  DOMAIN,
  failed,
  type IAdtGroupReference,
  PACKAGE,
  type ParentedArguments,
  type ResultValuesOf,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
  type UtilValues,
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
} from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_SEARCH_TYPES_BASIS_740,
  ADT_TYPES_BASIS_740,
  AdtObjectErrorCodes,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtOperationOptions,
  type IAdtResponse,
  type IGetNodeContentsOptions,
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
  'A legacy group activation is the synchronous /sap/bc/adt/activation (activateObjects): its answer is the result, and there is no run id to ask about.';
const GROUP_ACTIVATION_ON_740 =
  'Nothing is sent. A group activation on 7.40 is activateObjects(objects, preauditRequested, options): the synchronous /sap/bc/adt/activation.';

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
  T extends UtilValues = ResultValuesOf<typeof utilDocuments>,
> extends AdtUtils<T, 'basis740'> {
  /**
   * Refused without a request: 7.40 does not list `/activation/runs` in its
   * discovery (measured on 7.40 SP04), and a group activation there is the
   * synchronous `POST /sap/bc/adt/activation` — `activateObjects`, inherited
   * unchanged. One endpoint, one member: this one is `/activation/runs`'s.
   */
  override async activateObjectsGroup<E extends IAdtError = IAdtError>(
    _objects: IAdtCodedReference<AdtActivationCode<'basis740'>>[],
    _preauditRequested: boolean = false,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    return legacyRefusal<T['activation'], E>(
      'activateObjectsGroup',
      ACTIVATION_RUNS,
      GROUP_ACTIVATION_ON_740,
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
  ): Promise<IAdtResponse<T['columns'], E>> {
    return this.refuse(
      'Table columns',
      '/sap/bc/adt/datapreview/ddic/{name}/metadata',
    );
  }

  override async getTableContents<E extends IAdtError = IAdtError>(
    _params: IGetTableContentsParams,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['contents'], E>> {
    return this.refuse('Table contents', '/sap/bc/adt/datapreview/ddic');
  }

  override async getSqlQuery<E extends IAdtError = IAdtError>(
    _params: IGetSqlQueryParams,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['query'], E>> {
    return this.refuse('SQL query', '/sap/bc/adt/datapreview/freestyle');
  }

  override async getObjectProperties<E extends IAdtError = IAdtError>(
    _objectUri: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['objectProperties'], E>> {
    return this.refuse(
      'Object properties',
      '/sap/bc/adt/repository/informationsystem/objectproperties/values',
    );
  }

  /**
   * Refused without a request: the 7.40 discovery lists no DDIC element info
   * (adt-clients' `corpus/adt/discovery/`, basis-740), and 7.40 has no
   * structure type to read it for (`TABL/DS` is not in its table).
   */
  override async getStructureElementInfo<E extends IAdtError = IAdtError>(
    _structureName: string,
    _options?: { accept?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    return this.refuse(
      'Structure element info',
      '/sap/bc/adt/ddic/elementinfo',
    );
  }

  /**
   * Refused without a request: the 7.40 discovery lists no service definition
   * element info, and 7.40 has no service definitions.
   */
  override async getServiceDefinitionElementInfo<
    E extends IAdtError = IAdtError,
  >(
    _serviceDefinitionName: string,
    _options?: { accept?: string } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    return this.refuse(
      'Service definition element info',
      '/sap/bc/adt/ddic/srvd/elementinfo',
    );
  }

  /**
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5, §10.2).
   */
  override async checkDeletionGroup<E extends IAdtError = IAdtError>(
    _objects: IAdtCodedReference<AdtDeletionCheckCode<'basis740'>>[],
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    return noDeletionCheck<T['deletionCheck'], E>('checkDeletionGroup');
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
  ): Promise<IAdtResponse<T['deletion'], E>> {
    return noDeletionApi<T['deletion'], E>(
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
  ): Promise<IAdtResponse<T['whereUsed'], E>> {
    return legacyRefusal<T['whereUsed'], E>(
      'getWhereUsed',
      WHERE_USED,
      WHERE_USED_ON_740,
    );
  }

  /** Refused without a request, like {@link getWhereUsed} (spec §10.2). */
  override async getWhereUsedScope<E extends IAdtError = IAdtError>(
    _params: IGetWhereUsedScopeParams<AdtWhereUsedCode<'basis740'>>,
    _options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['whereUsedScope'], E>> {
    return legacyRefusal<T['whereUsedScope'], E>(
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
  ): Promise<IAdtResponse<T['folders'], E>> {
    return legacyRefusal<T['folders'], E>(
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
  ): Promise<IAdtResponse<T['types'], E>> {
    return legacyRefusal<T['types'], E>(
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
    _options?: {
      withLongPolling?: boolean | undefined;
    } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return legacyRefusal<T['run'], E>(
      'getActivationRun',
      ACTIVATION_RUNS,
      NO_RUN_ID,
    );
  }

  /** Refused without a request, like {@link getActivationRun} (spec §10.2). */
  override async getActivationResults<E extends IAdtError = IAdtError>(
    _runId: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['results'], E>> {
    return legacyRefusal<T['results'], E>(
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
  ): Promise<IAdtResponse<T['metadata'], E>> {
    const endpoint = refusedFor(METADATA_REFUSED, objectType);
    if (endpoint)
      return refuseRead<T['metadata'], E>(
        `readObjectMetadata(${objectType})`,
        endpoint,
      );
    if (!CODES_740.has(objectType))
      return refuseCode<T['metadata'], E>('readObjectMetadata', objectType);
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
      [version?: AdtReadVersion, options?: IReadOptions & IAdtAnalyseOptions<E>]
    >
  ): Promise<IAdtResponse<T['source'], E>> {
    const endpoint = refusedFor(SOURCE_REFUSED, objectType);
    if (endpoint)
      return refuseRead<T['source'], E>(
        `readObjectSource(${objectType})`,
        endpoint,
      );
    if (!CODES_740.has(objectType))
      return refuseCode<T['source'], E>('readObjectSource', objectType);
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
  ): Promise<IAdtResponse<T['search'], E>> {
    if (
      criteria.objectType !== undefined &&
      !Object.hasOwn(ADT_SEARCH_TYPES_BASIS_740, criteria.objectType)
    )
      return legacyRefusal<T['search'], E>(
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
  ): Promise<IAdtResponse<T['node'], E>> {
    if (!CODES_740.has(parentType) && parentType !== 'DEVC/K')
      return refuseCode<T['node'], E>('fetchNodeStructure', parentType);
    return super.fetchNodeStructure(parentType, parentName, options);
  }

  /** An object structure of a code 7.40's table lacks is refused without a request. */
  override async getObjectStructure<E extends IAdtError = IAdtError>(
    objectType: AdtStructureCode<'basis740'>,
    objectName: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['objectStructure'], E>> {
    if (!CODES_740.has(objectType) && objectType !== 'DEVC/K')
      return refuseCode<T['objectStructure'], E>(
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
