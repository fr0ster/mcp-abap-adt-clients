/**
 * An activation judged with its inactive list — the caller's two calls
 * (adt-clients 49.0.0, C7). A test helper, not part of the package: it is the
 * recipe a consumer writes, kept here so this repository's tests prove it
 * gives what the member gave in 48.0.0, when it read the list itself.
 *
 * 1. The member's `activate`, whose `analyse` keeps the original starting
 *    verdict (the library's own, before any strategy) and the answer.
 * 2. When `readUnstatedActivation` (adt-strategies) answers `silent` or
 *    `unstated`, `getUtils().getInactiveObjects()`, its answer kept whole.
 *    A credential refusal SAP never saw is thrown by either call, and is not
 *    caught here.
 * 3. `analyseActivation(verdict, activationAnswer, context)`. After a read
 *    that failed:
 *    - after `silent`, the starting verdict is replaced, before the strategy
 *      runs, by the read's failure in 48.0.0's words; no context;
 *    - after `unstated`, the starting verdict stays, the refusal's response
 *      is the list, and no response means no context.
 *
 * `named` is what the activation request named — for every member,
 * `buildObjectUri` of its code, name and parent, and for a function group also
 * the group's `source/main` (`activationNamesItsUris.test.ts`).
 */
import {
  analyseActivation,
  type IAdtActivationFailure,
  readUnstatedActivation,
} from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type AdtNoFailure,
  type IAdtAnalyseContext,
  type IAdtError,
  type IAdtResponse,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * What the recipe answers: the verdict, and whether it read the list. The
 * verdict is `analyseActivation`'s (an `IAdtActivationFailure`), or — when the
 * member answered without calling its `analyse` — the member's own failure.
 */
export interface IActivationJudged {
  readonly verdict: IAdtActivationFailure | IAdtError | AdtNoFailure;
  /** The activation's answer, which a cleared verdict is read from. */
  readonly answer: IAdtWireResponse | undefined;
  readonly listRead: boolean;
}

/** The inactive list's read: `getInactiveObjects` over a `wireItself` result set. */
export type InactiveListRead = () => Promise<
  IAdtResponse<IAdtWireResponse, IAdtError>
>;

export async function activationJudged(
  activate: (analyse: IAnalyse) => Promise<IAdtResponse<unknown, IAdtError>>,
  readInactiveList: InactiveListRead,
  named: readonly string[],
): Promise<IActivationJudged> {
  let started: IAdtError | AdtNoFailure | undefined;
  let answer: IAdtWireResponse | undefined;
  const answered = await activate((verdict, wire) => {
    started = verdict;
    answer = wire;
    return verdict;
  });
  // A member that answered without its `analyse` (a stub; a judge composed
  // around the recording one that stopped first) is judged by its own answer.
  if (started === undefined) {
    return {
      verdict: answered.ok ? ADT_NO_FAILURE : answered.getError(),
      answer: undefined,
      listRead: false,
    };
  }

  const kind =
    answer === undefined ? undefined : readUnstatedActivation(answer);
  if (kind === undefined) {
    return {
      verdict: analyseActivation(started, answer),
      answer,
      listRead: false,
    };
  }

  const listed = await readInactiveList();
  let verdict: IAdtError | AdtNoFailure = started;
  let context: IAdtAnalyseContext | undefined;
  if (listed.ok) {
    context = {
      activation: { named, inactiveObjects: listed.getResult().value },
    };
  } else {
    const cause = listed.getError();
    if (kind === 'silent') {
      verdict = {
        ...cause,
        message: `The activation's outcome could not be decided: SAP answered that no activation ran and gave no message, and reading the inactive objects failed: ${cause.message}`,
      };
    } else if (cause.response !== undefined) {
      context = { activation: { named, inactiveObjects: cause.response } };
    }
  }
  return {
    verdict: analyseActivation(verdict, answer, context),
    answer,
    listRead: true,
  };
}
