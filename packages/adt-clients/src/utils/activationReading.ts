/**
 * The activation reading: what an activation's checklist leaves unstated,
 * read from SAP's answer and nothing else (#304, the owner's decision on the
 * reader list). It only reads, so it is a reader module; the request and the
 * inactive-objects read stay in `activationUtils.ts`.
 */
import type {
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { field, isElement } from './ownValue';

// ---------------------------------------------------------------------------
// The one read after a checklist that does not state its outcome
// (fr0ster/mcp-abap-adt#351, #360)
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

/** One element or several, as a list. */
function listOf(value: unknown): unknown[] {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

/** A well-formed XML document, parsed; `undefined` for anything else. */
function parsedXml(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== 'string' || body.trim() === '') return undefined;
  if (XMLValidator.validate(body) !== true) return undefined;
  const parsed: unknown = parser.parse(body);
  return isElement(parsed) ? parsed : undefined;
}

/**
 * The message types of a checklist without `activationExecuted` after which
 * the list is read: a warning, an information, a success, as
 * {@link severityLetter} reads them. A message of any other type, or no
 * message at all, leaves the answer as it was: nothing more is read.
 */
const LIST_READ_BESIDE: ReadonlySet<string> = new Set(['W', 'I', 'S']);

/**
 * A message type as one letter: a copy of adt-strategies' `severity()`
 * (`src/refusals/read.ts`), so the client reads the list after exactly the
 * checklists that strategy decides by it. adt-clients does not depend on
 * adt-strategies at run time; `activationRead.test.ts` pins the two equal by
 * behaviour. No type at all reads as `E`.
 */
function severityLetter(raw: unknown): string {
  const s = (typeof raw === 'string' ? raw : '').trim().toUpperCase();
  if (!s) return 'E';
  if (s.startsWith('ERROR') || s === 'E') return 'E';
  if (s.startsWith('WARN') || s === 'W') return 'W';
  if (s.startsWith('INFO') || s === 'I') return 'I';
  if (s.startsWith('SUCCESS') || s === 'S') return 'S';
  if (s === 'OK') return 'S';
  if (s === 'CRITICAL' || s === 'FATAL') return 'E';
  if (s === 'TOLERABLE') return 'W';
  return s;
}

/**
 * The checklists that do not state the activation's outcome themselves, for
 * which the inactive list is the one fact that does. This decides nothing:
 * it only says when the client reads the list, and the consumer's `analyse`
 * judges the answer and the list.
 *
 * - `silent`: `activationExecuted="false"` and no `msg`. It answered both a
 *   re-activation that had nothing to do and an activation that left a
 *   function group inactive (S/4HANA 2025, fr0ster/mcp-abap-adt#351).
 * - `unstated`: no `activationExecuted`, and only `W`/`I`/`S` messages.
 *   SAP sets the attribute only once its activation run starts, and
 *   SAP_BASIS 7.52 answered this, with one warning, for a program it
 *   activated (fr0ster/mcp-abap-adt#360).
 */
export type UnstatedOutcome = 'silent' | 'unstated';

/**
 * Whether a `2xx` `chkl:messages` leaves the activation's outcome unstated,
 * and how ({@link UnstatedOutcome}). `undefined` for every other answer:
 * nothing more is read.
 */
export function unstatedOutcome(
  answer: IAdtWireResponse,
): UnstatedOutcome | undefined {
  if (answer.status < 200 || answer.status >= 300) return undefined;
  const root = parsedXml(answer.data);
  if (root === undefined || !Object.hasOwn(root, 'messages')) return undefined;
  const checklist = field(root, 'messages');
  const executed = field(field(checklist, 'properties'), '@activationExecuted');
  const messages = listOf(field(checklist, 'msg'));
  if (executed === 'false' && messages.length === 0) return 'silent';
  if (
    executed === undefined &&
    messages.length > 0 &&
    messages.every((message) =>
      LIST_READ_BESIDE.has(severityLetter(field(message, '@type'))),
    )
  ) {
    return 'unstated';
  }
  return undefined;
}

/** The `adtcore:uri` of every reference an activation request sent. */
export function namedIn(request: IAbapRequestOptions | undefined): string[] {
  const references = field(
    field(parsedXml(request?.data), 'objectReferences'),
    'objectReference',
  );
  return listOf(references).flatMap((reference) => {
    const uri = field(reference, '@uri');
    return typeof uri === 'string' ? [uri] : [];
  });
}
