/**
 * Step 39a of #304: the activation reading moved out of activationUtils.ts
 * into activationReading.ts, which only reads. It gives what the code before
 * the move gave (copied below as the oracle) on every recorded activation
 * answer and on hand-written checklists.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { unstatedOutcome } from '../../../utils/activationReading';

// ---- the code before the move, as it was ----
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

/** Whether a parsed value is an element: what the parser makes of one. */
function isElement(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A field of a parsed element; `undefined` for anything else. */
function field(node: unknown, key: string): unknown {
  return isElement(node) ? node[key] : undefined;
}

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
type UnstatedOutcome = 'silent' | 'unstated';

/**
 * Whether a `2xx` `chkl:messages` leaves the activation's outcome unstated,
 * and how ({@link UnstatedOutcome}). `undefined` for every other answer:
 * nothing more is read.
 */
function oldUnstatedOutcome(
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

// ---- end of the copy ----

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');
const recorded = readdirSync(ANSWERS)
  .filter((f) => /^activat/.test(f) && f.endsWith('.json'))
  .sort()
  .map((file): [string, IAdtWireResponse] => {
    const meta = JSON.parse(readFileSync(join(ANSWERS, file), 'utf-8')) as {
      response: { status: number; bodyFile?: string };
    };
    return [
      file,
      {
        status: meta.response.status,
        statusText: '',
        headers: {},
        data: meta.response.bodyFile
          ? readFileSync(join(ANSWERS, meta.response.bodyFile), 'utf-8')
          : '',
      },
    ];
  });

const checklist = (inner: string, status = 200): IAdtWireResponse => ({
  status,
  statusText: '',
  headers: {},
  data: `<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">${inner}</chkl:messages>`,
});
const edges: [string, IAdtWireResponse][] = [
  ['silent', checklist('<chkl:properties activationExecuted="false"/>')],
  ['executed', checklist('<chkl:properties activationExecuted="true"/>')],
  [
    'one warning',
    checklist('<msg type="W"><shortText><txt>w</txt></shortText></msg>'),
  ],
  ['an error', checklist('<msg type="E"/>')],
  ['untyped', checklist('<msg/>')],
  ['mixed', checklist('<msg type="W"/><msg type="ERROR"/>')],
  ['refused', checklist('<chkl:properties activationExecuted="false"/>', 403)],
  ['empty', { status: 200, statusText: '', headers: {}, data: '' }],
  ['not xml', { status: 200, statusText: '', headers: {}, data: '<a' }],
];

describe('the activation reading reads as before the move', () => {
  it('on every recorded activation answer and the edges', () => {
    expect(recorded.length).toBeGreaterThan(5);
    for (const [name, answer] of [...recorded, ...edges])
      expect([name, unstatedOutcome(answer)]).toEqual([
        name,
        oldUnstatedOutcome(answer),
      ]);
  });
});
