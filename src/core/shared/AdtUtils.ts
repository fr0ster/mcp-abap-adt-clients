/**
 * AdtUtils - Utility Functions Wrapper
 *
 * Provides access to cross-cutting ADT utility functions that are NOT CRUD operations.
 * These functions don't implement IAdtObject interface because they are not object-specific CRUD operations.
 *
 * Utility functions include:
 * - Search operations
 * - Where-used analysis
 * - Inactive objects management
 * - Group activation/deletion
 * - Object metadata and source code reading
 * - SQL queries and table contents
 *
 * Usage:
 * ```typescript
 * const client = new AdtClient(connection, logger);
 * const utils = client.getUtils();
 *
 * // Search for objects
 * const searchResult = await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });
 *
 * // Get where-used references
 * const whereUsed = await utils.getWhereUsed({ objectName: 'ZMY_CLASS', objectType: 'CLAS' });
 *
 * // Group activation
 * await utils.activateObjectsGroup([{ type: 'DOMA', name: 'ZMY_DOMAIN' }]);
 * ```
 *
 * ## Six members removed, and what went with them
 *
 * `getTypeInfo`, `getTransaction`, `getBdef`, `getEnhancements`,
 * `getEnhancementSpot` and `getEnhancementImpl` had no callers. Not "few" —
 * every occurrence of those names in this repository and its siblings was their
 * own `@example` block, plus one legacy override that existed only to refuse
 * `getTransaction`.
 *
 * Three were a second door to a handler that is already typed, so nothing was
 * lost by closing them:
 *
 * | removed | same request, still available |
 * |---|---|
 * | `getBdef` | `AdtClient.getBehaviorDefinition().read()` |
 * | `getEnhancementImpl` | `AdtClient.getEnhancement().read()` |
 * | `getEnhancementSpot` | `AdtClient.getEnhancement().readMetadata()` |
 *
 * `getTypeInfo` was a fourth of that kind wearing a disguise: it asked
 * `/ddic/domains/{n}/source/main`, then `/ddic/dataelements/{n}`, then
 * `/ddic/tabletypes/{n}`, keeping whichever answered — three resources that
 * `getDomain()`, `getDataElement()` and `getTableType()` each read directly and
 * without guessing. Only its last resort was its own.
 *
 * That last resort is the one capability actually removed, and it is one
 * endpoint rather than two:
 *
 * ```
 * GET /sap/bc/adt/repository/informationsystem/objectproperties/values?uri={objectUri}
 * ```
 *
 * `getTypeInfo` reached it with a domain's uri and `getTransaction` with
 * `/sap/bc/adt/transactions/{name}` — the same request about different objects,
 * which is what made two members of it. Plus one endpoint nothing else reaches:
 *
 * ```
 * GET /sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements
 * ```
 *
 * Recorded here, and not only in the history of a deleted file, so a typed
 * handler can be written when somebody wants one. A generic member kept in case
 * someone needs it is a member the contract must describe and every implementer
 * must provide; adding one when the need appears is cheaper than carrying six
 * that never had one.
 */

