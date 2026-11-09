import {
  AdtObjectErrorCodes,
  type IAdtAnalyseContext,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  at,
  field,
  isElement,
  leafText,
  listOf,
  type ParsedElement,
} from '../parsed';

/**
 * Reading a refusal out of the document SAP sent.
 *
 * ADT answers `200` and refuses in the body, so the HTTP status is not the
 * signal. Where the signal *is* differs by document, and the corpus in
 * `tests/fixtures/adt/` measures four forms that do not agree with each other.
 * These readings are one per form, not one per object family — the same four
 * documents serve every family.
 *
 * **Why these are plain functions and not `IAnalyse` implementations yet.** The
 * injectable contract lives in `@mcp-abap-adt/interfaces-adt`, and this
 * repository is still on 13 until the stack is raised. The substance of an
 * error strategy is reading the document; wrapping a reading as
 * `(verdict, answer) => verdict === ADT_NO_FAILURE ? read(answer.data) ?? ADT_NO_FAILURE : verdict`
 * is mechanical. Keeping the reading free of the contract means it is testable
 * against the corpus today rather than after the bump, and the wrapper is the
 * only part that has to wait.
 *
 * Every rule below is evidenced by a named fixture, and
 * `src/__tests__/unit/adtRefusalReadings.test.ts` runs each one against it.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Both of these off, and the second is not cosmetic. `parseTagValue` defaults
  // to true and coerces element text that looks numeric, which turns the T100
  // message number `002` into `2` — a key no SAP system recognises. Everything
  // read here is text SAP wrote, and it is kept as written.
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

/**
 * One message SAP attached to its verdict, in the one shape every form reduces
 * to: **a severity and a sentence.**
 *
 * That reduction is the whole point. The forms carry wildly different amounts —
 * a T100 key and its placeholders at one end, a bare sentence in an attribute at
 * the other — but every refusal that carries anything at all carries those two.
 * A strategy can rest on them; everything else is enrichment that may be absent.
 *
 * `W` and `I` are kept, not filtered: the caller decides what a warning means.
 */
export interface AdtMessage {
  /** Normalised to a single letter: `E`, `W`, `I`, `S`. */
  readonly type: string;
  /** The sentence, as SAP rendered it. Always present. */
  readonly text: string;
  /**
   * The server's own identifier for this message, where the carrier gave one.
   * Two unrelated things wear this: an `exc:exception` names a class like
   * `ExceptionResourceNotFound`, a syntax finding names the compiler's
   * `MESSAGE(GTH)`. Neither is a T100 key.
   */
  readonly code?: string;
  /**
   * The ABAP message key, where the carrier kept it — `SADT_RESOURCE` `026`
   * with the values that were substituted into the text. `exc:exception`
   * carries it in its properties; a deletion message carries it in the link to
   * its long text. Other carriers deliver the sentence alone.
   */
  readonly t100?: {
    readonly id: string;
    readonly no: string;
    readonly values?: ReadonlyArray<string>;
  };
  readonly line?: string;
  readonly uri?: string;
}

/** SAP spells severity three ways. One letter out. */
function severity(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!s) return 'E';
  if (s.startsWith('ERROR') || s === 'E') return 'E';
  if (s.startsWith('WARN') || s === 'W') return 'W';
  if (s.startsWith('INFO') || s === 'I') return 'I';
  if (s.startsWith('SUCCESS') || s === 'S') return 'S';
  if (s === 'OK') return 'S';
  // ABAP Unit grades its alerts on its own scale.
  if (s === 'CRITICAL' || s === 'FATAL') return 'E';
  if (s === 'TOLERABLE') return 'W';
  return s;
}

/**
 * What a reading produces when the document is a refusal.
 *
 * The field names mirror `IAdtError` so that wrapping this as an `IAnalyse`
 * adds `origin` and nothing else. `origin` is deliberately absent here: every
 * one of these is `'refusal'` by construction — SAP answered, about this
 * object, and said no — and a reading that could also return `'connection'`
 * would be claiming to know something it cannot see.
 */
export interface AdtRefusal {
  /** What SAP said, verbatim where SAP said anything. */
  readonly message: string;
  /** `<type id="…">`, the server's own classification, where it gave one. */
  readonly adtType?: string;
  /** `<namespace id="…">`, where the document names one. */
  readonly namespace?: string;
  /**
   * Every message in the document, `E`, `W` and `I` alike, normalised.
   *
   * Never empty. A form that states no severity gets one inferred — an
   * `exc:exception` IS the refusal, and a check that never ran says so in its
   * status — because a caller that has to ask "did this carrier happen to
   * include a severity" is back to handling five shapes.
   */
  readonly messages: ReadonlyArray<AdtMessage>;
  /** Which form this was read from, for diagnosis. */
  readonly form:
    | 'exception'
    | 'activation'
    | 'deletion'
    | 'checkrun'
    | 'validation'
    | 'unittest'
    | 'publication'
    | 'cdsTestDoubles'
    | 'messageClass'
    | 'objectProperties';
  /**
   * An `AdtObjectErrorCodes` value where the reading names one — a message a
   * class does not hold is `OBJECT_NOT_FOUND`. Absent where the document is
   * the whole answer.
   */
  readonly code?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** One child vs many children — the trap that broke the transport tree in #168. */
const asArray = listOf;

/**
 * Text of a node that may be a bare string or an element with attributes.
 *
 * `<message lang="EN">text</message>` parses to an object once `lang` is kept,
 * and to a string when it has no attributes. Both spellings occur.
 */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  if (isElement(node)) {
    const text = node['#text'];
    if (typeof text === 'string') return text.trim();
    if (typeof text === 'number') return String(text);
  }
  return '';
}

