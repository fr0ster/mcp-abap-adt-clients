/**
 * Default strategies for `@mcp-abap-adt/adt-clients`.
 *
 * That package returns the contract and reads nothing into it: whether an
 * answer is a failure is a decision it refuses to take on your behalf, because
 * it depends on which types you touch and what you were doing.
 *
 * This package takes that decision, for the common case, from evidence. Every
 * shape here is derived from a recorded answer in `corpus/adt/` at the root of
 * this repository, and every one is tested against those files — so a default
 * is a reading of something the server actually sent, not a guess that compiles.
 *
 * ```typescript
 * import { adtRefusal } from '@mcp-abap-adt/adt-strategies';
 *
 * await client.getClass().activate({ className: 'ZCL_X' }, { analyse: adtRefusal });
 * ```
 *
 * Swap any part of it with `firstOf`.
 */

export {
  adtRefusal,
  firstOf,
  nothingIsARefusal,
  type RefusalShape,
} from './refusals/compose';
export {
  activationRefusal,
  bodyOf,
  checkRunRefusal,
  deletionCheckRefusal,
  deletionRefusal,
  exceptionRefusal,
  validationRefusal,
} from './refusals/shapes';
