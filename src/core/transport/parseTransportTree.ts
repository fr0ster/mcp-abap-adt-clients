/**
 * Parse the transport tree ADT hands back for a saved search.
 *
 * The chain above a `tm:request` is not fixed: without `?targets=true` it is
 * `tm:workbench > tm:modifiable > tm:request`; with it, ADT inserts a
 * `tm:target` level in between. Both are real captures from the same trial —
 * same data, different request. So this recurses by element NAME — whenever a
 * key (namespace stripped) is `request`, that is a request, whatever nesting
 * got you there — instead of walking a path a caller happened to observe once.
 * A path-shaped parser passes one fixture and silently returns zero requests
 * on the other.
 */

import type {
  ITransportTree,
  ITransportTreeLink,
  ITransportTreeNode,
  ITransportTreeRequest,
  ITransportTreeTask,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/** Elements that are structural but never "containers" on the way to a request. */
const NON_CONTAINER_NAMES = new Set(['task', 'link', 'long_desc']);

const asArray = (value: unknown): Record<string, unknown>[] => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
};

/** Element name with the namespace prefix stripped: "tm:request" -> "request". */
const bareName = (key: string): string =>
  key.includes(':') ? (key.split(':').pop() as string) : key;

/** The first child key (namespace-qualified or not) whose bare name matches. */
const findChild = (node: Record<string, unknown>, bare: string): unknown => {
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
const ownAttributes = (
  node: Record<string, unknown>,
): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_')) continue;
    const name = key.slice(2);
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    attributes[name] = String(node[key]);
  }
  return attributes;
};

/**
 * `tm:long_desc` text, distinguishing "present and empty" from "absent".
 * The element self-closes to `''` under this parser's options; a missing key
 * means the element was never there. Collapsing the two would be the same
 * silent flattening as dropping a container.
 */
const readLongDesc = (node: Record<string, unknown>): string | undefined => {
  const value = findChild(node, 'long_desc');
  if (value === undefined) return undefined;
  if (typeof value === 'object' && value !== null) return '';
  return String(value);
};

const buildLink = (node: Record<string, unknown>): ITransportTreeLink => ({
  attributes: ownAttributes(node),
});

const buildTask = (node: Record<string, unknown>): ITransportTreeTask => ({
  attributes: ownAttributes(node),
  links: asArray(findChild(node, 'link')).map(buildLink),
  longDesc: readLongDesc(node),
});

const buildRequest = (
  node: Record<string, unknown>,
  containers: ITransportTreeNode[],
): ITransportTreeRequest => ({
  attributes: ownAttributes(node),
  containers,
  links: asArray(findChild(node, 'link')).map(buildLink),
  longDesc: readLongDesc(node),
  tasks: asArray(findChild(node, 'task')).map(buildTask),
});

/**
 * Recurse from a node, collecting every request found underneath — at any
 * depth, under any container name. `containers` accumulates outermost first
 * as the walk descends, so a request nested three levels deep and one nested
 * two levels deep both come back with the containers they actually passed
 * through, not a shape this module assumed in advance.
 */
const walk = (
  node: Record<string, unknown>,
  containers: ITransportTreeNode[],
  requests: ITransportTreeRequest[],
): void => {
  for (const key of Object.keys(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const bare = bareName(key);

    if (bare === 'request') {
      for (const requestNode of asArray(node[key])) {
        requests.push(buildRequest(requestNode, containers));
      }
      continue;
    }
    if (NON_CONTAINER_NAMES.has(bare)) continue;

    const value = node[key];
    if (typeof value !== 'object' || value === null) continue;
    for (const childNode of asArray(value)) {
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

export function parseTransportTree(data: unknown): ITransportTree {
  const raw = typeof data === 'string' ? data : '';
  const xml = raw.trim();

  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const rootKey = Object.keys(parsed).find(
    (key) => key !== '?xml' && (key === 'tm:root' || key === 'root'),
  );

  if (!rootKey) {
    const foundKey = Object.keys(parsed).find((key) => key !== '?xml');
    const found = foundKey ? `"${foundKey}"` : 'no root element';
    throw new Error(
      `parseTransportTree: expected tm:root, found ${found}: "${xml.slice(0, 200)}"`,
    );
  }

  const root = parsed[rootKey] as Record<string, unknown>;
  const requests: ITransportTreeRequest[] = [];
  walk(root, [], requests);

  return {
    attributes: ownAttributes(root),
    requests,
  };
}
