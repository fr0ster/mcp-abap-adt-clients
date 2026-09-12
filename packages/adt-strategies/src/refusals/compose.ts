/**
 * Putting the shapes together, and the one decision this package makes.
 *
 * `@mcp-abap-adt/adt-clients` ships no error strategy, and that is correct: it
 * cannot know which answers matter to you. This package is the other half —
 * defaults for the common case, so that a consumer who has no opinion yet is
 * not forced to invent one before making a single call.
 *
 * Having an opinion here is the point. Disagreeing with it is expected, and
 * `firstOf` is how you assemble your own.
 */

import type {
  IAdtError,
  IAdtWireResponse,
  IAnalyse,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import {
  activationRefusal,
  checkRunRefusal,
  deletionCheckRefusal,
  deletionRefusal,
  exceptionRefusal,
  validationRefusal,
} from './shapes';

/** What every shape above is: a look at one answer, and a maybe. */
export type RefusalShape = (answer?: IAdtWireResponse) => IAdtError | undefined;

/**
 * The first shape that recognises the answer wins; if none does, the verdict
 * the library reached stands.
 *
 * Order matters and is yours to choose. Recognition is by document shape, and
 * the shapes do not overlap for any answer in the corpus — but your system is
 * not the corpus.
 */
export const firstOf =
  (...shapes: RefusalShape[]): IAnalyse<IAdtError> =>
  (verdict, answer) => {
    for (const shape of shapes) {
      const found = shape(answer);
      if (found) return found;
    }
    return verdict;
  };

/**
 * The default: every shape recorded in the corpus, exception last.
 *
 * A transport failure keeps the library's verdict unless one of the document
 * shapes recognises the body, because that verdict already names the status
 * and carries the request.
 */
export const adtRefusal: IAnalyse<IAdtError> = firstOf(
  activationRefusal,
  checkRunRefusal,
  deletionRefusal,
  deletionCheckRefusal,
  validationRefusal,
  exceptionRefusal,
);

/**
 * Nothing is a refusal — the same default `adt-clients` ships, re-exported so
 * a caller can turn judgement off for one call without importing two packages.
 */
export const nothingIsARefusal: IAnalyse<IAdtError> = () => ADT_NO_FAILURE;
