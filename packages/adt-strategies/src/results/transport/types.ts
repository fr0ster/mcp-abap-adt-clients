/**
 * The shapes the transport readings build — moved from adt-clients with the
 * readings, since the client answers documents as they arrived and no longer
 * names a parsed shape of its own.
 */

/**
 * One container a request was nested under — `tm:workbench`, `tm:target`,
 * `tm:modifiable` and whatever else a system groups by.
 *
 * A list rather than named fields because the chain is not fixed: `?targets=true`
 * inserts a `tm:target` level, and a parser that assumed a shape would return
 * nothing on the other form.
 */
export interface ITransportTreeNode {
  /** Element name without its prefix: "workbench", "target", "modifiable" … */
  element: string;
  /** The container's own attributes, verbatim. */
  attributes: Record<string, string | undefined>;
}

/**
 * One `atom:link` on a request or a task.
 *
 * These are how ADT names its own operations — `release`, `addobject`,
 * `changeowner`, `merge`, `newtask` — so a caller follows an href rather than
 * assembling a URL by convention.
 */
export interface ITransportTreeLink {
  /** href, rel, type, title — verbatim, unprefixed of the parser's own marker. */
  attributes: Record<string, string | undefined>;
}

export interface ITransportTreeTask {
  /** tm:number, tm:parent, tm:owner, tm:desc, tm:type, tm:status … verbatim. */
  attributes: Record<string, string | undefined>;
  /**
   * Every `atom:link`, in document order. These carry the operation URIs —
   * release, reassign, addobject, consistencycheck — so dropping them would
   * force a consumer to rebuild ADT URLs by convention.
   */
  links: ITransportTreeLink[];
  /**
   * `tm:long_desc` text. `''` when present and empty, `undefined` when absent.
   */
  longDesc: string | undefined;
}

/**
 * One transport request, with its tasks and the containers it was found under.
 *
 * The containers are kept because they carry information the request does not:
 * `tm:target` has a human name (`"Local Change Requests"`) where the request has
 * `tm:target=""`. Dropping them would be this library deciding what a consumer
 * needs.
 */
export interface ITransportTreeRequest {
  /** Attributes verbatim — `tm:number`, not `number`. No renaming, no selection. */
  attributes: Record<string, string | undefined>;
  /** Ancestors, outermost first. Empty only if the server nested it under nothing. */
  containers: ITransportTreeNode[];
  /** Every `atom:link` on the request, in document order. */
  links: ITransportTreeLink[];
  /**
   * `tm:long_desc` text. `''` when the element is present and empty;
   * `undefined` when the element is absent. The two are not the same thing and
   * the type does not pretend they are.
   */
  longDesc: string | undefined;
  /** Empty when the request has no tasks — never undefined. */
  tasks: ITransportTreeTask[];
}

/**
 * The parsed transport tree. Empty `requests` is a legitimate answer, not a
 * failure.
 *
 * `attributes` are the root's own — `adtcore:name` is the user the saved search
 * ran for, plus the four created/changed stamps. They are the only record of
 * *whose* list this is, so dropping them would leave a caller unable to tell two
 * lists apart.
 */
export interface ITransportTree {
  attributes: Record<string, string | undefined>;
  requests: ITransportTreeRequest[];
}
