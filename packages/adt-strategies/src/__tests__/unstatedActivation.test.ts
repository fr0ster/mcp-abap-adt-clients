/**
 * When the inactive list decides an activation (C7, adt-clients 49.0.0).
 *
 * Until adt-clients 48.0.0 the client read the list itself after a checklist
 * that does not state its outcome, and decided when with a private copy of
 * this package's `severity()`. Since the split the caller reads the list, and
 * `readUnstatedActivation` tells it when. The function is the one predicate
 * `readActivationRefusal` decides by, so the two cannot drift.
 *
 * - The oracle: 48.0.0's reading, copied below as it was, on every recorded
 *   activation answer and on hand-written edges.
 * - The agreement: on the same answers, `readUnstatedActivation` is
 *   defined exactly when `readActivationRefusal` without a list answers "could
 *   not be decided".
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { readActivationRefusal, readUnstatedActivation } from '../index';

// ---- adt-clients 48.0.0's reading (src/utils/activationReading.ts), as it was ----
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

const ANSWERS = join(__dirname, '../../../adt-clients/corpus/adt/answers');
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
  [
    'not executed, one warning',
    checklist('<chkl:properties activationExecuted="false"/><msg type="W"/>'),
  ],
  [
    'not executed, cancelled',
    checklist(
      '<chkl:properties activationExecuted="false"/><msg type="W"/><msg type="E"/>',
    ),
  ],
  [
    'executed, one warning',
    checklist('<chkl:properties activationExecuted="true"/><msg type="W"/>'),
  ],
  [
    'no verdict, no message',
    checklist('<chkl:properties checkExecuted="true"/>'),
  ],
  ['no verdict, info and success', checklist('<msg type="I"/><msg type="S"/>')],
  ['empty', { status: 200, statusText: '', headers: {}, data: '' }],
  ['not xml', { status: 200, statusText: '', headers: {}, data: '<a' }],
];

describe('readUnstatedActivation', () => {
  it("answers what adt-clients 48.0.0's reading answered, on every recorded activation answer and the edges", () => {
    expect(recorded.length).toBeGreaterThan(5);
    for (const [name, answer] of [...recorded, ...edges])
      expect([name, readUnstatedActivation(answer)]).toEqual([
        name,
        oldUnstatedOutcome(answer),
      ]);
  });

  it.each([
    ['silent', 'silent'],
    ['one warning', 'unstated'],
    ['executed', undefined],
    ['an error', undefined],
    ['untyped', undefined],
    ['mixed', undefined],
    ['refused', undefined],
    ['not executed, one warning', undefined],
    ['not executed, cancelled', undefined],
    ['executed, one warning', undefined],
    ['no verdict, no message', undefined],
    ['no verdict, info and success', 'unstated'],
    ['empty', undefined],
    ['not xml', undefined],
  ])('%s: %s', (name, expected) => {
    const edge = edges.find(([n]) => n === name);
    if (!edge) throw new Error(`no edge ${name}`);
    expect(readUnstatedActivation(edge[1])).toBe(expected);
  });

  it('is defined exactly when the reading without a list could not decide', () => {
    for (const [name, answer] of [...recorded, ...edges]) {
      if (answer.status < 200 || answer.status >= 300) continue;
      const refusal = readActivationRefusal(answer.data);
      const undecided =
        refusal?.message.includes(
          "without the list of inactive objects the activation's outcome could not be decided",
        ) === true;
      expect([name, readUnstatedActivation(answer) !== undefined]).toEqual([
        name,
        undecided,
      ]);
    }
  });
});
