/**
 * ADT Clients — readings
 *
 * A member's result type is a type parameter of its contract, and what the
 * answer *becomes* is a strategy this package implements and a consumer may
 * replace. The implementations are here: the strategy implementations, the
 * shipped default result set for each object type, and the shapes those
 * defaults build.
 *
 * Without this barrel the injection point is unreachable from outside the
 * package — the contracts would name a seam nobody could reach, which is the
 * opposite of what they are for.
 *
 * The result-set contracts (`IClassResults` and its siblings) and
 * `IResultStrategy` are **not** here. A factory accepts them, so they are
 * contracts, and come from `@mcp-abap-adt/interfaces-adt` like every other
 * type this package does not own.
 */

export { accessControlDocuments } from './core/accessControl/types';
export { appendStructureDocuments } from './core/appendStructure/types';
export { authorizationFieldDocuments } from './core/authorizationField/types';
export { behaviorDefinitionDocuments } from './core/behaviorDefinition/types';
/**
 * The class shell a behavior implementation needs at its own `source/main`.
 *
 * A behavior implementation is a class: the shell goes in with
 * `getClass().update({ className }, { sourceCode: mainSourceFor(name, bdef) })`,
 * which is the caller's call to make.
 */
export { mainSourceFor } from './core/behaviorImplementation/AdtBehaviorImplementation';
export { classDocuments } from './core/class/types';
export { dataElementDocuments } from './core/dataElement/types';
export { ddlDocuments } from './core/ddl/types';
export { domainDocuments } from './core/domain/types';
export { enhancementDocuments } from './core/enhancement/types';
export { featureToggleDocuments } from './core/featureToggle/types';
export { functionGroupDocuments } from './core/functionGroup/types';
export { functionIncludeDocuments } from './core/functionInclude/types';
export { functionModuleDocuments } from './core/functionModule/types';
export { includeDocuments } from './core/include/types';
export { interfaceDocuments } from './core/interface/types';
export {
  messageClassDocuments,
  messageDocuments,
} from './core/messageClass/types';
export { metadataExtensionDocuments } from './core/metadataExtension/types';
export { packageDocuments } from './core/package/types';
export { programDocuments } from './core/program/types';
export { scalarFunctionDocuments } from './core/scalarFunction/types';
export { scalarFunctionImplementationDocuments } from './core/scalarFunctionImplementation/types';
export { serviceDocuments } from './core/service/types';
export { serviceDefinitionDocuments } from './core/serviceDefinition/types';
/**
 * What a deletion check answers, named once for every result set that carries a
 * `deletionCheck` strategy. It is a different document from `check`'s.
 */
export type { DeletionCheckResult } from './core/shared/results';
/** The util result set: documents as they arrived; the readings are in @mcp-abap-adt/adt-strategies. */
export { utilDocuments } from './core/shared/utilResultSet';
export type { INamedItem } from './core/shared/utilResults';
export { structureDocuments } from './core/structure/types';
export { tableDocuments } from './core/table/types';
export { tableTypeDocuments } from './core/tabletype/types';
export { transformationDocuments } from './core/transformation/types';
export { transportDocuments } from './core/transport/types';
/**
 * No error strategy ships from here.
 *
 * This package relays what ADT answered; reading a body into a verdict depends
 * on the system and the task, and is decided from a corpus of real responses
 * rather than from this source. A caller passes their own `analyse`, and
 * `nothingIsARefusal` with `wireItself` is how that corpus is collected.
 */
/*
 * `IAnalyse<E>` and `IAdtOperationOptions<E>` are **not** re-exported here.
 * They lived in this package while the shape was being proven against real
 * traffic, and they moved into `@mcp-abap-adt/interfaces` 32.0.0, which is
 * where a consumer imports them from — one import point, so any of it can be
 * replaced:
 *
 * ```typescript
 * import type { IAdtError, IAnalyse } from '@mcp-abap-adt/interfaces-adt';
 *
 * interface IT100Failure extends IAdtError {
 *   readonly t100: { msgid: string; msgno: string };
 * }
 * const t100: IAnalyse<IT100Failure> = (verdict, answer) => …;
 *
 * const answer = await client.getClass().activate(config, { analyse: t100 });
 * if (!answer.ok) answer.getError().t100;   // typed, no cast
 * ```
 */
/**
 * The one failure strategy here, and it finds none.
 *
 * Paired with `wireItself` it hands back every exchange that produced an
 * answer, refusals included, so the caller reads the body rather than being
 * told what it meant.
 */
export { nothingIsARefusal } from './utils/adtResponse';
/** The readings this package ships, as building blocks for your own sets. */
export { nothing, rawDocument, wireItself } from './utils/resultStrategy';
