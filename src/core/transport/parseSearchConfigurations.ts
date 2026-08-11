/**
 * Read the saved transport search configurations.
 *
 * Exactly as much parsing as it takes to address a configuration: its href, its
 * etag, and its own attributes handed back unrenamed. What any of those mean is
 * the consumer's business.
 */

import type { ITransportSearchConfiguration } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

const asArray = (value: unknown): Record<string, unknown>[] => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
};

/**
 * Read an attribute whether or not ADT namespace-qualifies it.
 *
 * The same reason `parseSearchResults` does this: releases differ on whether
 * these attributes carry a prefix, and pinning one spelling returns empty
 * strings on a system using the other.
 */
const attr = (
  node: Record<string, unknown>,
  name: string,
): string | undefined => {
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_')) continue;
    const bare = key.slice(2).split(':').pop();
    if (bare !== name) continue;
    const text = String(node[key]).trim();
    return text.length > 0 ? text : undefined;
  }
  return undefined;
};

const ownAttributes = (
  node: Record<string, unknown>,
): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_')) continue;
    const name = key.slice(2);
    // Namespace declarations describe the document, not the configuration.
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    attributes[name] = String(node[key]);
  }
  return attributes;
};

export function parseSearchConfigurations(
  data: unknown,
): ITransportSearchConfiguration[] {
  const xml = typeof data === 'string' ? data.trim() : '';
  if (xml === '') {
    return [];
  }

  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const root = (parsed['configurations:configurations'] ??
    parsed.configurations) as Record<string, unknown> | undefined;
  if (!root) {
    return [];
  }

  const nodes = asArray(
    root['configuration:configuration'] ?? root.configuration,
  );

  const configurations: ITransportSearchConfiguration[] = [];
  for (const node of nodes) {
    const links = asArray(node['atom:link'] ?? node.link);
    const self = links.find((link) => attr(link, 'href') !== undefined);
    const uri = self ? attr(self, 'href') : undefined;
    // A configuration we cannot address is not one we can search with.
    if (!uri) continue;

    const configuration: ITransportSearchConfiguration = {
      uri,
      attributes: ownAttributes(node),
    };
    const etag = self ? attr(self, 'etag') : undefined;
    if (etag) {
      configuration.etag = etag;
    }
    configurations.push(configuration);
  }
  return configurations;
}