/**
 * The document, parsed, or `null` for one that is empty or not XML. Parsed XML
 * is data from outside the type system: it is `unknown`, read through
 * `field` / `at`.
 */
function parseXml(document: unknown): ParsedElement | null {
  if (typeof document !== 'string' || document.trim() === '') return null;
  try {
    const parsed: unknown = parser.parse(document);
    return isElement(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Form 1 — the HTTP status carries it, the document explains it
// ---------------------------------------------------------------------------

/**
 * The subtype an `exc:exception` names, under
 * `com.sap.adt.communicationFramework.subType` — what tells one `500 AdiFailed`
 * from another. `undefined` when the document is not an exception or names
 * none.
 *
 * Fixtures: `debugger-run-to-line--08-stepcontinue` (`debuggeeEnded`),
 * `debugger-terminate--01-terminate-debuggee` (`terminateDebuggee`).
 */
export function readExceptionSubType(document: unknown): string | undefined {
  const root = field(parseXml(document), 'exception');
  if (!root) return undefined;
  for (const entry of asArray(at(root, 'properties', 'entry'))) {
    if (field(entry, '@key') === 'com.sap.adt.communicationFramework.subType')
      return textOf(entry) || undefined;
  }
  return undefined;
}

/**
 * `exc:exception`, the document behind every non-2xx ADT refusal.
 *
 * Fixtures: `refusal-object-not-found` (404), `refusal-package-not-found-tree`
 * (404), `refusal-lock-held-by-other` (403), `refusal-write-not-locked` (423).
 *
 * This form is the one where the library's own verdict is already a failure, so
 * a strategy built on it **enriches rather than replaces**: `type id` and
 * `namespace id` are the server's words and would otherwise be parsed out by
 * every consumer for themselves.
 */
export function readExceptionRefusal(document: unknown): AdtRefusal | null {
  const root = field(parseXml(document), 'exception');
  if (!root) return null;

  const properties = new Map<string, string>();
  for (const entry of asArray(at(root, 'properties', 'entry'))) {
    const key = field(entry, '@key');
    if (typeof key === 'string') properties.set(key, textOf(entry));
  }

  const id = properties.get('T100KEY-ID');
  const no = properties.get('T100KEY-NO');
  const values = [...properties.entries()]
    .filter(([key]) => /^T100KEY-V\d+$/.test(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
  const text =
    textOf(field(root, 'message')) ||
    textOf(field(root, 'localizedMessage')) ||
    'ADT refused the request';
  const typeId = at(root, 'type', '@id');
  const adtType = typeof typeId === 'string' ? typeId : undefined;
  const namespaceId = at(root, 'namespace', '@id');

  return {
    form: 'exception',
    message: text,
    adtType,
    namespace: typeof namespaceId === 'string' ? namespaceId : undefined,
    // The severity is not in the document: an exc:exception IS the refusal and
    // the HTTP status carries the verdict. It is stated here anyway so that the
    // richest form reduces to the same {severity, text} as the poorest.
    messages: [
      {
        type: 'E',
        text,
        code: adtType,
        t100:
          id && no
            ? { id, no, values: values.length ? values : undefined }
            : undefined,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Form 2a — activation: the answer of `POST /activation`, under HTTP 200
// ---------------------------------------------------------------------------

/**
 * One object an inactive-objects list names: the attributes of its reference,
 * as SAP sent them.
 */
export interface IAdtStillInactive {
  readonly uri: string;
  readonly type: string;
  readonly name: string;
  readonly parentUri?: string;
}

/** An activation's refusal, with what SAP listed as still inactive. */
export interface AdtActivationRefusal extends AdtRefusal {
  /** What SAP listed as still inactive; empty for a checklist refusal. */
  readonly stillInactive: ReadonlyArray<IAdtStillInactive>;
}

/** The facts an activation member hands beside a silent checklist (Q7). */
export type AdtActivationFacts = NonNullable<IAdtAnalyseContext['activation']>;

/** A well-formed XML document, parsed; `null` for anything else. */
function wellFormed(document: unknown): ParsedElement | null {
  if (typeof document !== 'string') return null;
  if (XMLValidator.validate(document) !== true) return null;
  return parseXml(document);
}

/** Whether a parsed document's root is the element of this (local) name. */
function rootIs(parsed: ParsedElement | null, name: string): boolean {
  return parsed !== null && Object.hasOwn(parsed, name);
}

/** A reference's attributes, when it carries a name; nothing otherwise. */
function stillInactiveOf(ref: unknown): IAdtStillInactive[] {
  const name = leafText(field(ref, '@name'));
  if (!name) return [];
  const uri = leafText(field(ref, '@uri')) ?? '';
  const type = leafText(field(ref, '@type')) ?? '';
  const parentUri = leafText(field(ref, '@parentUri'));
  return parentUri === undefined
    ? [{ uri, type, name }]
    : [{ uri, type, name, parentUri }];
}

/**
 * The objects an inactive-objects list names, in either shape it is answered
 * in: `ioc:inactiveObjects` (an entry's `ioc:object/ioc:ref`; a transport's
 * `ioc:ref` is never read, so the transport-only entry contributes nothing)
 * and the flat `adtcore:objectReferences` of SAP_BASIS 7.40. `null` for a
 * document that is neither.
 */
function listedObjects(
  parsed: ParsedElement | null,
): IAdtStillInactive[] | null {
  if (parsed === null) return null;
  if (rootIs(parsed, 'inactiveObjects')) {
    return listOf(at(parsed, 'inactiveObjects', 'entry')).flatMap((entry) =>
      stillInactiveOf(at(entry, 'object', 'ref')),
    );
  }
  if (rootIs(parsed, 'objectReferences')) {
    return listOf(at(parsed, 'objectReferences', 'objectReference')).flatMap(
      stillInactiveOf,
    );
  }
  return null;
}

/**
 * The objects of an inactive-objects list that an activation named: an entry
 * counts when its `uri`, or its `parentUri`, is one of `named` (the uris of
 * the references the activation request sent). The transport-only entry never
 * counts.
 *
 * The one judgement both activation paths make after a silent checklist
 * (`activationExecuted="false"`, no message; decisions Q7 and Q8):
 * `readActivationRefusal` calls it with the list the member read, and a
 * consumer of the run sequence calls it with the list it read after
 * `getActivationResults`. An empty array: none of the named objects is still
 * inactive. `null`: the answer is no `2xx` inactive-objects list, so nothing
 * can be decided from it.
 */
export function stillInactiveAmong(
  named: readonly string[],
  inactiveObjects: IAdtWireResponse,
): ReadonlyArray<IAdtStillInactive> | null {
  if (inactiveObjects.status < 200 || inactiveObjects.status >= 300) {
    return null;
  }
  const listed = listedObjects(wellFormed(inactiveObjects.data));
  if (listed === null) return null;
  const names = new Set(named);
  return listed.filter(
    (entry) =>
      names.has(entry.uri) ||
      (entry.parentUri !== undefined && names.has(entry.parentUri)),
  );
}

/** A refusal about the activation's answer, in a sentence of this reading. */
function notActivated(
  sentence: string,
  stillInactive: ReadonlyArray<IAdtStillInactive> = [],
): AdtActivationRefusal {
  return {
    form: 'activation',
    message: `Not activated: ${sentence}`,
    messages: [{ type: 'E', text: sentence }],
    stillInactive,
  };
}

/**
 * What `POST /activation` answered, judged (spec D1).
 *
 * Fixtures: `refusal-activation-fails` (200, `activationExecuted="false"` plus
 * a `msg` of type `E`), `activation-success-verdict` (200,
 * `activationExecuted="true"`, no messages), `activation-nothing-to-activate`
 * and `activation-group-alone-s4-2025` 04 (200, `activationExecuted="false"`,
 * no messages), `activation-preaudit-still-inactive-751` and
 * `activation-group-alone-s4-2025` 01 (200, `ioc:inactiveObjects`),
 * `activation-sync-activated-751` and `activation-class-basis-740` 01 (200,
 * empty).
 *
 * | Answer | Verdict |
 * |---|---|
 * | `chkl:messages`, `activationExecuted="true"`, no `E` | activated |
 * | `chkl:messages`, a `msg` of type `E` | refused, the messages explain it |
 * | `chkl:messages`, `activationExecuted="false"`, a message | refused, the messages explain it |
 * | `chkl:messages`, `activationExecuted="false"`, **no message** | judged by the inactive list read after it (below) |
 * | `chkl:messages`, no `activationExecuted` | refused, the messages explain it, or a sentence that the document says nothing |
 * | `ioc:inactiveObjects` | **not activated**, every object it lists |
 * | an empty body | **activated**, whatever `preauditRequested` was (decision Q1) |
 * | anything else, or a document that is not well-formed | **not activated**: the answer does not state the activation |
 *
 * **The silent checklist** (`activationExecuted="false"`, no message) answered
 * the re-activation of an object already active (ABAP cloud, S/4HANA 2025) and
 * an activation that left a function group inactive (S/4HANA 2025): the
 * document alone cannot tell them apart. The member that sent the activation
 * reads `GET /activation/inactiveobjects` once after it and hands the list as
 * `activation` (decision Q7): an object the activation named still listed (by
 * `uri` or `parentUri`, {@link stillInactiveAmong}) is not activated; none is
 * nothing to activate. Without the list, or with a list that cannot be read,
 * the outcome is not decided and is answered as not activated.
 *
 * **`ioc:inactiveObjects` is not "still running".** Measured on S/4HANA 2025:
 * the objects stayed inactive in two reads of the list ten seconds apart; on
 * 751 (fr0ster/mcp-abap-adt#351) the class stayed inactive until it was
 * activated with `preauditRequested=false`. Each listed object whose reference
 * carries a name is one `stillInactive` entry; a transport's reference is not
 * read.
 *
 * **The attribute is read as three states, not as a boolean.** Absent is not
 * `false`: a checklist that carries no `activationExecuted` — or no
 * `chkl:properties` — has told us nothing, and the silent row is measured for
 * SAP writing `false`, never for SAP writing nothing.
 */
export function readActivationRefusal(
  document: unknown,
  activation?: AdtActivationFacts,
): AdtActivationRefusal | null {
  if (
    document === undefined ||
    document === null ||
    (typeof document === 'string' && document.trim() === '')
  ) {
    return null;
  }
  const parsed = wellFormed(document);
  if (rootIs(parsed, 'inactiveObjects')) {
    return notActivated(
      'SAP answered the objects still inactive; nothing was activated',
      listedObjects(parsed) ?? [],
    );
  }
  if (!rootIs(parsed, 'messages')) {
    return notActivated('the answer does not state the activation');
  }
  const root = field(parsed, 'messages');

  const messages: AdtMessage[] = asArray(field(root, 'msg')).map((msg) => {
    const line = field(msg, '@line');
    const code = field(msg, '@code');
    return {
      type: severity(field(msg, '@type')),
      text:
        textOf(at(msg, 'shortText', 'txt')) ||
        textOf(field(msg, 'shortText')) ||
        textOf(field(msg, '@objDescr')) ||
        'activation message',
      line: line !== undefined ? String(line) : undefined,
      code: code !== undefined ? String(code) : undefined,
    };
  });

  const errors = messages.filter((m) => m.type.toUpperCase() === 'E');
  const executed = at(root, 'properties', '@activationExecuted');
  const activated = executed === 'true' || executed === true;
  const declaredNotActivated = executed === 'false' || executed === false;

  if (activated && errors.length === 0) return null;

  if (declaredNotActivated && messages.length === 0) {
    if (activation === undefined) {
      return notActivated(
        "SAP answered that no activation ran and gave no message; without the list of inactive objects the activation's outcome could not be decided",
      );
    }
    const still = stillInactiveAmong(
      activation.named,
      activation.inactiveObjects,
    );
    if (still === null) {
      return notActivated(
        "SAP answered that no activation ran and gave no message, and the inactive list could not be read; the activation's outcome could not be decided",
      );
    }
    if (still.length === 0) return null;
    return notActivated(
      `SAP answered that no activation ran, and the inactive list still names ${still.length} object(s) of the activation; nothing was activated`,
      still,
    );
  }

  const explanation = errors.length
    ? errors.map((m) => m.text).join('; ')
    : messages.length
      ? `Activation did not run and SAP attached no error: ${messages
          .map((m) => `${m.type}: ${m.text}`)
          .join('; ')}`
      : 'SAP answered an activation checklist carrying neither an activationExecuted verdict nor a message';

  return {
    form: 'activation',
    message: `Activation failed: ${explanation}`,
    // `messages` is documented as never empty. Every refusal built from a
    // document that said something carries what it said; the one that says
    // nothing at all — no verdict attribute, no message — carries the
    // sentence above, which is a statement about the document rather than an
    // invented verdict about the object.
    messages: messages.length ? messages : [{ type: 'E', text: explanation }],
    stillInactive: [],
  };
}

// ---------------------------------------------------------------------------
// Form 2b — deletion: two documents, two attributes
// ---------------------------------------------------------------------------

/**
 * `del:checkResponse` and `del:deletionResult`, the two halves of a delete.
 *
 * Fixtures: `refusal-delete-refused` steps 1 and 2 (`isDeletable="false"`, then
 * `isDeleted="false"`), and `delete-success` steps 1 and 2 (both `"true"`).
 *
 * **The presence of `del:message` is not the signal.** A successful delete
 * carries one too, with `del:type="S"` and an empty `del:text` — visible in
 * `delete-success--02`. The attribute is the verdict; the message explains it.
 *
 * **The two documents must not share a verdict attribute.** A check answers
 * `isDeletable`, a deletion `isDeleted`. A reader that looked for the first on
 * both — adt-clients shipped one, `deletionRefusal`, until it stopped shipping
 * readings — found no `isDeletable` in a `deletionResult` and reported every
 * successful delete as refused. This reader dispatches on the root element.
 *
 * **Every message counts, and every object.** Both repeat: one `del:object` per
 * object asked about, and one `del:message` per thing SAP had to say about it.
 * A message's severity is its own; the object is refused when its verdict
 * attribute is anything but `"true"`, or when any of its messages is an `E`.
 * The reference counts stand in only when SAP refused and said nothing.
 */
export function readDeletionRefusal(document: unknown): AdtRefusal | null {
  const parsed = parseXml(document);
  if (!parsed) return null;

  const isCheck = Boolean(parsed.checkResponse);
  const root = parsed.checkResponse ?? parsed.deletionResult;
  // **Several objects, not one.** `deleteObjectsGroup` and `checkDeletionGroup`
  // take a list, so the server answers one `del:object` per object asked
  // about — and the parser gives an array for two or more. Read as a single
  // object, every attribute came back `undefined`, the explicit "true" was
  // missing, and a successful group deletion of two objects read as a refusal.
  const objects = asArray(field(root, 'object'));
  if (objects.length === 0) return null;

  // Absent means "not stated", and a deletion the server never approved is not
  // one to assume: anything but an explicit "true" is a refusal.
  const verdictAttribute = isCheck ? '@isDeletable' : '@isDeleted';

  const refused: AdtMessage[] = [];
  const names: string[] = [];

  for (const object of objects) {
    const objectName = field(object, '@name');
    const name =
      typeof objectName === 'string' ? objectName : '(unnamed object)';

    // **Several messages, not one — the same trap one level down.** SAP sends
    // a `del:message` per thing it has to say, and a check for a service
    // binding that does not exist carries two: a `W` naming the missing object
    // and an `E` saying why that refuses it. Read as a single element, both
    // came back `undefined`, SAP's reason was replaced by the reference counts,
    // and an `E` on a permitted object was missed outright (issue #172). The
    // successful delete's `S` with an empty text is dropped by the text test,
    // which is what it always was: a message with nothing to say.
    const messages: AdtMessage[] = asArray(field(object, 'message'))
      .map((message): AdtMessage | null => {
        const text = textOf(field(message, 'text'));
        if (!text) return null;
        return {
          type: severity(field(message, '@type')),
          text: `${name}: ${text}`,
          t100: t100FromLongtext(field(message, 'link')),
        };
      })
      .filter((m): m is AdtMessage => m !== null);

    // Only an `E` SAP actually typed overturns an explicit "true". An untyped
    // message reads as `E` by default, which is right for explaining a refusal
    // and wrong for inventing one: a DDLS delete on premise (BASIS 816) answers
    // `isDeleted="true"` with `del:type=""` and the placeholder text `S::000`,
    // and the object is gone.
    const typedError = asArray(field(object, 'message')).some(
      (message) =>
        String(field(message, '@type') ?? '').trim() !== '' &&
        severity(field(message, '@type')) === 'E',
    );
    const permitted = field(object, verdictAttribute) === 'true';
    if (permitted && !typedError) continue;

    names.push(name);
    if (messages.length > 0) {
      refused.push(...messages);
      continue;
    }

    // SAP said no and gave no sentence. The reference counts are the only
    // reason the check document carries, so they stand in — and only then.
    const strong = field(object, '@externalStrongReferences');
    const weak = field(object, '@externalWeakReferences');
    const references =
      isCheck && (strong || weak)
        ? `${String(strong ?? 0)} strong and ${String(weak ?? 0)} weak external references`
        : undefined;
    refused.push({
      type: 'E',
      text: `${name}: ${references ?? 'the server did not say why'}`,
    });
  }

  // One object refused is a refusal, even where the rest were permitted: the
  // caller asked for all of them.
  if (refused.length === 0) return null;

  return {
    form: 'deletion',
    message: `ADT refuses to delete ${names.join(', ')}`,
    messages: refused,
  };
}

/**
 * The T100 key a deletion message carries, read from its long-text link.
 *
 * The deletion document has no `T100KEY-*` properties the way `exc:exception`
 * does, but the key is not missing: the link to the message's long text names
 * it — `/messageclass/SWB_TOOL/messages/029/longtext?language=E&msgv1=…` — and
 * the placeholders ride along as `msgv1`…`msgv4`. It is the one part of the
 * message that does not change with the logon language.
 */
function t100FromLongtext(link: unknown): AdtMessage['t100'] {
  for (const candidate of asArray(link)) {
    const href = field(candidate, '@href');
    if (typeof href !== 'string') continue;
    const key = /\/messageclass\/([^/]+)\/messages\/([^/?]+)/i.exec(href);
    if (!key) continue;
    const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
    const params = new URLSearchParams(query.replace(/&amp;/g, '&'));
    const values = [1, 2, 3, 4]
      .map((n) => params.get(`msgv${n}`))
      .filter((v): v is string => v !== null);
    return {
      id: decodeURIComponent(key[1]),
      no: decodeURIComponent(key[2]),
      values: values.length ? values : undefined,
    };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Form 3 — check runs: the status attribute, then the messages
// ---------------------------------------------------------------------------

/**
 * `chkrun:checkRunReports`, what `POST /checkruns` answers.
 *
 * Fixtures: `refusal-check-nonexistent-object` (200,
 * `status="notProcessed"`), `refusal-syntax-check` (200,
 * `status="processed"` plus a `checkMessage` of type `E`), and
 * `check-success-verdict` (200, `status="processed"`, no messages).
 *
 * **Two decisions out of one document, and the order matters.** A check that
 * never ran carries no message list at all, so a rule that only looks for a
 * message of type `E` calls a missing object a clean check. The status is read
 * first, and only a report that says `processed` is worth inspecting for
 * messages. This is the single form of the four where "a message of type E" is
 * the correct test, and it is only correct second.
 *
 * **The echo, and a debt.** The rule that a message of type `E` whose text
 * equals `statusText` is not an error came from a note in adt-clients, not from
 * anything measured here. Notes in that package describe the strategies IT
 * ships; ours are injected and are ours to establish. The rule is kept because
 * it can only ever suppress a message identical to the status line, which is
 * inert when the echo does not happen — but it is unverified, and the corpus
 * needs a capture of a check that produces one before it counts as measured.
 */
export function readCheckRunRefusal(document: unknown): AdtRefusal | null {
  const parsed = parseXml(document);
  // One `checkReport` per object checked. A run over several objects answers
  // several, and the parser gives an array — read as a single report, its
  // status came back `undefined` and two clean reports read as a check that
  // never ran. The same trap as `del:object` above; no capture of a
  // several-object run exists yet, so this is defensive rather than measured.
  const reports = asArray(
    at(parsed, 'checkRunReports', 'checkReport') ??
      field(parsed, 'checkReport'),
  );
  if (reports.length === 0) return null;

  const explanations: string[] = [];
  const messages: AdtMessage[] = [];

  for (const report of reports) {
    const status = String(field(report, '@status') ?? '');
    const statusText = String(field(report, '@statusText') ?? '');

    const reported: AdtMessage[] = asArray(
      at(report, 'checkMessageList', 'checkMessage'),
    ).map((msg) => {
      const code = field(msg, '@code');
      return {
        type: String(field(msg, '@type') ?? 'I'),
        text:
          textOf(field(msg, '@shortText')) ||
          textOf(field(msg, 'shortText')) ||
          'check message',
        code: code !== undefined ? String(code) : undefined,
      };
    });

    if (status !== 'processed') {
      // A check that never ran carries no message list at all: the reason sits
      // in an attribute and no severity is stated anywhere. One is supplied, so
      // this form reduces to {severity, text} like every other.
      const text =
        statusText || `Check did not run (status: ${status || 'unstated'})`;
      explanations.push(text);
      messages.push(
        ...(reported.length ? reported : [{ type: 'E', text, code: status }]),
      );
      continue;
    }

    const errors = reported.filter(
      (m) =>
        m.type.toUpperCase() === 'E' &&
        m.text.trim().toLowerCase() !== statusText.trim().toLowerCase(),
    );
    if (errors.length === 0) continue;
    explanations.push(errors.map((m) => m.text).join('; '));
    messages.push(...reported);
  }

  if (explanations.length === 0) return null;

  return {
    form: 'checkrun',
    message: explanations.join('; '),
    messages,
  };
}

// ---------------------------------------------------------------------------
// Form 5 — validation: is the NAME admissible. Not a check run.
// ---------------------------------------------------------------------------

/**
 * Name admissibility, and nothing else.
 *
 * **`validate` is not `check`, and the two must not be read into each other.**
 * Validation asks one narrow question: *is this name admissible for an object
 * of this type in this package* — in practice, is it free and well-formed. It
 * never looks at source, and it says nothing about whether the object would be
 * correct. That is `check`'s job, at `POST /checkruns`, which is form 3 above
 * and a different document entirely.
 *
 * The endpoints say so themselves: `.../validation/objectname`, answering
 * `com.sap.adt.oo.clifname.check` and `com.sap.adt.wb.objname.check` — *name*
 * checks. An element called `CHECK_RESULT` lives in this document and belongs
 * to validation, not to a check run; the word is what made this easy to confuse
 * and is exactly why it is written down here.
 *
 * Measured on an ABAP Cloud system, ours rather than taken from anyone's notes, and
 * every row has a fixture:
 *
 * | family | name taken | name free |
 * |---|---|---|
 * | class | **400** `exc:exception` `InvalidClifName` | 200 `CHECK_RESULT` `X` |
 * | domain | **400** `exc:exception` `InvalidObjName` | 200 `CHECK_RESULT` `X` |
 * | table | **400** `exc:exception` `InvalidObjName` | 200 `CHECK_RESULT` `X` |
 * | DDL | **200** `SEVERITY` `ERROR` + `SHORT_TEXT` | 200 `SEVERITY` `OK` |
 * | function group | **200** `SEVERITY` `ERROR` + `SHORT_TEXT` | — |
 *
 * Three families refuse with the HTTP status and are already form 1; two answer
 * 200 with the refusal in the body. This reading covers the second kind. The
 * only refusal reason observed is "already exists", which is what a question
 * about a name can answer.
 *
 * **The discriminator is the value of `SEVERITY`, not its presence.** A free
 * DDL name answers `<SEVERITY>OK</SEVERITY>` with an empty `SHORT_TEXT`, so a
 * rule that fired on the element being there would refuse every admissible
 * name. Only `OK` and `ERROR` have been seen; anything else is treated as a
 * refusal, because a verdict this reading does not recognise is not one it may
 * report as permission to create.
 */
export function readValidationRefusal(document: unknown): AdtRefusal | null {
  const data = at(parseXml(document), 'abap', 'values', 'DATA');
  if (!isElement(data)) return null;

  // The admissible-name answer. Present means "yes"; there is nothing to refuse.
  if (data.CHECK_RESULT !== undefined) return null;

  const rawSeverity = textOf(data.SEVERITY).toUpperCase();
  if (!rawSeverity || rawSeverity === 'OK') return null;

  const shortText = textOf(data.SHORT_TEXT);
  const longText = textOf(data.LONG_TEXT);

  return {
    form: 'validation',
    message: shortText || longText || `Validation answered ${rawSeverity}`,
    messages: [{ type: severity(rawSeverity), text: shortText || longText }],
  };
}

// ---------------------------------------------------------------------------
// Form 5b — the same `asx:abap` severity envelope, answering other questions
// ---------------------------------------------------------------------------

/** `SEVERITY`, `SHORT_TEXT` and `LONG_TEXT` out of an `asx:abap` document. */
function severityEnvelope(
  document: unknown,
): { severity: string; shortText: string; longText: string } | null {
  const data = at(parseXml(document), 'abap', 'values', 'DATA');
  if (!isElement(data)) return null;
  return {
    severity: textOf(data.SEVERITY).toUpperCase(),
    shortText: textOf(data.SHORT_TEXT),
    longText: textOf(data.LONG_TEXT),
  };
}

/**
 * A service binding's publication answer: the job's `SEVERITY`.
 *
 * Measured by adt-clients (2026-09-05): the POST takes ~130 s of server time
 * and answers `<SEVERITY>OK</SEVERITY>` with a `SHORT_TEXT` such as "ZAC_SRVB01
 * published locally". A body with no `SEVERITY` is not a refusal — silence is
 * not a "no" — and only a severity other than `OK` is one. Moved from
 * adt-clients' `publicationRefusal`, which applied it by default.
 */
export function readPublicationRefusal(document: unknown): AdtRefusal | null {
  const found = severityEnvelope(document);
  if (!found?.severity || found.severity === 'OK') return null;
  const message =
    `Publication ${found.severity}: ${found.shortText || 'the server gave no short text'}` +
    (found.longText ? ` — ${found.longText}` : '');
  return {
    form: 'publication',
    message,
    messages: [{ type: severity(found.severity), text: message }],
  };
}

/**
 * Whether a CDS view can be tested with test doubles.
 *
 * The check reports its verdict inside a 200 as `SEVERITY`, with the reason in
 * `SHORT_TEXT` or `LONG_TEXT`. Anything but `OK` — including no severity at
 * all — means the view cannot be tested with doubles. Moved from adt-clients'
 * `testDoublesVerdict`, which was hard-wired into the member.
 */
export function readCdsTestDoublesRefusal(
  document: unknown,
): AdtRefusal | null {
  const found = severityEnvelope(document);
  if (found?.severity === 'OK') return null;
  const message =
    found?.shortText ||
    found?.longText ||
    `CDS test doubles check failed with severity: ${found?.severity || '(none)'}`;
  return {
    form: 'cdsTestDoubles',
    message,
    messages: [{ type: 'E', text: message }],
  };
}

/**
 * A message class document that does not hold the message asked for, or an
 * answer that is no message class document at all (empty, not XML, another
 * document): neither shows the message exists.
 *
 * A message is a row inside its class, so reading one reads the class; the
 * class answering is not the message existing. Moved from adt-clients'
 * `AdtMessageClassMessage.read`, which applied it by default.
 */
export function readMessageClassMessageAbsence(
  document: unknown,
  msgno: string,
): AdtRefusal | null {
  const root = field(parseXml(document), 'messageClass');
  // The class answering is what shows the message exists: an answer that is
  // not a class document shows nothing, so it is refused too.
  if (!root) {
    const message = `Message ${msgno}: the answer is not a message class document`;
    return {
      form: 'messageClass',
      code: AdtObjectErrorCodes.OBJECT_NOT_FOUND,
      message,
      messages: [{ type: 'E', text: message }],
    };
  }
  const held = asArray(field(root, 'messages')).some(
    (m) => String(field(m, '@msgno') ?? '') === msgno,
  );
  if (held) return null;
  const className = field(root, '@name');
  const name = typeof className === 'string' ? className : '';
  const message = `Message ${msgno} not found in class ${name}`.trim();
  return {
    form: 'messageClass',
    code: AdtObjectErrorCodes.OBJECT_NOT_FOUND,
    message,
    messages: [{ type: 'E', text: message }],
  };
}

/**
 * An answer that is no object properties document.
 *
 * `GET /repository/informationsystem/objectproperties/values?uri=` answers an
 * `opr:objectProperties` document holding the object as `opr:object` (measured
 * on premise, SAP_BASIS 816: a transaction by its workbench uri). An answer
 * that is not such a document — empty, not XML, another document such as a
 * sign-in page — shows no object, so it is refused.
 */
export function readObjectPropertiesAbsence(
  document: unknown,
): AdtRefusal | null {
  // Well-formed, one root: a truncated or concatenated answer is no document,
  // whatever the parser makes of it.
  const wellFormed =
    typeof document === 'string' && XMLValidator.validate(document) === true;
  const root = wellFormed
    ? field(parseXml(document), 'objectProperties')
    : undefined;
  if (root && field(root, 'object')) return null;
  const message = 'The answer is not an object properties document';
  return {
    form: 'objectProperties',
    code: AdtObjectErrorCodes.OBJECT_NOT_FOUND,
    message,
    messages: [{ type: 'E', text: message }],
  };
}

// ---------------------------------------------------------------------------
// Form 6 — a unit test run: alerts on the method that failed
// ---------------------------------------------------------------------------

/**
 * `aunit:runResult`, what `GET /abapunit/results/<id>` answers.
 *
 * A run is three exchanges and only the third says anything about the outcome:
 *
 * 1. `POST /abapunit/runs` answers **201 with a zero-byte body**. The run id is
 *    in the `Location` header, and nowhere else. This is why a result strategy
 *    is handed the whole answer rather than the body — here the body is empty
 *    and the answer is a header.
 * 2. `GET /abapunit/runs/<id>` answers `aunit:run` with
 *    `aunit:progress status="FINISHED"`. **It is byte-identical for a run that
 *    passed and one that failed** — it reports progress, not verdict. Reading
 *    pass/fail from it would call every completed run a success.
 * 3. `GET /abapunit/results/<id>` answers this document.
 *
 * A method that passed is a bare `testMethod`. A method that failed carries
 * `alerts`, and the alert is the same pair as everywhere else: a severity and a
 * sentence. ABAP Unit grades on its own scale — `critical`, `fatal`,
 * `tolerable` — which `severity` maps onto the usual letters.
 *
 * Fixtures: `unittest-run-passing` and `refusal-unittest-run-failing`.
 */
export function readUnitTestRefusal(document: unknown): AdtRefusal | null {
  const root = field(parseXml(document), 'runResult');
  if (!root) return null;

  const messages: AdtMessage[] = [];
  for (const program of asArray(field(root, 'program'))) {
    for (const testClass of asArray(at(program, 'testClasses', 'testClass'))) {
      for (const method of asArray(
        at(testClass, 'testMethods', 'testMethod'),
      )) {
        const uri = field(method, '@uri');
        for (const alert of asArray(at(method, 'alerts', 'alert'))) {
          const details = asArray(at(alert, 'details', 'detail'))
            .map((d) => textOf(field(d, '@text')))
            .filter(Boolean);
          messages.push({
            type: severity(field(alert, '@severity')),
            text:
              textOf(field(alert, 'title')) || details[0] || 'unit test alert',
            code: textOf(field(alert, '@kind')) || undefined,
            uri: typeof uri === 'string' ? uri : undefined,
          });
        }
      }
    }
  }

  const failures = messages.filter((m) => m.type === 'E');
  if (failures.length === 0) return null;

  return {
    form: 'unittest',
    message: failures.map((m) => m.text).join('; '),
    messages,
  };
}

// ---------------------------------------------------------------------------
// Form 4 — the one no reading can decide
// ---------------------------------------------------------------------------

/**
 * The package walkers answer an empty body, and it means two different things.
 *
 * Fixtures: `refusal-package-not-found-contents-empty`,
 * `-objectslist-empty` and `-hierarchy-direct` — a package that does not exist —
 * against `read-empty-package-contents`, a package that exists and holds
 * nothing. HTTP 200, no content-type, zero bytes, **the same sha256**. Only the
 * request differs.
 *
 * So there is no strategy to choose here, and writing one would be inventing a
 * signal. A handler that has not asked whether the package exists cannot report
 * "empty", and `GetPackageTree` is the one that already pays that round trip.
 *
 * This function exists so that the absence is stated in code rather than left
 * as a gap: it says the answer is indeterminate, and a caller that has done the
 * pre-check may disregard it.
 */
export function isIndeterminateWalkAnswer(document: unknown): boolean {
  if (document === undefined || document === null) return true;
  // Whitespace counts, and the reason is that two pieces of code in this
  // repository disagreed about it: `scripts/lib/packageWalk.ts` trims before
  // testing, this did not. Measured, the server answers zero bytes — so the
  // whitespace case is defensive rather than observed, and the two should at
  // least be defensive the same way.
  return typeof document === 'string' && document.trim() === '';
}

// ---------------------------------------------------------------------------
// One entry point
// ---------------------------------------------------------------------------

/**
 * Read whichever of the four forms this document is.
 *
 * Dispatches on the root element, so a reader is never handed a document it was
 * not written for — the failure mode that makes `deletionRefusal` report every
 * successful delete as refused when it meets a `deletionResult`.
 *
 * `activation` is the facts an activation member read beside its answer, handed
 * to the activation reading for a checklist.
 *
 * Returns `null` for a document that is not a refusal **and** for one that is
 * none of the four forms. Those two are not the same thing, and a caller that
 * needs to tell them apart should call the specific reader.
 */
export function readAdtRefusal(
  document: unknown,
  activation?: AdtActivationFacts,
): AdtRefusal | null {
  return (
    readExceptionRefusal(document) ??
    // Only a checklist: what else an activation may answer (an inactive-objects
    // list, nothing, another document) is judged as an activation's answer by
    // the activation reading alone — here it is no form this dispatches.
    (rootIs(wellFormed(document), 'messages')
      ? readActivationRefusal(document, activation)
      : null) ??
    readDeletionRefusal(document) ??
    readCheckRunRefusal(document) ??
    readValidationRefusal(document) ??
    readUnitTestRefusal(document)
  );
}
