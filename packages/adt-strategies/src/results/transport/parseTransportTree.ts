/**
 * Parse the transport tree ADT hands back for a saved search.
 *
 * The chain above a `tm:request` is not fixed: without `?targets=true` it is
 * `tm:workbench > tm:modifiable > tm:request`; with it, ADT inserts a
 * `tm:target` level in between. Both are real captures from the ABAP Cloud system —
 * same data, different request. So this recurses by element NAME — whenever a
 * key (namespace stripped) is `request`, that is a request, whatever nesting
 * got you there — instead of walking a path a caller happened to observe once.
 * A path-shaped parser passes one fixture and silently returns zero requests
 * on the other.
 */

import {
  isElement,
  leafText,
  listOf,
  ownText,
  type ParsedElement,
} from '../../parsed';
import { hasContent, transportRoot } from './document';
import type {
  ITransportTree,
  ITransportTreeLink,
  ITransportTreeNode,
  ITransportTreeRequest,
  ITransportTreeTask,
} from './types';

/** Elements that are structural but never "containers" on the way to a request. */
const NON_CONTAINER_NAMES = new Set(['task', 'link', 'long_desc']);

/** The elements of a parsed value that may be one or several. */
const elements = (value: unknown): ParsedElement[] =>
  listOf(value).filter(
    (item): item is ParsedElement => isElement(item) && !Array.isArray(item),
  );

/** Element name with the namespace prefix stripped: "tm:request" -> "request". */
const bareName = (key: string): string => key.slice(key.lastIndexOf(':') + 1);

/** The first child key (namespace-qualified or not) whose bare name matches. */
const findChild = (node: ParsedElement, bare: string): unknown => {
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_')) continue;
    if (bareName(key) === bare) return node[key];
  }
  return undefined;
};

/**
 * A node's own attributes, verbatim except for the parser's own `@_` marker.
 * `xmlns` declarations describe the document, not the element, so they are
 * dropped here rather than handed to a consumer as if they meant something.
 */
const ownAttributes = (node: ParsedElement): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_')) continue;
    const name = key.slice(2);
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    const value = leafText(node[key]);
    if (value !== undefined) attributes[name] = value;
  }
  return attributes;
};

/**
 * `tm:long_desc` text, distinguishing "present and empty" from "absent".
 * The element self-closes to `''` under this parser's options; a missing key
 * means the element was never there. Collapsing the two would be the same
 * silent flattening as dropping a container.
 */
const readLongDesc = (node: ParsedElement): string | undefined => {
  const value = findChild(node, 'long_desc');
  if (value === undefined) return undefined;
  return ownText(value) ?? '';
};

const buildLink = (node: ParsedElement): ITransportTreeLink => ({
  attributes: ownAttributes(node),
});

const buildTask = (node: ParsedElement): ITransportTreeTask => ({
  attributes: ownAttributes(node),
  links: elements(findChild(node, 'link')).map(buildLink),
  longDesc: readLongDesc(node),
});

const buildRequest = (
  node: ParsedElement,
  containers: ITransportTreeNode[],
): ITransportTreeRequest => ({
  attributes: ownAttributes(node),
  containers,
  links: elements(findChild(node, 'link')).map(buildLink),
  longDesc: readLongDesc(node),
  tasks: elements(findChild(node, 'task')).map(buildTask),
});

/**
 * Recurse from a node, collecting every request found underneath — at any
 * depth, under any container name. `containers` accumulates outermost first
 * as the walk descends, so a request nested three levels deep and one nested
 * two levels deep both come back with the containers they actually passed
 * through, not a shape this module assumed in advance.
 */
const walk = (
  node: ParsedElement,
  containers: ITransportTreeNode[],
  requests: ITransportTreeRequest[],
): void => {
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const bare = bareName(key);

    if (bare === 'request') {
      for (const requestNode of elements(node[key])) {
        requests.push(buildRequest(requestNode, containers));
      }
      continue;
    }
    if (NON_CONTAINER_NAMES.has(bare)) continue;

    for (const childNode of elements(node[key])) {
      walk(
        childNode,
        [
          ...containers,
          { element: bare, attributes: ownAttributes(childNode) },
        ],
        requests,
      );
    }
  }
};

/** The words this reading refuses an answer with; nothing of the document. */
export const TRANSPORT_TREE_REFUSAL =
  'parseTransportTree: the answer is no transport list';

/**
 * Read a saved search's answer into its tree.
 *
 * Throws `TRANSPORT_TREE_REFUSAL` — fixed words, nothing of the body — for an
 * answer that is no well-formed `tm:root` document, and for a root that
 * carries nothing: no attribute of its own and no element. A list always
 * names the search it ran (`adtcore:name` and the created/changed stamps on
 * the root, recorded `read-transport-list-structure` even when it lists no
 * request), so a bare `<tm:root/>` is no list, not an empty one. Until 0.28.0
 * the error quoted up to 200 characters of the body, and a bare root read as
 * an empty list.
 */
export function parseTransportTree(data: unknown): ITransportTree {
  const root = transportRoot(data);
  if (root === undefined || !hasContent(root)) {
    throw new Error(TRANSPORT_TREE_REFUSAL);
  }
  const requests: ITransportTreeRequest[] = [];
  walk(root, [], requests);
  return {
    attributes: ownAttributes(root),
    requests,
  };
}
