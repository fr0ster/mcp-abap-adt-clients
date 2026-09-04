import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { ObjectVersion } from '../results';

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
 * `release` is typed by the handler (`TReadResult`), and since 31.0.0 most
 * handlers make it `void`: `unlock` answers `IAdtResponse<void>`, so what ADT
 * said on the way out is no longer a shape anyone reads. The parameter stays
 * for a handler that genuinely wants the release's answer. The capability owns
 * only the session toggling around it.
 */
export interface ILockStrategy<TConfig, TReadResult> {
  /** Extract the object name from config, or throw if missing. */
  nameOf(config: Partial<TConfig>): string;
  /** POST _action=LOCK, return the normalized handle. */
  acquire(ctx: ICapabilityContext, name: string): Promise<INormalizedLock>;
  /** POST _action=UNLOCK with the handle; answer whatever the handler wants of it. */
  release(
    ctx: ICapabilityContext,
    name: string,
    lockHandle: string,
  ): Promise<TReadResult>;
}

/** Per-handler strategy for VersionsCapability. */
export interface IVersionsStrategy<TConfig> {
  nameOf(config: Partial<TConfig>): string;
  list(ctx: ICapabilityContext, name: string): Promise<ObjectVersion[]>;
  /** GET the content URI, return the source text. */
  source(ctx: ICapabilityContext, contentUri: string): Promise<string>;
}
