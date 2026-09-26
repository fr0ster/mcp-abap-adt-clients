/**
 * The one reading shape still declared in this package.
 *
 * The cross-cutting readings — search hits, the type catalogue, the repository
 * tree, the inactive list, where-used references and the activation run id —
 * moved to `@mcp-abap-adt/adt-strategies` (`results/utils`) with the shapes they
 * build. This library answers those documents as they arrived.
 *
 * `INamedItem` stays because the trace catalogues in `runtime/` and
 * `executors/` still name it; the strategies package declares the same shape,
 * and this copy goes when those consumers take theirs from there.
 */

/** One entry of a named-item list — a URI and its description. */
export interface INamedItem {
  /** A URI, as the server writes it — not a short code. */
  name: string;
  description: string;
}
