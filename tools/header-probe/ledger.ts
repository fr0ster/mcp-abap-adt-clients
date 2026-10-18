/**
 * Every temporary object the probe may have created, and the one cleanup that
 * removes them.
 *
 * An entry is added before the create is sent, not after it succeeds: a create
 * refused with 406 may still have created the object, so the removal itself
 * finds out whether there is anything to remove.
 */

import type { IRemoval } from './record';

export interface ILedgerEntry {
  label: string;
  /** Removes the object, or says it was never there. Throwing counts as not removed. */
  remove: () => Promise<{ removed: boolean; detail: string }>;
}

export class Ledger {
  private readonly entries: ILedgerEntry[] = [];
  private running?: Promise<IRemoval[]>;

  constructor(
    private readonly onRemoval: (removal: IRemoval) => void = () => {},
  ) {}

  add(entry: ILedgerEntry): void {
    this.entries.push(entry);
  }

  get size(): number {
    return this.entries.length;
  }

  /**
   * Removes every entry, newest first (a function module before its group), and
   * reports each. Runs once: a second call — Ctrl-C during the `finally` —
   * waits for the first.
   */
  cleanup(): Promise<IRemoval[]> {
    this.running ??= (async () => {
      const removals: IRemoval[] = [];
      for (const entry of [...this.entries].reverse()) {
        let removal: IRemoval;
        try {
          const outcome = await entry.remove();
          removal = { label: entry.label, ...outcome };
        } catch (error) {
          removal = {
            label: entry.label,
            removed: false,
            detail: `the removal threw: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
        removals.push(removal);
        this.onRemoval(removal);
      }
      return removals;
    })();
    return this.running;
  }
}

/** Runs `body`; the ledger is cleaned up whatever happens, failure included. */
export async function withCleanup<T>(
  ledger: Ledger,
  body: () => Promise<T>,
): Promise<T> {
  try {
    return await body();
  } finally {
    await ledger.cleanup();
  }
}
