/**
 * Default strategies for `@mcp-abap-adt/adt-clients`.
 *
 * That package returns the contract and reads nothing into it: whether an
 * answer is a failure is a decision it refuses to take on your behalf, because
 * it depends on which object types you touch and what you were doing. This
 * package takes that decision, for the common case, from evidence.
 *
 * **Two axes.** The error axis — what counts as a failure — is most of it. The
 * result axis holds the readings `@mcp-abap-adt/adt-clients` used to apply on
 * its own before it answered documents as they arrived: they moved here so a
 * caller who wants a shape asks for it, and one who wants the document gets it.
 * `asItCame` is the absence of shaping.
 *
 * ```typescript
 * import { analyseActivation, asItCame } from '@mcp-abap-adt/adt-strategies';
 *
 * const utils = client.getUtils({ ...utilDocuments, metadata: asItCame });
 * await client.getClass().activate({ className: 'ZCL_X' }, { analyse: analyseActivation });
 * ```
 *
 * Every reading is tested against the recorded answers in `corpus/adt/` (`answers/`, `debugger/`) at the
 * root of this repository — against the refusal it came from, and against the
 * success it has to be told apart from.
 */

// The error axis: a strategy per form, and one that dispatches.
export {
  analyseActivation,
  analyseAny,
  analyseCdsTestDoubles,
  analyseCheck,
  analyseDebuggeeEnd,
  analyseDebuggerFreed,
  analyseDeletion,
  analyseException,
  analyseMessageClassMessage,
  analyseObjectProperties,
  analysePublication,
  analysePublicationLock,
  analyseUnitTest,
  analyseUnitTestStart,
  analyseUnsupportedStatus,
  analyseValidation,
  type IAdtActivationFailure,
  type IAdtMessageFailure,
} from './refusals/analyse';

