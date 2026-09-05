/**
 * Transport module type definitions.
 *
 * The tree shapes below left `@mcp-abap-adt/interfaces` in 31.0.0 with the
 * other result shapes: `IAdtRequest<TList>` says a listing answers *something*,
 * and what that something looks like is the reading's to name — which is here,
 * beside {@link parseTransportTree}, the reading that builds it.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';
import type { ICreatedTransport } from './parseCreatedTransport';
import { parseCreatedTransport } from './parseCreatedTransport';
import { parseTransportTree } from './parseTransportTree';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateTransportParams,
  IListTransportsParams,
  ITransportConfig,
} from '@mcp-abap-adt/interfaces';

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

/** One strategy per member of a transport-request implementation. */
export interface ITransportResults<
  TCreated = ICreatedTransport,
  TRead = string,
  TList = ITransportTree,
  TUpdated = string,
  TDeleted = string,
> {
  /**
   * What the create answers.
   *
   * The new request by default: a create whose number a caller cannot reach is
   * a create they cannot use, and the number is the only thing the document is
   * there to deliver. `rawDocument` gives the document back untouched.
   */
  readonly created: IResultStrategy<TCreated>;
  /** What a read of one request answers. */
  readonly read: IResultStrategy<TRead>;
  /**
   * What the listing answers.
   *
   * The tree by default, because it is the only reading that carries the
   * containers, the description and the language a request holds — none of
   * which a consumer could reach before without re-fetching and parsing the
   * document themselves. `rawDocument` gives the document back untouched.
   */
  readonly list: IResultStrategy<TList>;
  /** What the description update answers. */
  readonly updated: IResultStrategy<TUpdated>;
  /** What the deletion answers. */
  readonly deleted: IResultStrategy<TDeleted>;
}

/**
 * The shipped default: documents as they arrived, and the tree for the listing.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const transportDocuments = {
  created: (answer) => parseCreatedTransport(answer.data),
  read: rawDocument,
  list: (answer) => parseTransportTree(answer.data),
  updated: rawDocument,
  deleted: rawDocument,
} satisfies ITransportResults;
