/**
 * Default strategies for `@mcp-abap-adt/adt-clients`.
 *
 * That package returns the contract and reads nothing into it: whether an
 * answer is a failure is a decision it refuses to take on your behalf, because
 * it depends on which object types you touch and what you were doing. This
 * package takes that decision, for the common case, from evidence.
 *
 * **Almost everything here is on the error axis, and that is deliberate.**
 * Shaping a *result* is the consumer's — which fields, to what end — and there
 * is no defensible default. The single exception is `asItCame`, the absence of
 * shaping.
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
  analyseCheck,
  analyseDeletion,
  analyseException,
  analyseUnitTest,
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
  readCheckRunRefusal,
  readDeletionRefusal,
  readExceptionRefusal,
  readUnitTestRefusal,
  readValidationRefusal,
} from './refusals/read';

// The result axis, which has exactly one member.
export { asItCame, rawOf } from './result';
