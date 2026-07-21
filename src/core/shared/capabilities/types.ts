import type {
  IAbapConnection,
  ILogger,
  IObjectVersion,
} from '@mcp-abap-adt/interfaces';

/** The connection + logger every capability implementation needs. */
export interface ICapabilityContext {
  readonly connection: IAbapConnection;
  readonly logger?: ILogger;
}

/**
 * Normalized lock result. The per-type helpers return different shapes
 * (bare string vs { lockHandle, corrNr }); the capability normalizes up to
 * this superset. See the spec's "lock normalization contract".
 */
export interface INormalizedLock {
  lockHandle: string;
  corrNr?: string;
}

/**
 * Per-handler strategy for LockCapability. The handler supplies its own
 * endpoint knowledge — there is no centralized lifecycle-URI resolver
 * (buildObjectUri is for group operations only).
 *
 * `release` returns the handler's OWN state shape (e.g. `{ unlockResult,
 * errors: [] }`), not void — the current handlers put the ADT unlock response
 * into `state.unlockResult`, and dropping it would change observable behaviour.
 * The capability owns only the session toggling around it.
 */
export interface ILockStrategy<TConfig, TReadResult> {
  /** Extract the object name from config, or throw if missing. */
  nameOf(config: Partial<TConfig>): string;
  /** POST _action=LOCK, return the normalized handle. */
  acquire(ctx: ICapabilityContext, name: string): Promise<INormalizedLock>;
  /** POST _action=UNLOCK with the handle; build and return the handler state. */
  release(
    ctx: ICapabilityContext,
    name: string,
    lockHandle: string,
  ): Promise<TReadResult>;
}

/** Per-handler strategy for VersionsCapability. */
export interface IVersionsStrategy<TConfig> {
  nameOf(config: Partial<TConfig>): string;
  list(ctx: ICapabilityContext, name: string): Promise<IObjectVersion[]>;
  /** GET the content URI, return the source text. */
  source(ctx: ICapabilityContext, contentUri: string): Promise<string>;
}
