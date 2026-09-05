/**
 * ADT Clients — readings
 *
 * A member's result type is a type parameter of its contract, and what the
 * answer *becomes* is a strategy this package implements and a consumer may
 * replace. Everything needed to do that is here: the strategy implementations,
 * one result-set interface per object type, the shipped default for each, and
 * the shapes those defaults build.
 *
 * Without this barrel the injection point is unreachable from outside the
 * package — the contracts would name a seam nobody could reach, which is the
 * opposite of what they are for.
 *
 * `IResultStrategy` itself is **not** here. It is the contract's, and comes
 * from `@mcp-abap-adt/interfaces` like every other type this package does not
 * own.
 */

export type { IAccessControlResults } from './core/accessControl/types';
export { accessControlDocuments } from './core/accessControl/types';
export type { IAppendStructureResults } from './core/appendStructure/types';
export { appendStructureDocuments } from './core/appendStructure/types';
export type { IAuthorizationFieldResults } from './core/authorizationField/types';
export { authorizationFieldDocuments } from './core/authorizationField/types';
export type { IBehaviorDefinitionResults } from './core/behaviorDefinition/types';
export { behaviorDefinitionDocuments } from './core/behaviorDefinition/types';
export type { IClassResults } from './core/class/types';
export { classDocuments } from './core/class/types';
export type { IDataElementResults } from './core/dataElement/types';
export { dataElementDocuments } from './core/dataElement/types';
export type { IDdlResults } from './core/ddl/types';
export { ddlDocuments } from './core/ddl/types';
export type { IDomainResults } from './core/domain/types';
export { domainDocuments } from './core/domain/types';
export type { IEnhancementResults } from './core/enhancement/types';
export { enhancementDocuments } from './core/enhancement/types';
export type { IFeatureToggleResults } from './core/featureToggle/types';
export { featureToggleDocuments } from './core/featureToggle/types';
export type { IFunctionGroupResults } from './core/functionGroup/types';
export { functionGroupDocuments } from './core/functionGroup/types';
export type { IFunctionIncludeResults } from './core/functionInclude/types';
export { functionIncludeDocuments } from './core/functionInclude/types';
export type { IFunctionModuleResults } from './core/functionModule/types';
export { functionModuleDocuments } from './core/functionModule/types';
export type { IIncludeResults } from './core/include/types';
export { includeDocuments } from './core/include/types';
export type { IInterfaceResults } from './core/interface/types';
export { interfaceDocuments } from './core/interface/types';
export type {
  IMessageClassMessageResults,
  IMessageClassResults,
} from './core/messageClass/types';
export {
  messageClassDocuments,
  messageDocuments,
} from './core/messageClass/types';
export type { IMetadataExtensionResults } from './core/metadataExtension/types';
export { metadataExtensionDocuments } from './core/metadataExtension/types';
export type { IPackageResults } from './core/package/types';
export { packageDocuments } from './core/package/types';
export type { IProgramResults } from './core/program/types';
export { programDocuments } from './core/program/types';
export type { IScalarFunctionResults } from './core/scalarFunction/types';
export { scalarFunctionDocuments } from './core/scalarFunction/types';
export type { IScalarFunctionImplementationResults } from './core/scalarFunctionImplementation/types';
export { scalarFunctionImplementationDocuments } from './core/scalarFunctionImplementation/types';
export type { IServiceResults } from './core/service/types';
export { serviceDocuments } from './core/service/types';
export type { IServiceDefinitionResults } from './core/serviceDefinition/types';
export { serviceDefinitionDocuments } from './core/serviceDefinition/types';
export type { ObjectVersion } from './core/shared/results';
/** The shapes the shipped readings build. See `IUtilResults` for which member. */
export type { IUtilResults } from './core/shared/utilResultSet';
export { utilDocuments } from './core/shared/utilResultSet';
export type {
  IAdtObjectHit,
  IGetPackageContentsListOptions,
  IGetPackageHierarchyOptions,
  IInactiveObjectsResponse,
  INamedItem,
  IObjectReference,
  IPackageContentItem,
  IPackageHierarchyNode,
  IRepositoryNodeChild,
  IRepositoryNodeContents,
  IRepositoryObjectNode,
  ISearchResult,
  IWhereUsedListResult,
  IWhereUsedReference,
  PackageHierarchyCodeFormat,
  PackageHierarchySupportedType,
} from './core/shared/utilResults';
export {
  namedItems,
  nodeContents,
  searchHits,
} from './core/shared/utilResults';
export type { IStructureResults } from './core/structure/types';
export { structureDocuments } from './core/structure/types';
export type { ITableResults } from './core/table/types';
export { tableDocuments } from './core/table/types';
export type { ITableTypeResults } from './core/tabletype/types';
export { tableTypeDocuments } from './core/tabletype/types';
export type { ITransformationResults } from './core/transformation/types';
export { transformationDocuments } from './core/transformation/types';
export type {
  ICreatedTransport,
  ITransportTree,
  ITransportTreeLink,
  ITransportTreeNode,
  ITransportTreeRequest,
  ITransportTreeTask,
} from './core/transport';
export type { ITransportResults } from './core/transport/types';
export { transportDocuments } from './core/transport/types';
export type { IUnitTestResults } from './core/unitTest/types';
export { unitTestDocuments } from './core/unitTest/types';
/**
 * The error strategies, for a caller composing rather than replacing them.
 *
 * Each is already the shipped default of the member it belongs to; they are
 * exported so a consumer's own `analyse` can defer to one instead of
 * re-deriving what it knows.
 */
export { activationRefusal } from './utils/activationUtils';
export { deletionRefusal } from './utils/deletionCheck';
/** The readings this package ships, as building blocks for your own sets. */
export { nothing, rawDocument, wireItself } from './utils/resultStrategy';
