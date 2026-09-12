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
  IAdtError,
  IAdtGroupLifecycle,
  IAdtInformationSystem,
  IAdtObjectAccess,
  IAdtOperationOptions,
  IAdtRepositoryStructure,
  IAdtResponse,
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { answering, answeringValue } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { withRequestTrace } from '../../utils/requestTrace';
import { getTimeout } from '../../utils/timeouts';
import { getAllTypes as getAllTypesUtil } from './allTypes';
import { getDiscovery as getDiscoveryUtil } from './discovery';
import { fetchInactiveObjects } from './getInactiveObjects';
import {
  activateObjectsGroup,
  getActivationResults,
  getActivationRun,
} from './groupActivation';
import { checkDeletionGroup, deleteObjectsGroup } from './groupDeletion';
import { getInclude as getIncludeUtil } from './include';
import { fetchNodeStructure as fetchNodeStructureUtil } from './nodeStructure';
import { getObjectStructure as getObjectStructureUtil } from './objectStructure';
import {
  getMetadataAcceptHeader,
  getObjectMetadataUri,
  getObjectSourceUri,
  objectMetadataWire,
  objectSourceWire,
  supportsSourceCode,
} from './objectWire';
// Import utility functions
import { searchObjects } from './search';
import { getSqlQuery } from './sqlQuery';
import { getTableColumns, getTableContents } from './tableContents';
import { getVirtualFoldersContents } from './virtualFolders';
import {
  getWhereUsed,
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
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IObjectReference,
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
 * **The package walk is gone, and with it `IAdtPackageBrowsing`.** A walk is
 * one node-structure request per object type plus a descent into subpackages,
 * so `IResultStrategy` — which takes one answer — could never be given for it,
 * and the class shipped one member per reading instead: a flat list and a tree.
 * That is the growth the strategy axis exists to prevent. The walk is assembled
 * by the caller over `fetchNodeStructure`, which is a single request and keeps
 * its `node` reading. The atom stays in `@mcp-abap-adt/interfaces` for whoever
 * implements it; this class no longer claims it.
 *
 * And it said a caller who needs another shape "passes a parser" to the sibling.
 * The parser overloads went in 30.0.0, when the reading became something
 * injected once rather than passed per call — and since 19.0.0 there is nothing
 * left that a reading cannot reach. Every member below that makes a request
 * takes its shape from a slot of `IUtilResults`, all twenty of them. The three
 * that take none — `modifyWhereUsedScope`, `supportsSourceCode` and
 * `getObjectSourceUri` — make no request, so there is no answer for a strategy
 * to read.
 */
export class AdtUtils<R extends IUtilResults = typeof utilDocuments>
  implements
    IAdtInformationSystem<
      ReturnType<R['search']>,
      ReturnType<R['whereUsed']>,
      ReturnType<R['whereUsedScope']>,
      ReturnType<R['folders']>,
      ReturnType<R['types']>
    >,
    IAdtRepositoryStructure<
      ReturnType<R['node']>,
      ReturnType<R['objectStructure']>
    >,
    IAdtGroupLifecycle<
      ReturnType<R['inactive']>,
      ReturnType<R['activation']>,
      ReturnType<R['run']>,
      ReturnType<R['results']>,
      ReturnType<R['deletionCheck']>,
      ReturnType<R['deletion']>
    >,
    IAdtDataPreview<
      ReturnType<R['query']>,
      ReturnType<R['columns']>,
      ReturnType<R['contents']>
    >,
    IAdtDiscovery<ReturnType<R['discovery']>>,
    IAdtObjectAccess<
      ReturnType<R['source']>,
      ReturnType<R['metadata']>,
      ReturnType<R['include']>
    >
{
  protected connection: IAbapConnection;
  private logger: ILogger;

  constructor(
    connection: IAbapConnection,
    logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = utilDocuments as unknown as R,
  ) {
    // Wrapped once, here, where a connection enters the library. The wrapper
    // puts the request back on the answer and reads nothing: what a body means
    // is the caller's, through the `analyse` they pass.
    this.connection = withRequestTrace(connection);
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
  async search<E extends IAdtError = IAdtError>(
    criteria: ISearchObjectsParams,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['search']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => searchObjects(connection, criteria),
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
  ): Promise<IAdtResponse<ReturnType<R['folders']>>> {
    return answering(
      () => getVirtualFoldersContents(this.connection, params),
      this.results.folders as IResultStrategy<ReturnType<R['folders']>>,
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
  ): Promise<IAdtResponse<ReturnType<R['whereUsedScope']>>> {
    return answering(
      () => getWhereUsedScope(this.connection, params),
      this.results.whereUsedScope as IResultStrategy<
        ReturnType<R['whereUsedScope']>
      >,
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
  ): Promise<IAdtResponse<ReturnType<R['whereUsed']>>> {
    return answering(
      () => getWhereUsed(this.connection, params),
      this.results.whereUsed as IResultStrategy<ReturnType<R['whereUsed']>>,
    );
  }

  /**
   * Get list of inactive objects (objects that are not yet activated)
   *
   * @param options - Optional parameters
   * @returns List of inactive objects with their metadata
   */
  async getInactiveObjects(): Promise<IAdtResponse<ReturnType<R['inactive']>>> {
    // One GET, one answer, one reading — injected like every other. The
    // `includeRawXml` flag is gone with it: a consumer who wants the document
    // passes `rawDocument` as the `inactive` strategy, which is the same
    // removal `getWhereUsedList`'s flag got.
    return answering(
      () => fetchInactiveObjects(this.connection),
      this.results.inactive as IResultStrategy<ReturnType<R['inactive']>>,
    );
  }

  /**
   * Activate multiple objects in a group
   *
   * @param objects - Array of object references to activate
   * @param preauditRequested - Whether to request pre-audit
   * @returns Activation result
   */
  /**
   * Start an activation run — `/activation/runs`.
   *
   * One POST. It answers the **run id**, not the body: the server puts it in
   * `Location` and the body carries nothing a caller needs, while both members
   * that continue the sequence — {@link getActivationRun} and
   * {@link getActivationResults} — take an id.
   *
   * `activationRunId` is the **default** for the `activation` slot, and it is
   * exported: a caller who keeps the exchange passes `wireItself` instead and
   * pulls the id out later, and `extractRunId` reads a `Location` value
   * directly.
   */
  async activateObjectsGroup(
    objects: IObjectReference[],
    preauditRequested: boolean = false,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    return answering(
      () => activateObjectsGroup(this.connection, objects, preauditRequested),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
    );
  }

  /**
   * What an activation run produced — `/activation/results/{runId}`.
   *
   * One request. {@link activateObjectsGroup} starts the run and answers; the
   * run id is in its `Location` header, and `extractRunId` reads it. How long
   * to wait before asking for the results is the caller's decision, which is
   * why this is a separate member rather than a step inside that one.
   */
  /**
   * What an activation run is doing — `/activation/runs/{runId}`.
   *
   * One request. `withLongPolling` holds it open on the server rather than
   * answering immediately, so a caller waits without a tight loop. What the
   * document's `runs:status` means — and which value ends their wait — is
   * theirs to read.
   */
  async getActivationRun(
    runId: string,
    options?: { withLongPolling?: boolean },
  ): Promise<IAdtResponse<ReturnType<R['run']>>> {
    return answering(
      () => getActivationRun(this.connection, runId, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
    );
  }

  async getActivationResults(
    runId: string,
  ): Promise<IAdtResponse<ReturnType<R['results']>>> {
    return answering(
      () => getActivationResults(this.connection, runId),
      this.results.results as IResultStrategy<ReturnType<R['results']>>,
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
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>>> {
    return answering(
      () => checkDeletionGroup(this.connection, objects),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
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
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    return answering(
      () => deleteObjectsGroup(this.connection, objects, transportRequest),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
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
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    // Built here, not inside the request: `getObjectMetadataUri` refuses a type
    // it has no resource for, and that is the caller's mistake. Classified
    // inside `answering` it would come back as `origin: 'connection'`, pointing
    // at a network nothing reached.
    getObjectMetadataUri(objectType, objectName, functionGroup);

    return answering(
      () =>
        objectMetadataWire(
          this.connection,
          objectType,
          objectName,
          functionGroup,
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
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
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    // Raised before anything is asked, rather than dressed as a verdict about
    // the server: a type with no source resource, and a function module with no
    // function group, are both the caller's mistake. `getObjectSourceUri` is
    // pure, so building the URI here is how its own guards surface as
    // themselves — inside `answering` they came back as
    // `origin: 'connection'`, advice to check a network nothing reached.
    if (!supportsSourceCode(objectType)) {
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
    }
    getObjectSourceUri(objectType, objectName, functionGroup, version);

    return answering(
      () =>
        objectSourceWire(
          this.connection,
          objectType,
          objectName,
          functionGroup,
          version,
          options,
          this.logger,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
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
  async getSqlQuery(
    params: IGetSqlQueryParams,
  ): Promise<IAdtResponse<ReturnType<R['query']>>> {
    return answering(
      () => getSqlQuery(this.connection, params),
      this.results.query as IResultStrategy<ReturnType<R['query']>>,
    );
  }

  /**
   * The columns a DDIC entity has — `/datapreview/ddic/{name}/metadata`.
   *
   * One request. It exists because {@link getTableContents} no longer makes it:
   * the statement is the caller's, and this is where they learn what they may
   * name in it.
   */
  async getTableColumns(
    tableName: string,
  ): Promise<IAdtResponse<ReturnType<R['columns']>>> {
    return answering(
      () => getTableColumns(this.connection, tableName),
      this.results.columns as IResultStrategy<ReturnType<R['columns']>>,
    );
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
  ): Promise<IAdtResponse<ReturnType<R['contents']>>> {
    return answering(
      () => getTableContents(this.connection, params),
      this.results.contents as IResultStrategy<ReturnType<R['contents']>>,
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
  ): Promise<IAdtResponse<ReturnType<R['discovery']>>> {
    return answering(
      () => getDiscoveryUtil(this.connection, params),
      this.results.discovery as IResultStrategy<ReturnType<R['discovery']>>,
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
  ): Promise<IAdtResponse<ReturnType<R['objectStructure']>>> {
    return answering(
      () => getObjectStructureUtil(this.connection, objectType, objectName),
      this.results.objectStructure as IResultStrategy<
        ReturnType<R['objectStructure']>
      >,
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
  async getInclude(
    includeName: string,
  ): Promise<IAdtResponse<ReturnType<R['include']>>> {
    return answering(
      () => getIncludeUtil(this.connection, includeName),
      this.results.include as IResultStrategy<ReturnType<R['include']>>,
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