// The readings underneath them — pure functions over a document, for a caller
// composing their own strategy rather than taking one.
export {
  type AdtActivationFacts,
  type AdtActivationRefusal,
  type AdtMessage,
  type AdtRefusal,
  type AdtUnstatedActivation,
  type IAdtStillInactive,
  isIndeterminateWalkAnswer,
  readActivationRefusal,
  readAdtRefusal,
  readCdsTestDoublesRefusal,
  readCheckRunRefusal,
  readDeletionRefusal,
  readExceptionRefusal,
  readExceptionSubType,
  readMessageClassMessageAbsence,
  readObjectPropertiesAbsence,
  readPublicationRefusal,
  readUnitTestRefusal,
  readUnstatedActivation,
  readValidationRefusal,
  stillInactiveAmong,
} from './refusals/read';
export { asItCame, rawOf } from './result';
// The result axis: the document as it came, and the readings a caller may ask for.
export {
  abapGitBranchInfo,
  abapGitErrorLog,
  abapGitExternalRepo,
  abapGitModifiedObjects,
  abapGitObjectResults,
  abapGitRepoRunStates,
  abapGitRepos,
  abapGitStaging,
  type IAbapGitBranchInfoReading,
  type IAbapGitBranchReading,
  type IAbapGitErrorLogEntry,
  type IAbapGitExternalRepoBranch,
  type IAbapGitExternalRepoInfo,
  type IAbapGitLink,
  type IAbapGitModifiedObjectReading,
  type IAbapGitModifiedObjectsReading,
  type IAbapGitObjectResult,
  type IAbapGitPerson,
  type IAbapGitRepo,
  type IAbapGitRepoRunState,
  type IAbapGitStagingFileReading,
  type IAbapGitStagingObjectReading,
  type IAbapGitStagingReading,
} from './results/abapGit';
// The facts reducer of abapGit's new forms: structure and facts only.
export {
  abapGitErrorFacts,
  abapGitFacts,
  type IAbapGitBranchFacts,
  type IAbapGitBranchInfoBranchFacts,
  type IAbapGitBranchInfoFacts,
  type IAbapGitExternalRepoFacts,
  type IAbapGitFactsReducers,
  type IAbapGitFileFacts,
  type IAbapGitModifiedObjectsFacts,
  type IAbapGitNoFacts,
  type IAbapGitObjectFacts,
  type IAbapGitObjectsFacts,
  type IAbapGitRepoFacts,
  type IAbapGitReposFacts,
  type IAbapGitStagingFacts,
  type IAbapGitStatusFacts,
} from './results/abapGitFacts';
// A code read from an answer, looked up once against the ADT type tables.
export { answeredObject } from './results/answeredObject';
export {
  atcRunStatus,
  atcStartedRun,
  atcSystemCheckVariant,
  atcWaitingRun,
  atcWorklistId,
  type IAtcRunStatus,
  type IAtcStartedRun,
  type IAtcWaitingRun,
} from './results/atc';
export {
  type IElementInfoLink,
  type IElementInfoObject,
  type IElementInfoPackage,
  type IExposedEntity,
  type IServiceDefinitionElementInfo,
  type IStructureComponent,
  type IStructureElementInfo,
  readServiceDefinitionElementInfo,
  readStructureElementInfo,
  serviceDefinitionElementInfo,
  structureElementInfo,
} from './results/elementInfo';
export {
  type FeatureToggleState,
  featureToggleCheckState,
  featureToggleRuntimeState,
  type IFeatureToggleCheckState,
  type IFeatureToggleClientLevel,
  type IFeatureToggleRuntimeState,
  type IFeatureToggleUserLevel,
} from './results/featureToggle';
export {
  feedDescriptors,
  feedEntries,
  feedGatewayErrorDetail,
  feedGatewayErrors,
  feedSystemMessages,
  feedVariants,
  type ICallStackEntry,
  type IFeedDescriptor,
  type IFeedEntry,
  type IFeedVariant,
  type IGatewayContextNode,
  type IGatewayErrorDetail,
  type IGatewayErrorEntry,
  type IGatewayException,
  type ISourceCodeLine,
  type ISystemMessageEntry,
} from './results/feeds';
export {
  type IObjectOutline,
  type IOutlineElement,
  type IOutlineLink,
  type IOutlinePoint,
  objectOutline,
  readObjectOutline,
} from './results/outline';
export {
  cloudTableSettings,
  type ICloudTableSettingsAnswer,
  type ITableSettingsAnswer,
  type ITableSettingsDocument,
  readTableSettings,
  tableSettings,
} from './results/tableSettings';
export {
  type ISelectionTextRead,
  type ISelectionTextsDocument,
  type ITextHeadingsDocument,
  type ITextHeadingsRead,
  type ITextSymbolRead,
  type ITextSymbolsDocument,
  readSelectionTexts,
  readTextHeadings,
  readTextSymbols,
  selectionTexts,
  textHeadings,
  textSymbols,
} from './results/textElements';
export {
  compareRecordedAt,
  type IAbapTraceAccessTime,
  type IAbapTraceDbAccess,
  type IAbapTraceDbAccesses,
  type IAbapTraceEntry,
  type IAbapTraceHitList,
  type IAbapTraceHitListEntry,
  type IAbapTraceStatement,
  type IAbapTraceStatements,
  type ITraceCatalogueItem,
  type ITraceExecutions,
  type ITraceProgramRef,
  type ITraceRequestEntry,
  type ITraceTiming,
  profilerDbAccesses,
  profilerHitList,
  profilerStatements,
  profilerTraceEntries,
  traceSchedulingProfilerId,
  traceSchedulingRequests,
  traceSchedulingTypes,
} from './results/traces';
export {
  type ICreatedTransport,
  type ITransportIncompleteEntry,
  type ITransportItem,
  type ITransportItemHeader,
  type ITransportObjectEntry,
  type ITransportObjectEntryList,
  type ITransportRequestItem,
  type ITransportTaskItem,
  type ITransportTaskSummary,
  type ITransportTree,
  type ITransportTreeLink,
  type ITransportTreeNode,
  type ITransportTreeRequest,
  type ITransportTreeTask,
  readTransportItem,
  transportCreated,
  transportItem,
  transportObjectEntries,
  transportObjectEntryList,
  transportSearchConfigurations,
  transportTree,
} from './results/transport';
export { unitTestRunId } from './results/unitTest';
export {
  ACTIVATION_RUNS_COLLECTION,
  extractRunId,
  type IAdtObjectHit,
  type IInactiveObject,
  type IInactiveObjectsResponse,
  type INamedItem,
  type IParsedNodeStructure,
  type IRepositoryIncompleteNode,
  type IRepositoryNodeChild,
  type IRepositoryNodeContents,
  type IRepositoryNotLoadedNode,
  type IRepositoryObjectNode,
  type ISearchResult,
  type IWhereUsedListResult,
  type IWhereUsedReference,
  readNamedItems,
  readNodeStructure,
  readSearchHits,
  utilActivationRunId,
  utilDiscoveryCollections,
  utilInactiveObjects,
  utilNamedItems,
  utilNodeContents,
  utilSearchHits,
  utilWhereUsedReferences,
  type WhereUsedReferenceKind,
} from './results/utils';
export { type IObjectVersion, objectVersions } from './results/versions';
// Where a message stands in its source (`AdtMessage.position`).
export type { AdtSourcePoint, AdtSourcePosition } from './sourcePosition';
