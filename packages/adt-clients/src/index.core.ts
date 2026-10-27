/**
 * ADT Clients — core barrel
 * Covers: AdtClient, createAdtClient, all core/** object types,
 * core/shared utilities, and the @mcp-abap-adt/interfaces re-export block (back-compat).
 * Ambiguous utils (discoveryEndpoints, systemInfo) are placed here per the "ambiguous → core" rule.
 */

// Contract types for client APIs (IAdtClientOptions, IAdtSystemContext) come
// from @mcp-abap-adt/interfaces — that is the one place to import them.

/**
 * What a subclass in another package extends or calls: the handler classes,
 * the address records and the wire helpers a subclass's overrides send
 * through. The set is the
 * compiler's — what such a subclass cannot build without — and nothing more.
 */
export { AdtClient } from './clients/AdtClient';
export { AdtClientCloud, AdtClientOnPrem } from './clients/AdtClientVariants';
export {
  createAdtClient,
  type ICreateAdtClientOptions,
} from './clients/createAdtClient';
export type {
  AdtCodeOf,
  AdtCodeWith,
  AdtModernVariant,
  AdtPerformedBy,
  AdtPerformingVariantsIn,
  AdtServedBy,
  AdtServingVariantsIn,
  IAdtServedOn,
} from './clients/variant';
export { AdtAccessControl } from './core/accessControl';
export { AdtAppendStructure } from './core/appendStructure';
export { AdtAuthorizationField } from './core/authorizationField';
export { AdtBehaviorDefinition } from './core/behaviorDefinition';
export { AdtBehaviorImplementation } from './core/behaviorImplementation';
export {
  AdtClass,
  AdtLocalDefinitions,
  AdtLocalMacros,
  AdtLocalTestClass,
  AdtLocalTypes,
} from './core/class';
export { startClassUnitTestRunSync } from './core/class/run';
export { AdtDataElement } from './core/dataElement';
export { AdtDdl } from './core/ddl';
export { AdtDomain } from './core/domain';
export { AdtEnhancement, type EnhancementTypeWith } from './core/enhancement';
export { AdtFeatureToggle } from './core/featureToggle';
export { AdtFunctionGroup } from './core/functionGroup';
export { AdtFunctionInclude } from './core/functionInclude';
export { AdtFunctionModule } from './core/functionModule';
export { AdtInterface } from './core/interface';
export {
  AdtMessageClass,
  AdtMessageClassMessage,
} from './core/messageClass';
export { AdtMetadataExtension } from './core/metadataExtension';
export { AdtPackage } from './core/package';
export { AdtProgram } from './core/program';
export { AdtScalarFunction } from './core/scalarFunction';
export { AdtScalarFunctionImplementation } from './core/scalarFunctionImplementation';
export {
  AdtServiceBinding,
  resolveBindingVariant,
} from './core/service';
export { AdtServiceDefinition } from './core/serviceDefinition';
export { AdtUtils } from './core/shared/AdtUtils';
export { startUnitTestRunSync } from './core/shared/abapUnit';
export type {
  AdtActivationCode,
  AdtDeletionCheckCode,
  AdtDeletionCode,
  AdtMetadataReadCode,
  AdtMetadataReadCodeOf,
  AdtSearchCode,
  AdtSourceReadCode,
  AdtSourceReadCodeOf,
  AdtStructureCode,
  AdtWhereUsedCode,
  IAdtGroupReference,
  ParentedArguments,
} from './core/shared/codeSets';
export {
  AdtContentTypesBase,
  AdtContentTypesModern,
} from './core/shared/contentTypes';
export { AdtStructure } from './core/structure';
export { AdtTable } from './core/table';
export { AdtDdicTableType } from './core/tabletype';
export { AdtTransformation } from './core/transformation';
export { AdtRequest } from './core/transport';
export { changeTransportTaskType } from './core/transport/objects';
export type {
  AdtAddressableCode,
  AdtGroupOnlyCode,
} from './endpoints/codes';
export {
  ACCESS_CONTROL,
  AUTHORIZATION_FIELD,
  BEHAVIOR_DEFINITION,
  CLASS,
  DATA_ELEMENT,
  DDL_SOURCE,
  DOMAIN,
  ENHANCEMENT,
  FEATURE_TOGGLE,
  FUNCTION_GROUP,
  FUNCTION_MODULE,
  INTERFACE,
  MESSAGE_CLASS,
  METADATA_EXTENSION,
  PACKAGE,
  PROGRAM,
  PROGRAM_INCLUDE,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
  TRANSFORMATION,
  TRANSPORT_REQUEST,
  versionsUri,
} from './endpoints/objects';
export { buildObjectUri } from './utils/activationUtils';
/**
 * The refusal a 2xx can carry.
 *
 * Every client throws this now, so a consumer must be able to name it —
 * `instanceof` is how they tell "SAP said no, and here is what it said" apart
 * from any other failure, and `.document` is where the untouched answer lives.
 * It shipped unreachable in the first draft: the class had `export`, the
 * changelog named it, the tests asserted on it, and nothing outside this package
 * could see it.
 *
 * Only the classes. `sapErrorIn` and `throwIfSapError` install the check
 * and are the library's own business — a consumer catches a refusal, they do not
 * detect one, and a member is exported because somebody needs it.
 */
export {
  AdtParseError,
  AdtSAPError,
} from './utils/adtErrors';
export { answering, failed } from './utils/adtResponse';
export { withCallTimeout } from './utils/callTimeout';
export {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from './utils/discoveryEndpoints';
export { writeQuery } from './utils/internalUtils';
export { requestHeaders } from './utils/requestHeaders';
export {
  getSystemInformation,
  isModernAdtSystem,
  resolveContentTypes,
} from './utils/systemInfo';
