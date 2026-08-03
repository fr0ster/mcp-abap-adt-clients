/**
 * ADT Clients — core barrel
 * Covers: AdtClient, AdtClientLegacy, createAdtClient, all core/** object types,
 * core/shared utilities, and the @mcp-abap-adt/interfaces re-export block (back-compat).
 * Ambiguous utils (discoveryEndpoints, systemInfo) are placed here per the "ambiguous → core" rule.
 */

// Export supporting types needed by client APIs

export type {
  IAdtClientOptions,
  IAdtSystemContext,
} from './clients/AdtClient';
export { AdtClient } from './clients/AdtClient';
export { AdtClientLegacy } from './clients/AdtClientLegacy';
export { createAdtClient } from './clients/createAdtClient';
export type { AdtAccessControlType } from './core/accessControl';
export type { AdtAppendStructureType } from './core/appendStructure';
export { AdtAppendStructure } from './core/appendStructure';

export type { AdtBehaviorDefinitionType } from './core/behaviorDefinition';
export type { AdtBehaviorImplementationType } from './core/behaviorImplementation';
export type { AdtClassType } from './core/class';
export type { AdtDataElementType } from './core/dataElement';
export type { AdtDdlType } from './core/ddl';
export type { AdtDomainType } from './core/domain';
export type { AdtEnhancement as AdtEnhancementType } from './core/enhancement';
// Ours, and documented as reachable — it was neither exported nor caught,
// because a value mentioned in prose is not an import the doc test can check.
export { ENHANCEMENT_TYPE_CODES } from './core/enhancement';

export type { AdtFunctionGroupType } from './core/functionGroup';

export type { AdtFunctionModuleType } from './core/functionModule';
export type { AdtInterfaceType } from './core/interface';
export type {
  AdtMessageClassMessageType,
  AdtMessageClassType,
} from './core/messageClass';
export {
  AdtMessageClass,
  AdtMessageClassMessage,
} from './core/messageClass';
export type { AdtMetadataExtensionType } from './core/metadataExtension';
export type { AdtPackageType } from './core/package';
export type { AdtProgramType } from './core/program';
export type { AdtScalarFunctionType } from './core/scalarFunction';
export { AdtScalarFunction } from './core/scalarFunction';
export type { AdtScalarFunctionImplementationType } from './core/scalarFunctionImplementation';
export { AdtScalarFunctionImplementation } from './core/scalarFunctionImplementation';

export {
  AdtService,
  AdtServiceBinding,
  resolveBindingVariant,
} from './core/service';
export type { AdtServiceDefinitionType } from './core/serviceDefinition';

export { parseSearchResults } from './core/shared';
export type {
  IAdtContentTypes,
  IAdtHeaders,
} from './core/shared/contentTypes';
export {
  AdtContentTypesBase,
  AdtContentTypesModern,
} from './core/shared/contentTypes';
export type { AdtStructureType } from './core/structure';
export type { AdtTableType } from './core/table';
export type { AdtDdicTableTypeAlias } from './core/tabletype';
export type { AdtTransformationType } from './core/transformation';
export type { AdtRequestType } from './core/transport';
export type { AdtUnitTestType } from './core/unitTest';
export {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from './utils/discoveryEndpoints';
export {
  getSystemInformation,
  isModernAdtSystem,
  resolveContentTypes,
} from './utils/systemInfo';
