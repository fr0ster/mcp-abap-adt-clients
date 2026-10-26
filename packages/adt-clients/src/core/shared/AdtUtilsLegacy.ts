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

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import {
  AdtObjectErrorCodes,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtResponse,
  type IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import {
  DATA_ELEMENT,
  DOMAIN,
  PACKAGE,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
} from '../../endpoints/objects';
import { buildObjectUri } from '../../utils/activationUtils';
import { answering, failed } from '../../utils/adtResponse';
import { requestHeaders } from '../../utils/requestHeaders';
import { AdtUtils } from './AdtUtils';
import {
  legacyRefusal,
  legacyUnmeasuredRefusal,
  noDeletionApi,
  noDeletionCheck,
} from './refusalLegacy';
import type {
  AdtObjectType,
  AdtSourceObjectType,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IObjectReference,
  IReadOptions,
} from './types';
import type { IUtilResults, utilDocuments } from './utilResultSet';

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
  '7.40 serves object types through repository/typestructure, which this library does not implement.';
const NO_RUN_ID =
  'A legacy activateObjectsGroup is the synchronous /sap/bc/adt/activation: its answer is the result, and there is no run id to ask about.';

const PACKAGE_ITEM = `${PACKAGE.collection}/{name}`;
/**
 * The DDIC types 7.40 does not serve through these reads, by every alias the
 * switches in `objectWire` accept (lower case), to the endpoint it lacks.
 */
const METADATA_REFUSED: Readonly<Record<string, string>> = {
  domain: DOMAIN.collection,
  'doma/dd': DOMAIN.collection,
  dataelement: DATA_ELEMENT.collection,
  dtel: DATA_ELEMENT.collection,
  'dtel/de': DATA_ELEMENT.collection,
  structure: STRUCTURE.collection,
  'stru/dt': STRUCTURE.collection,
  table: TABLE.collection,
  'tabl/dt': TABLE.collection,
  tabletype: TABLE_TYPE.collection,
  'ttyp/df': TABLE_TYPE.collection,
  package: PACKAGE_ITEM,
  'devc/k': PACKAGE_ITEM,
};
const SOURCE_REFUSED: Readonly<Record<string, string>> = {
  structure: STRUCTURE.collection,
  'stru/dt': STRUCTURE.collection,
  table: TABLE.collection,
  'tabl/dt': TABLE.collection,
  tabletype: TABLE_TYPE.collection,
  'ttyp/df': TABLE_TYPE.collection,
};

/** The endpoint 7.40 lacks for `objectType`, or `undefined` when it is served. */
function refusedFor(
  table: Readonly<Record<string, string>>,
  objectType: string,
): string | undefined {
  const type = objectType.toLowerCase();
  return Object.hasOwn(table, type) ? table[type] : undefined;
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

export class AdtUtilsLegacy<
  R extends IUtilResults = typeof utilDocuments,
> extends AdtUtils<R> {
  /**
   * Legacy group activation — synchronous POST to /sap/bc/adt/activation
   *
   * Modern systems use async /sap/bc/adt/activation/runs with polling.
   * Legacy systems use synchronous /sap/bc/adt/activation. A success answers
   * `200` with an empty body, not a checklist: BASIS 7.40 activated six objects
   * that way, and only `/activation/inactiveobjects` afterwards said so
   * (measured on premise, 2026-10-01; docs/architecture/LEGACY.md, "Measured
   * on BASIS 7.40").
   *
   * Read through the same `activation` slot as the modern run. The default keeps
   * the document, which here is the result itself; `utilActivationRunId` would
   * find no run id in it and answer `''`, so a caller on a legacy system does
   * not pass that one.
   */
  override async activateObjectsGroup<E extends IAdtError = IAdtError>(
    objects: IObjectReference[],
    preauditRequested: boolean = false,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`;

    const objectReferences = objects
      .map((obj) => {
        const uri = buildObjectUri(obj.name, obj.type, obj.parentName);
        const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
        return `  <adtcore:objectReference adtcore:uri="${uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
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
    _objects: IObjectReference[],
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
    _objects: IObjectReference[],
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
    _params: IGetWhereUsedParams,
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
    _params: IGetWhereUsedScopeParams,
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
  override async readObjectMetadata<E extends IAdtError = IAdtError>(
    objectType: AdtObjectType,
    objectName: string,
    functionGroup?: string,
    options?: IReadOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const endpoint = refusedFor(METADATA_REFUSED, objectType);
    if (endpoint)
      return refuseRead<ReturnType<R['metadata']>, E>(
        `readObjectMetadata(${objectType})`,
        endpoint,
      );
    return super.readObjectMetadata(
      objectType,
      objectName,
      functionGroup,
      options,
    );
  }

  /**
   * A structure, a table or a table type is refused without a request (spec
   * §10.2); every other type goes to the base as it is.
   */
  override async readObjectSource<E extends IAdtError = IAdtError>(
    objectType: AdtSourceObjectType,
    objectName: string,
    functionGroup?: string,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const endpoint = refusedFor(SOURCE_REFUSED, objectType);
    if (endpoint)
      return refuseRead<ReturnType<R['source']>, E>(
        `readObjectSource(${objectType})`,
        endpoint,
      );
    return super.readObjectSource(
      objectType,
      objectName,
      functionGroup,
      version,
      options,
    );
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
