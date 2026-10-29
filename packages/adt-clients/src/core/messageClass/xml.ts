import { XMLParser } from 'fast-xml-parser';
import { TYPE_CODE } from '../../constants/typeCodes';

export interface IParsedMessage {
  msgno: string;
  msgtext: string;
  selfExplanatory?: boolean;
  description?: string;
  rawAttrs?: Record<string, string>;
}
export interface IParsedMessageClass {
  name: string;
  description?: string;
  language?: string;
  masterLanguage?: string;
  masterSystem?: string;
  responsible?: string;
  packageName?: string;
  messages: IParsedMessage[];
  rawAttrs?: Record<string, string>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
});

// Collect attributes, dropping ONLY the namespace declarations the builder
// re-emits from its own template (xmlns:mc, xmlns:adtcore) — keeping those would
// duplicate them and produce invalid XML. Any OTHER xmlns:* (an unknown/future
// prefix SAP may add, e.g. xmlns:foo) MUST be preserved so its prefixed
// attributes (foo:bar) stay bound on round-trip.
const TEMPLATE_NS = new Set(['@_xmlns:mc', '@_xmlns:adtcore']);
/**
 * Parsed XML is data from outside the type system: it is held as `unknown`
 * and read through `field`, which answers `undefined` for a value that is not
 * an element or has no such field.
 */
function isElement(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function field(node: unknown, key: string): unknown {
  return isElement(node) ? node[key] : undefined;
}

const A = (o: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!isElement(o)) return out;
  for (const [k, v] of Object.entries(o))
    if (k.startsWith('@_') && !TEMPLATE_NS.has(k)) out[k.slice(2)] = String(v);
  return out;
};

export function parseMessageClass(xml: string): IParsedMessageClass {
  const root: unknown = parser.parse(xml);
  const mc =
    field(root, 'mc:messageClass') ?? field(root, 'messageClass') ?? {};
  const attrs = A(mc);
  const pkgRef =
    field(mc, 'adtcore:packageRef') ?? field(mc, 'packageRef') ?? {};
  const rawMsgs = field(mc, 'mc:messages') ?? field(mc, 'messages');
  const list: unknown[] = Array.isArray(rawMsgs)
    ? rawMsgs
    : rawMsgs
      ? [rawMsgs]
      : [];
  const messages: IParsedMessage[] = list.map((m) => {
    const ma = A(m);
    return {
      msgno: ma['mc:msgno'] ?? '',
      msgtext: ma['mc:msgtext'] ?? '',
      selfExplanatory: ma['mc:selfexplainatory']
        ? ma['mc:selfexplainatory'] === 'true'
        : undefined,
      description: ma['adtcore:description'] || undefined,
      rawAttrs: ma,
    };
  });
  return {
    name: attrs['adtcore:name'] ?? '',
    description: attrs['adtcore:description'] || undefined,
    language: attrs['adtcore:language'] || undefined,
    masterLanguage: attrs['adtcore:masterLanguage'] || undefined,
    masterSystem: attrs['adtcore:masterSystem'] || undefined,
    responsible: attrs['adtcore:responsible'] || undefined,
    packageName: A(pkgRef)['adtcore:name'] || undefined,
    messages,
    rawAttrs: attrs,
  };
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Merge rawAttrs with named-field overrides into an attribute string. */
function attrString(
  raw: Record<string, string> | undefined,
  overrides: Record<string, string | undefined>,
): string {
  const merged: Record<string, string> = { ...(raw ?? {}) };
  for (const [k, v] of Object.entries(overrides))
    if (v !== undefined) merged[k] = v;
  return Object.entries(merged)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
}

export function buildMessageClassXml(
  cls: IParsedMessageClass,
  opts?: {
    messageLockHandles?: Record<string, string>;
    deletedMsgnos?: string[];
  },
): string {
  const locks = opts?.messageLockHandles ?? {};
  const deleted = new Set(opts?.deletedMsgnos ?? []);
  const rootAttrs = attrString(cls.rawAttrs, {
    'adtcore:name': cls.name,
    'adtcore:description': cls.description,
    'adtcore:language': cls.language,
    'adtcore:masterLanguage': cls.masterLanguage,
    'adtcore:masterSystem': cls.masterSystem,
    'adtcore:responsible': cls.responsible,
    'adtcore:type': TYPE_CODE.messageClass,
  });
  const pkg = cls.packageName
    ? `<adtcore:packageRef adtcore:name="${esc(cls.packageName)}"/>`
    : '';
  const msgs = cls.messages
    .map((m) => {
      const attrs = attrString(m.rawAttrs, {
        'mc:msgno': m.msgno,
        'mc:msgtext': m.msgtext,
        'mc:selfexplainatory':
          m.selfExplanatory === undefined
            ? undefined
            : String(m.selfExplanatory),
        'adtcore:description': m.description,
        'mc:lockhandle': locks[m.msgno],
      });
      // Messages flagged for deletion are emitted as <mc:deletedmessages> carrying
      // their lock handle; SAP uses this element to identify and remove them on PUT.
      // All other messages stay as <mc:messages> so they are preserved (upserted).
      if (deleted.has(m.msgno)) {
        return `<mc:deletedmessages ${attrs}/>`;
      }
      return `<mc:messages ${attrs}/>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" ${rootAttrs}>${pkg}${msgs}</mc:messageClass>`;
}