import type {
  IAbapConnection,
  IAdtDataPreview,
  IAdtDiscovery,
  IAdtGroupLifecycle,
  IAdtInformationSystem,
  IAdtObjectAccess,
  IAdtOperationOptions,
  IAdtPackageBrowsing,
  IAdtRepositoryStructure,
  IAdtResponse,
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { answering, answeringValue } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { withRefusalDetection } from '../../utils/refusalAware';
import { rawDocument } from '../../utils/resultStrategy';
import { getTimeout } from '../../utils/timeouts';
import { getAllTypes as getAllTypesUtil } from './allTypes';
import { getDiscovery as getDiscoveryUtil } from './discovery';
import { listFunctionGroupIncludes } from './functionGroupIncludesList';
import { listFunctionModules } from './functionModulesList';
import { getInactiveObjects } from './getInactiveObjects';
import { activateObjectsGroup } from './groupActivation';
import { checkDeletionGroup, deleteObjectsGroup } from './groupDeletion';
import { getInclude as getIncludeUtil } from './include';
import { getIncludesList } from './includesList';
import { fetchNodeStructure as fetchNodeStructureUtil } from './nodeStructure';
import { getObjectStructure as getObjectStructureUtil } from './objectStructure';
import { getPackageContentsList } from './packageContentsList';
import { getPackageHierarchy } from './packageHierarchy';
// Import utility functions
import { searchObjects } from './search';
import { getSqlQuery } from './sqlQuery';
import { getTableContents } from './tableContents';
import { getVirtualFoldersContents } from './virtualFolders';
import {
  getWhereUsed,
  getWhereUsedList,
  getWhereUsedScope,
  modifyWhereUsedScope,
} from './whereUsed';

// Note: Application Logs and ATC Logs are in runtime/, not core
// They are accessed via AdtRuntime, not AdtUtils

// Note: DDIC Activation Graph is in runtime/logs/ddic.ts
// It is accessed via AdtRuntime.getDdicActivationGraph(), not AdtUtils

import {
  ACCEPT_CLASS,
  ACCEPT_DATA_ELEMENT,
  ACCEPT_DOMAIN,
  ACCEPT_FUNCTION_GROUP,
  ACCEPT_FUNCTION_MODULE,
  ACCEPT_INTERFACE,
  ACCEPT_PACKAGE,
  ACCEPT_PROGRAM,
  ACCEPT_STRUCTURE,
  ACCEPT_TABLE,
  ACCEPT_TABLE_TYPE,
  CT_VIEW,
} from '../../constants/contentTypes';
import type {
  AdtObjectType,
  AdtSourceObjectType,
  IGetDiscoveryParams,
  IGetNodeContentsOptions,
  IGetPackageContentsListOptions,
  IGetPackageContentsOptions,
  IGetPackageHierarchyOptions,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedListParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IInactiveObjectsResponse,
  IObjectReference,
  IPackageContentItem,
  IPackageHierarchyNode,
  IReadOptions,
  ISearchObjectsParams,
  IWhereUsedListResult,
} from './types';
// Import types
import { type IUtilResults, utilDocuments } from './utilResultSet';

/**
 * Declared against every atom, not only `IAdtSearchable`.
 *
 * `implements` here is what makes the compiler check this class against the
 * contract `getUtils()` hands out — the same reason decision 10 gives for a
 * factory returning a contract. Without it the class satisfies itself, and the
 * factory's declared type would be an assertion nobody verifies.
 *
 * **`IAdtSearchable` is no longer among them, and the compiler is why.** That
 * atom declares `search(criteria): Promise<ISearchResult[]>`; the information
 * system declares the same name answering `IAdtResponse`. One class cannot
 * satisfy both, and the disagreement is not cosmetic — it is the same member
 * described before and after this contract existed. `IAdtSearchable` migrates
 * with the rest of `@mcp-abap-adt/interfaces` (decision 19: member by member),
 * and until it does, the information system is the one this class answers to,
 * because that is what `getUtils()` hands out.
 *
 * The three members not in any atom — `searchObjects`, `getWhereUsed`,
 * `getPackageContents` — stay on the class and are simply not in what
 * `getUtils()` promises. Each has a contract-shaped sibling over the same
 * endpoint (`search`, `getWhereUsedList`, `getPackageContentsList`), which is
 * decision 16: one endpoint is one member, and a caller who needs the raw
 * document passes a parser to the one that has a contract.
 */
export class AdtUtils<
  R extends IUtilResults<unknown, unknown, unknown> = IUtilResults,
> implements
    IAdtInformationSystem<
      ReturnType<R['search']>,
      IWhereUsedListResult,
      ReturnType<R['types']>
    >,
    IAdtRepositoryStructure<ReturnType<R['node']>>,
    IAdtPackageBrowsing<IPackageContentItem[]>,
    IAdtGroupLifecycle<IInactiveObjectsResponse>,
    IAdtDataPreview,
    IAdtDiscovery,
    IAdtObjectAccess
{
  protected connection: IAbapConnection;
  private logger: ILogger;

  constructor(
    connection: IAbapConnection,
    logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = utilDocuments as unknown as R,
  ) {
    // Wrapped once, here, where a connection enters the library. A refusal SAP
    // sends with a 2xx would otherwise be stored as a result and reported as
    // success — see src/utils/refusalAware.ts for what that measured.
    this.connection = withRefusalDetection(connection);
    this.logger = logger;
  }

  /**
   * Objects matching a query.
   *
   * One member over one endpoint. `searchObjects` sat beside it until 31.0.0
   * issuing the identical request and handing back the envelope, and `search`
   * itself took a `parse` argument — so "how far the answer was parsed" was a
   * property of which method you called and what you passed it, rather than of
   * the implementation you were given.
   *
   * The hits are the default because they are what a caller does something
   * with: a recorded hit list runs to 473 rows and 1.3MB. A consumer who wants
   * the document passes `rawDocument` for `search` when constructing this.
   */
  async search(
    criteria: ISearchObjectsParams,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['search']>>> {
    return answering(
      () => searchObjects(this.connection, criteria),
      this.results.search as IResultStrategy<ReturnType<R['search']>>,
      options?.analyse,
    );
  }

  /**
   * Fetch virtual folder contents for hierarchical browsing.
   *
   * @param params - Virtual folder request parameters
   * @returns Virtual folder contents in XML format
   */
  async getVirtualFoldersContents(
    params: IGetVirtualFoldersContentsParams,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getVirtualFoldersContents(this.connection, params),
      rawDocument,
    );
  }

  /**
   * Where-used Step 1: fetch scope configuration.
   *
   * ADT exposes where-used as a two-step flow. First you request the "scope" XML
   * (available object types + default selections). You can then modify that XML
   * to include/exclude types before executing the search.
   *
   * Returns available object types that can be searched for where-used references.
   * Consumer can parse the XML response, present options to user, and modify selections.
   *
   * @param params - Scope parameters
   * @returns Scope XML with available object types (isSelected, isDefault attributes)
   *
   * @example
   * // Get scope for a class
   * const scopeResponse = await utils.getWhereUsedScope({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class'
   * });
   *
   * // Parse and display types to user, then modify XML
   * let scopeXml = scopeResponse.data;
   * // Enable function modules in search
   * scopeXml = scopeXml.replace(/name="FUGR\/FF" isSelected="false"/, 'name="FUGR/FF" isSelected="true"');
   *
   * // Execute search with modified scope
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class',
   *   scopeXml: scopeXml
   * });
   */
  async getWhereUsedScope(
    params: IGetWhereUsedScopeParams,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getWhereUsedScope(this.connection, params),
      rawDocument,
    );
  }

  /**
   * Where-used helper: modify scope XML.
   *
   * This is a local helper (no ADT call). It toggles `isSelected` flags in the scope
   * XML produced by `getWhereUsedScope`, so you can control which object types are
   * included when you call `getWhereUsed`.
   *
   * @param scopeXml - Scope XML from getWhereUsedScope()
   * @param options - Modification options
   * @returns Modified scope XML
   *
   * @example
   * const scopeResponse = await utils.getWhereUsedScope({ object_name: 'ZMY_CLASS', object_type: 'class' });
   * let scopeXml = scopeResponse.data;
   *
   * // Enable function modules in search
   * scopeXml = utils.modifyWhereUsedScope(scopeXml, { enable: ['FUGR/FF'] });
   *
   * // Search only in classes and interfaces
   * scopeXml = utils.modifyWhereUsedScope(scopeXml, { enableOnly: ['CLAS/OC', 'INTF/OI'] });
   *
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class',
   *   scopeXml: scopeXml
   * });
   */
  modifyWhereUsedScope(
    scopeXml: string,
    options: {
      enableAll?: boolean;
      enableOnly?: string[];
      enable?: string[];
      disable?: string[];
    },
  ): string {
    return modifyWhereUsedScope(scopeXml, options);
  }

  /**
   * Where-used: execute search.
   *
   * Performs the where-used search for an object. When a scope XML is supplied
   * the search is narrowed to those object types; when omitted it runs unscoped
   * against SAP's default selection. This posts directly to /usageReferences and
   * does NOT fetch the /usageReferences/scope sub-resource, so it works on
   * systems that do not expose it.
   *
   * @param params - Where-used parameters
   * @param params.object_name - Name of the object to search
   * @param params.object_type - Type of the object (class, table, etc.)
   * @param params.scopeXml - Optional scope XML from getWhereUsedScope(). When omitted, the search runs unscoped (SAP's default selection); no scope is fetched.
   * @returns Where-used references in XML format
   *
   * @example
   * // Simple usage with default scope
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class'
   * });
   *
   * // Advanced: use custom scope from getWhereUsedScope()
   * const scopeResponse = await utils.getWhereUsedScope({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class'
   * });
   * let scopeXml = scopeResponse.data;
   * // Modify selections...
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class',
   *   scopeXml: scopeXml
   *   searchInAllTypes: ['CLAS/OC', 'INTF/OI']
   * });
   */
  async getWhereUsed(
    params: IGetWhereUsedParams,
  ): Promise<IAdtResponse<string>> {
    return answering(() => getWhereUsed(this.connection, params), rawDocument);
  }

  /**
   * Get where-used references with parsed results
   *
   * This is a convenience method that combines scope fetching, search execution,
   * and XML parsing into a single call with structured output.
   *
   * @param params - Where-used list parameters
   * @returns Parsed where-used results with references list
   *
   * @example
   * ```typescript
   * const result = await utils.getWhereUsedList({
   *   object_name: 'ZMY_TABLE',
   *   object_type: 'table',
   *   enableAllTypes: true
   * });
   *
   * console.log(`Found ${result.totalReferences} references`);
   * for (const ref of result.references) {
   *   console.log(`${ref.name} (${ref.type}) in package ${ref.packageName}`);
   * }
   * ```
   */
  async getWhereUsedList(
    params: IGetWhereUsedListParams,
  ): Promise<IAdtResponse<IWhereUsedListResult>> {
    return answeringValue(() => getWhereUsedList(this.connection, params));
  }

  /**
   * Get list of inactive objects (objects that are not yet activated)
   *
   * @param options - Optional parameters
   * @returns List of inactive objects with their metadata
   */
  async getInactiveObjects(options?: {
    includeRawXml?: boolean;
  }): Promise<IAdtResponse<IInactiveObjectsResponse>> {
    return answeringValue(() => getInactiveObjects(this.connection, options));
  }

  /**
   * Activate multiple objects in a group
   *
   * @param objects - Array of object references to activate
   * @param preauditRequested - Whether to request pre-audit
   * @returns Activation result
   */
  async activateObjectsGroup(
    objects: IObjectReference[],
    preauditRequested: boolean = false,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => activateObjectsGroup(this.connection, objects, preauditRequested),
      rawDocument,
    );
  }

  /**
   * Check if multiple objects can be deleted (group deletion check)
   *
   * @param objects - Array of object references to check
   * @returns Check result
   */
  async checkDeletionGroup(
    objects: IObjectReference[],
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => checkDeletionGroup(this.connection, objects),
      rawDocument,
    );
  }

  /**
   * Delete multiple objects in a group
   *
   * @param objects - Array of object references to delete
   * @param transportRequest - Optional transport request
   * @returns Delete result
   */
  async deleteObjectsGroup(
    objects: IObjectReference[],
    transportRequest?: string,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => deleteObjectsGroup(this.connection, objects, transportRequest),
      rawDocument,
    );
  }

  /**
   * Read object metadata (without source code)
   *
   * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param options - Optional read options
   * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
   * @param options.accept - Optional Accept override for the metadata request
   * @returns Metadata response
   */
  async readObjectMetadata(
    objectType: AdtObjectType,
    objectName: string,
    functionGroup?: string,
    options?: IReadOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () =>
        this.objectMetadataWire(objectType, objectName, functionGroup, options),
      rawDocument,
    );
  }

  /**
   * The metadata answer itself, for callers inside this package.
   *
   * The contract member above answers a document, because that is what a
   * consumer of {@link IAdtObjectAccess} reads. The per-type request functions
   * need the answer whole — status and headers included — so that the handler
   * can apply *its* consumer's strategy to it, and reading it here would throw
   * that away and make them read it back out of a string.
   */
  async objectMetadataWire(
    objectType: AdtObjectType,
    objectName: string,
    functionGroup?: string,
    options?: IReadOptions,
  ): Promise<IAdtWireResponse> {
    let uri = getObjectMetadataUri(objectType, objectName, functionGroup);
    const params = [];
    if (options?.version) {
      params.push(`version=${options.version}`);
    }
    if (options?.withLongPolling) {
      params.push('withLongPolling=true');
    }
    if (params.length > 0) {
      uri += `?${params.join('&')}`;
    }
    const acceptHeader = options?.accept ?? getMetadataAcceptHeader(objectType);
    return makeAdtRequestWithAcceptNegotiation(
      this.connection,
      {
        url: uri,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
          Accept: acceptHeader,
        },
      },
      {
        logger: this.logger,
      },
    );
  }

  /**
   * Read object source code
   * Only works for objects that have source code (class, program, interface, etc.)
   *
   * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param version - 'active' or 'inactive'
   * @param options - Optional read options
   * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
   * @param options.accept - Optional Accept override for the source request
   * @returns Source code response
   */
  async readObjectSource(
    objectType: AdtSourceObjectType,
    objectName: string,
    functionGroup?: string,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () =>
        this.objectSourceWire(
          objectType,
          objectName,
          functionGroup,
          version,
          options,
        ),
      rawDocument,
    );
  }

  /** The source answer itself — see {@link objectMetadataWire}. */
  async objectSourceWire(
    objectType: AdtSourceObjectType,
    objectName: string,
    functionGroup?: string,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<IAdtWireResponse> {
    if (!supportsSourceCode(objectType)) {
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
    }

    let uri = getObjectSourceUri(
      objectType,
      objectName,
      functionGroup,
      version,
    );
    if (options?.withLongPolling) {
      const separator = uri.includes('?') ? '&' : '?';
      uri += `${separator}withLongPolling=true`;
    }

    const acceptHeader = options?.accept ?? 'text/plain';
    return makeAdtRequestWithAcceptNegotiation(
      this.connection,
      {
        url: uri,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
          Accept: acceptHeader,
        },
      },
      {
        logger: this.logger,
      },
    );
  }

  /**
   * Check if object type supports source code reading
   *
   * @param objectType - Object type to check
   * @returns true if object type supports source code reading
   */
  supportsSourceCode(objectType: AdtObjectType): boolean {
    return supportsSourceCode(objectType);
  }

  /**
   * Get object source URI based on object type
   *
   * @param objectType - Object type
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param version - 'active' or 'inactive'
   * @returns Source URI
   */
  getObjectSourceUri(
    objectType: AdtSourceObjectType,
    objectName: string,
    functionGroup?: string,
    version?: 'active' | 'inactive',
  ): string {
    return getObjectSourceUri(objectType, objectName, functionGroup, version);
  }

  /**
   * Execute SQL query via ADT Data Preview API
   * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
   *
   * @param params - SQL query parameters
   * @returns Query result
   */
  async getSqlQuery(params: IGetSqlQueryParams): Promise<IAdtResponse<string>> {
    return answering(() => getSqlQuery(this.connection, params), rawDocument);
  }

  /**
   * Get table contents via ADT Data Preview API
   * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
   *
   * @param params - Table contents parameters
   * @returns Table contents result
   */
  async getTableContents(
    params: IGetTableContentsParams,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getTableContents(this.connection, params),
      rawDocument,
    );
  }

  /**
   * Fetch ADT discovery document with endpoint catalog
   *
   * @param params - Optional request/timeout options
   * @returns Axios response with discovery XML
   */
  async discovery(
    params: IGetDiscoveryParams = {},
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getDiscoveryUtil(this.connection, params),
      rawDocument,
    );
  }

  /**
   * Fetch node structure from ADT repository
   *
   * Used for object tree navigation and structure discovery.
   *
   * @param parentType - Parent object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
   * @param parentName - Parent object name
   * @param nodeId - Optional node ID (default: '0000' for root)
   * @param withShortDescriptions - Include short descriptions (default: true)
   * @returns Axios response with XML containing node structure
   *
   * @example
   * ```typescript
   * const response = await utils.fetchNodeStructure('CLAS/OC', 'ZMY_CLASS', '0000');
   * ```
   */
  async fetchNodeStructure(
    parentType: string,
    parentName: string,
    options?: IGetNodeContentsOptions,
  ): Promise<IAdtResponse<ReturnType<R['node']>>> {
    return answering(
      () =>
        fetchNodeStructureUtil(
          this.connection,
          parentType,
          parentName,
          options?.nodeId,
          options?.withShortDescriptions ?? true,
        ),
      this.results.node as IResultStrategy<ReturnType<R['node']>>,
    );
  }

  /**
   * Get list of includes for ABAP object
   *
   * Recursively discovers and lists all include files within an ABAP program or include.
   *
   * @param objectName - Object name (program or include)
   * @param objectType - Object type: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC'
   * @param timeout - Optional timeout in milliseconds (default: 30000)
   * @returns Array of include names
   *
   * @example
   * ```typescript
   * const includes = await utils.getIncludesList('ZMY_PROGRAM', 'PROG/P');
   * // Returns: ['ZMY_INCLUDE1', 'ZMY_INCLUDE2', ...]
   * ```
   */
  async getIncludesList(
    objectName: string,
    objectType: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC',
    timeout: number = 30000,
  ): Promise<IAdtResponse<string[]>> {
    return answeringValue(() =>
      getIncludesList(this.connection, objectName, objectType, timeout),
    );
  }

  /**
   * List the function modules of a function group.
   *
   * @example
   * const fms = await utils.listFunctionModules('ZMY_FUGR');
   * // Returns: ['Z_MY_FM1', 'Z_MY_FM2']
   */
  async listFunctionModules(
    functionGroupName: string,
  ): Promise<IAdtResponse<string[]>> {
    return answeringValue(() =>
      listFunctionModules(this.connection, functionGroupName),
    );
  }

  /**
   * List the includes of a function group (TOP, UXX collector, custom includes).
   *
   * Complements listFunctionModules: includes hold code that is not part of any
   * function module (global data/types in TOP, FORM routines in custom includes),
   * so a complete function-group backup needs them.
   *
   * @example
   * const includes = await utils.listFunctionGroupIncludes('ZMY_FUGR');
   * // Returns: ['LZMY_FUGRTOP', 'LZMY_FUGRUXX', ...]
   */
  async listFunctionGroupIncludes(
    functionGroupName: string,
  ): Promise<IAdtResponse<string[]>> {
    return answeringValue(() =>
      listFunctionGroupIncludes(this.connection, functionGroupName),
    );
  }

  /**
   * Get package contents as raw XML
   *
   * Low-level method that retrieves package contents as raw XML response.
   * For most use cases, prefer getPackageContentsList() or getPackageHierarchy().
   *
   * @param packageName - Package name
   * @returns Axios response with XML containing package contents
   *
   * @example
   * ```typescript
   * const response = await utils.getPackageContents('ZMY_PACKAGE');
   * // Response contains XML with objects in the package
   * ```
   */
  async getPackageContents(
    packageName: string,
    options?: IGetPackageContentsOptions,
  ): Promise<IAdtResponse<IPackageContentItem[]>> {
    // The contract asks what a package holds, not which requests were made to
    // find out — so this is the flat listing, which is the answer to that
    // question. The single node-structure request that used to stand in for it
    // answered one level of a tree and left the caller to walk the rest.
    return answeringValue(() =>
      getPackageContentsList(
        this.connection,
        packageName,
        { includeDescriptions: options?.withShortDescriptions },
        this.logger,
      ),
    );
  }

  /**
   * Get package contents as a flat list
   *
   * Returns all objects in a package as a flat array. This is a convenient
   * wrapper that fetches all object categories and returns them in a single list.
   *
   * @param packageName - Package name
   * @param options - Optional options for fetching
   * @returns Array of package content items
   *
   * @example
   * ```typescript
   * const items = await utils.getPackageContentsList('ZMY_PACKAGE');
   * // Returns: [{ name: 'ZCL_MY_CLASS', type: 'CLAS/OC', description: '...' }, ...]
   *
   * // Include subpackage contents recursively
   * const allItems = await utils.getPackageContentsList('ZMY_PACKAGE', {
   *   includeSubpackages: true,
   * });
   * ```
   */
  async getPackageContentsList(
    packageName: string,
    options?: IGetPackageContentsListOptions,
  ): Promise<IAdtResponse<IPackageContentItem[]>> {
    return answeringValue(() =>
      getPackageContentsList(
        this.connection,
        packageName,
        options,
        this.logger,
      ),
    );
  }

  /**
   * Get package hierarchy as a tree structure
   *
   * Builds a tree of package contents and subpackages using node structure.
   *
   * @param packageName - Package name
   * @param options - Optional hierarchy options
   * @returns Root tree node for the package hierarchy
   *
   * @example
   * ```typescript
   * const tree = await utils.getPackageHierarchy('ZMY_PACKAGE', {
   *   includeSubpackages: true,
   *   maxDepth: 5,
   *   includeDescriptions: true,
   * });
   * // tree contains package, subpackages, and objects in a hierarchy
   * ```
   */
  async getPackageHierarchy(
    packageName: string,
    options?: IGetPackageHierarchyOptions,
  ): Promise<IAdtResponse<IPackageHierarchyNode>> {
    return answeringValue(() =>
      getPackageHierarchy(this.connection, packageName, options, this.logger),
    );
  }

  /**
   * Get object structure from ADT repository
   *
   * Retrieves ADT object structure as compact JSON tree.
   *
   * @param objectType - Object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
   * @param objectName - Object name
   * @returns Axios response with XML containing object structure tree
   *
   * @example
   * ```typescript
   * const response = await utils.getObjectStructure('CLAS/OC', 'ZMY_CLASS');
   * ```
   */
  async getObjectStructure(
    objectType: string,
    objectName: string,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getObjectStructureUtil(this.connection, objectType, objectName),
      rawDocument,
    );
  }

  /**
   * Get include source code
   *
   * Retrieves source code of specific ABAP include file.
   *
   * @param includeName - Include name
   * @returns Axios response with source code (plain text)
   *
   * @example
   * ```typescript
   * const response = await utils.getInclude('ZMY_INCLUDE');
   * const sourceCode = response.data; // Include source code
   * ```
   */
  async getInclude(includeName: string): Promise<IAdtResponse<string>> {
    return answering(
      () => getIncludeUtil(this.connection, includeName),
      rawDocument,
    );
  }

  /**
   * Get all valid ADT object types
   *
   * Retrieves list of all valid ADT object types from the repository.
   *
   * @param maxItemCount - Maximum number of items to return (default: 999)
   * @param name - Name filter pattern (default: '*')
   * @param data - Data filter (default: 'usedByProvider')
   * @returns Axios response with XML containing all object types
   *
   * @example
   * ```typescript
   * const response = await utils.getAllTypes();
   * // Response contains XML with all ADT object types
   * ```
   */
  async getAllTypes(
    maxItemCount: number = 999,
    name: string = '*',
    data: string = 'usedByProvider',
  ): Promise<IAdtResponse<ReturnType<R['types']>>> {
    return answering(
      () => getAllTypesUtil(this.connection, maxItemCount, name, data),
      this.results.types as IResultStrategy<ReturnType<R['types']>>,
    );
  }
}

