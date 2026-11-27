/**
 * The 20 getters a legacy client answers with an absent handler (C5 of
 * #304), and the modern classes' private helpers: an absent handler keeps
 * them modern (a subclass cannot redeclare them, TS2415), reached only from
 * the operations it overrides, so a test calls only the public operations.
 */
export const ABSENT_GETTERS = [
  'getDomain',
  'getDataElement',
  'getStructure',
  'getTable',
  'getTableSettings',
  'getTextElements',
  'getTableType',
  'getAccessControl',
  'getServiceDefinition',
  'getServiceBinding',
  'getBehaviorDefinition',
  'getBehaviorImplementation',
  'getMetadataExtension',
  'getEnhancement',
  'getAuthorizationField',
  'getFeatureToggle',
  'getTransformation',
  'getScalarFunction',
  'getScalarFunctionImplementation',
  'getAppendStructure',
] as const;

export const PRIVATE_HELPERS = new Set([
  'name',
  'enhancementType',
  'createParams',
  'deleteParams',
  'switchTo',
  'buildServiceBindingCreateXml',
  'buildTransportCheckXml',
  'buildDeletionXml',
  'publishByServiceType',
  'unpublishByServiceType',
  'bindingTypesRequest',
  'deletionCheckRequest',
  'transportCheckRequest',
  'createRequest',
  'readRequest',
  'updateRequest',
  'deleteRequest',
  'checkRequest',
  'activateRequest',
  'serviceGroupRequest',
]);
