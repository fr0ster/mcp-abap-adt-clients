/**
 * What every runtime handler has in common.
 *
 * `IRuntimeAnalysisObject` left `@mcp-abap-adt/interfaces` in 30.0.0 with the
 * wide composites: each runtime contract now declares its own `kind`, which is
 * the discriminator a consumer narrows on, so there is nothing left for a base
 * interface to add. This one is kept because the implementations in this
 * package still share it — as an implementation detail, which is what it now
 * is.
 */

/** A runtime handler, tagged with which resource it speaks for. */
export interface IRuntimeAnalysisObject<TKind extends string = string> {
  readonly kind: TKind;
}