function getObjectMetadataUri(
  objectType: AdtObjectType,
  objectName: string,
  functionGroup?: string,
): string {
  const encodedName = encodeSapObjectName(objectName);

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'functionmodule':
    case 'fugr/ff': {
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      const encodedGroup = encodeSapObjectName(functionGroup);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}`;
    case 'domain':
    case 'doma/dd':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'dataelement':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'functiongroup':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    default:
      throw new Error(`Unsupported object type for metadata: ${objectType}`);
  }
}

function getMetadataAcceptHeader(objectType: AdtObjectType): string {
  const type = objectType.toLowerCase();

  switch (type) {
    case 'class':
    case 'clas/oc':
      return ACCEPT_CLASS;
    case 'interface':
    case 'intf/if':
      return ACCEPT_INTERFACE;
    case 'table':
    case 'tabl/dt':
      return ACCEPT_TABLE;
    case 'tabletype':
    case 'ttyp/df':
      return ACCEPT_TABLE_TYPE;
    case 'domain':
    case 'doma/dd':
      return ACCEPT_DOMAIN;
    case 'dataelement':
    case 'dtel':
      return ACCEPT_DATA_ELEMENT;
    case 'structure':
    case 'stru/dt':
      return ACCEPT_STRUCTURE;
    case 'view':
    case 'ddls/df':
      return CT_VIEW;
    case 'program':
    case 'prog/p':
      return ACCEPT_PROGRAM;
    case 'functiongroup':
    case 'fugr':
      return ACCEPT_FUNCTION_GROUP;
    case 'functionmodule':
    case 'fugr/ff':
      return ACCEPT_FUNCTION_MODULE;
    case 'package':
    case 'devc/k':
      return ACCEPT_PACKAGE;
    default:
      return 'application/xml';
  }
}

function getObjectSourceUri(
  objectType: AdtSourceObjectType,
  objectName: string,
  functionGroup?: string,
  version?: 'active' | 'inactive',
): string {
  const encodedName = encodeSapObjectName(objectName);
  const versionParam = version ? `?version=${version}` : '';

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}/source/main${versionParam}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}/source/main${versionParam}`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}/source/main${versionParam}`;
    case 'functionmodule':
    case 'fugr/ff': {
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      const encodedGroup = encodeSapObjectName(functionGroup);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main${versionParam}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main${versionParam}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}/source/main${versionParam}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}/source/main${versionParam}`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${versionParam}`;
    default:
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
  }
}

function supportsSourceCode(objectType: AdtObjectType): boolean {
  const supportedTypes = [
    'class',
    'clas/oc',
    'program',
    'prog/p',
    'interface',
    'intf/if',
    'functionmodule',
    'fugr/ff',
    'view',
    'ddls/df',
    'structure',
    'stru/dt',
    'table',
    'tabl/dt',
    'tabletype',
    'ttyp/df',
  ];
  return supportedTypes.includes(objectType.toLowerCase());
}
