/**
 * What an ATC run answers.
 *
 * These shapes left `@mcp-abap-adt/interfaces` in 31.0.0 with the other result
 * shapes: `IAdtRunnable<TTarget, TResult, TOptions>`,
 * `IAtcRunStatusReadable<TStatus>` and `IAtcFindings<TFindings>` say a run
 * answers *something*, and what that something looks like is this
 * implementation's to name.
 *
 * They are measured, not designed — see the notes on each field for what a
 * system actually sent.
 */

/**
 * What a started run answers with — two shapes, because the server has two.
 *
 * A discriminated union rather than one interface with four optional fields:
 * which fields exist is decided by `options.wait`, known at the call site, and
 * optional fields would let a caller write `result.runId!` and be wrong exactly
 * when they waited.
 */
export type IAtcRunResult =
  | {
      /**
       * The server answered **without waiting**.
       *
       * Not "the checks are still running": a short run can finish before this
       * result reaches the caller. Ask `getRunStatus(runId)`.
       */
      waited: false;
      /** The worklist the findings will appear in. */
      worklistId: string;
      /**
       * The run's own id, distinct from the worklist id.
       *
       * Poll `getRunStatus(runId)` until it reports finished, then read
       * `getFindings(worklistId)`.
       */
      runId: string;
    }
  | {
      /** The server held the request until the checks were done. */
      waited: true;
      /** The worklist the findings are in. */
      worklistId: string;
      /**
       * `FINDING_STATS` as the server sent it — a comma-separated triple, for
       * example `"0,0,1"`.
       *
       * Not parsed into named counts. Which position is which severity has been
       * seen once, in a worklist with a single finding at priority 3, which fits
       * several orderings; inventing `{ errors, warnings, infos }` would publish
       * two guesses to save a caller one `split(',')`.
       */
      findingStats: string;
    };

/** What the run resource says about a run in progress or done. */
export interface IAtcRunStatus {
  /**
   * `runs:status` verbatim.
   *
   * A string and not a union: only `"finished"` has been observed, and
   * enumerating the states a server may report, from one state, is how a caller
   * ends up matching against names nothing ever sends.
   */
  status: string;

  /**
   * True when `status` is exactly `finished`, case-normalised.
   *
   * **Completion, not success.** It says the run reached an end, not that the
   * end was a good one: a run can finish having checked nothing, with the
   * reason recorded in the worklist, the run result or one of the logs rather
   * than here.
   *
   * **There is deliberately no `isTerminal` and no `isFailed`.** No failed or
   * cancelled run has been observed, so any state named for one would be
   * invented — and a caller branching on a name the server never sends is worse
   * off than one branching on nothing.
   */
  isFinished: boolean;

  /** The worklist this run writes into, where the answer carries it. */
  worklistId?: string;

  /** From the `displayid` link — a third id, and the one `IAtcLog` reads by. */
  resultId?: string;
}
