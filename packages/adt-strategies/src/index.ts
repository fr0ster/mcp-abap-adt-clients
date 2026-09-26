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
 * Every reading is tested against the recorded answers in `corpus/adt/` at the
 * root of this repository — against the refusal it came from, and against the
 * success it has to be told apart from.
 */

// The error axis: a strategy per form, and one that dispatches.
export {
  analyseActivation,
  analyseAny,
  analyseCdsTestDoubles,
  analyseCheck,
  analyseDeletion,
  analyseException,
  analyseMessageClassMessage,
  analysePublication,
  analyseUnitTest,
  analyseUnitTestStart,
  analyseUnsupportedStatus,
  analyseValidation,
  type IAdtMessageFailure,
} from './refusals/analyse';

// The readings underneath them — pure functions over a document, for a caller
// composing their own strategy rather than taking one.
export {
  type AdtMessage,
  type AdtRefusal,
  isIndeterminateWalkAnswer,
  readActivationRefusal,
  readAdtRefusal,
  readCdsTestDoublesRefusal,
  readCheckRunRefusal,
  readDeletionRefusal,
  readExceptionRefusal,
  readMessageClassMessageAbsence,
  readPublicationRefusal,
  readUnitTestRefusal,
  readValidationRefusal,
} from './refusals/read';
export { asItCame, rawOf } from './result';
// The result axis: the document as it came, and the readings a caller may ask for.
export {
  abapGitErrorLog,
  abapGitExternalRepo,
  abapGitRepos,
  type IAbapGitErrorLogEntry,
  type IAbapGitExternalRepoBranch,
  type IAbapGitExternalRepoInfo,
  type IAbapGitRepo,
} from './results/abapGit';
export { unitTestRunId } from './results/unitTest';
