import { XMLParser } from 'fast-xml-parser';

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
    | 'unittest';
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** One child vs many children — the trap that broke the transport tree in #168. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Text of a node that may be a bare string or an element with attributes.
 *
 * `<message lang="EN">text</message>` parses to an object once `lang` is kept,
 * and to a string when it has no attributes. Both spellings occur.
 */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  if (node && typeof node === 'object') {
    const text = (node as Record<string, unknown>)['#text'];
    if (typeof text === 'string') return text.trim();
    if (typeof text === 'number') return String(text);
  }
  return '';
}

function parseXml(document: unknown): Record<string, any> | null {
  if (typeof document !== 'string' || document.trim() === '') return null;
  try {
    const parsed = parser.parse(document);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Form 1 — the HTTP status carries it, the document explains it
// ---------------------------------------------------------------------------

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
  const root = parseXml(document)?.exception;
  if (!root) return null;

  const properties = new Map<string, string>();
  for (const entry of asArray(root.properties?.entry)) {
    const key = entry?.['@key'];
    if (typeof key === 'string') properties.set(key, textOf(entry));
  }

  const id = properties.get('T100KEY-ID');
  const no = properties.get('T100KEY-NO');
  const values = [...properties.entries()]
    .filter(([key]) => /^T100KEY-V\d+$/.test(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
  const text =
    textOf(root.message) ||
    textOf(root.localizedMessage) ||
    'ADT refused the request';
  const adtType =
    typeof root.type?.['@id'] === 'string' ? root.type['@id'] : undefined;

  return {
    form: 'exception',
    message: text,
    adtType,
    namespace:
      typeof root.namespace?.['@id'] === 'string'
        ? root.namespace['@id']
        : undefined,
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
// Form 2a — activation: a boolean attribute, under HTTP 200
// ---------------------------------------------------------------------------

/**
 * `chkl:messages`, what `POST /activation` answers.
 *
 * Fixtures: `refusal-activation-fails` (200, `activationExecuted="false"` plus
 * a `msg` of type `E`), `activation-success-verdict` (200,
 * `activationExecuted="true"`, no messages) and
 * `activation-nothing-to-activate` (200, `activationExecuted="false"`,
 * `generationExecuted="true"`, no messages).
 *
 * **Two signals, and the second one only counts with a message beside it.**
 * `activationExecuted` says whether ADT did any work; the messages say whether
 * the work succeeded. So:
 *
 * | `activationExecuted` | `msg` | verdict |
 * |---|---|---|
 * | `"true"`  | none, or none of type `E` | activated |
 * | `"true"`  | a type `E` | refused, the messages explain it |
 * | `"false"` | any | refused, the messages explain it |
 * | `"false"` | **none** | **nothing needed activating** |
 * | absent | any | refused, the messages explain it |
 * | absent | none | refused: the document says nothing at all |
 *
 * **The attribute is read as three states, not as a boolean.** Absent is not
 * `false`: a checklist that carries no `activationExecuted` — or no
 * `chkl:properties` — has told us nothing, and the no-op row below is
 * measured for SAP writing `false`, never for SAP writing nothing. The last
 * row is the only place this reading composes a sentence instead of quoting
 * one, and what it composes is a statement about the document rather than a
 * verdict about the object.
 *
 * **The last row is measured, and it used to be read as a refusal.** An
 * earlier version of this function took the attribute as a refusal on its own,
 * "whether or not SAP explained itself". That is one reading too many, and it
 * made every no-op activation answer an error. Measured on a trial system
 * (2026-09-16), three ways, all answering the identical document:
 *
 * - activating a class a second time, straight after an activation that
 *   answered `activationExecuted="true"` — captured as the third fixture above;
 * - activating a function group straight after creating one, because a
 *   function group is created active: `adtcore:version="active"` stands on its
 *   metadata before any activation is asked for;
 * - both of those through a consumer's tools, which is how it surfaced.
 *
 * The reading that the request was accepted and is still running is ruled out
 * by the contrast: when SAP does have work, it answers
 * `activationExecuted="true"` in the same request rather than deferring behind
 * a 200. This library's own `activationUtils.ts` recorded the same finding
 * from its own probe before the strategies moved here — "class already active |
 * 200 | false | none" — and concluded that only an `E` message is a failure
 * signal.
 *
 * The hole the old reading was guarding against is real but narrower than it
 * was drawn: an activation SAP declines **and says nothing about** is
 * indistinguishable, in this document, from one it had no work for. Between
 * answering "failed" for every already-active object and "fine" for a silent
 * decline nobody has ever observed, this takes the measured case.
 */
export function readActivationRefusal(document: unknown): AdtRefusal | null {
  const root = parseXml(document)?.messages;
  if (!root) return null;

  const messages: AdtMessage[] = asArray(root.msg).map((msg: any) => ({
    type: severity(msg?.['@type']),
    text:
      textOf(msg?.shortText?.txt) ||
      textOf(msg?.shortText) ||
      textOf(msg?.['@objDescr']) ||
      'activation message',
    line: msg?.['@line'] !== undefined ? String(msg['@line']) : undefined,
    code: msg?.['@code'] !== undefined ? String(msg['@code']) : undefined,
  }));

  const errors = messages.filter((m) => m.type.toUpperCase() === 'E');
  const executed = root.properties?.['@activationExecuted'];
  const activated = executed === 'true' || executed === true;

  // Read as the three states it has, not as a boolean. `!activated` is also
  // true for a document that carries no `activationExecuted` at all — or no
  // `chkl:properties` — and the measurement below is of SAP writing `false`,
  // not of SAP writing nothing. Collapsing the two would hand an unreadable
  // answer the verdict earned by a measured one.
  const declaredNotActivated = executed === 'false' || executed === false;

  if (activated && errors.length === 0) return null;

  // Declared not activated, and nothing said about it: SAP had no work. See
  // the table above — the one row the attribute alone decides, and it decides
  // it in the object's favour.
  if (declaredNotActivated && messages.length === 0) return null;

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
  const objects = asArray(root?.object);
  if (objects.length === 0) return null;

  // Absent means "not stated", and a deletion the server never approved is not
  // one to assume: anything but an explicit "true" is a refusal.
  const verdictAttribute = isCheck ? '@isDeletable' : '@isDeleted';

  const refused: AdtMessage[] = [];
  const names: string[] = [];

  for (const object of objects) {
    const name =
      typeof object?.['@name'] === 'string'
        ? object['@name']
        : '(unnamed object)';

    // **Several messages, not one — the same trap one level down.** SAP sends
    // a `del:message` per thing it has to say, and a check for a service
    // binding that does not exist carries two: a `W` naming the missing object
    // and an `E` saying why that refuses it. Read as a single element, both
    // came back `undefined`, SAP's reason was replaced by the reference counts,
    // and an `E` on a permitted object was missed outright (issue #172). The
    // successful delete's `S` with an empty text is dropped by the text test,
    // which is what it always was: a message with nothing to say.
    const messages: AdtMessage[] = asArray(object?.message)
      .map((message: any): AdtMessage | null => {
        const text = textOf(message?.text);
        if (!text) return null;
        return {
          type: severity(message?.['@type']),
          text: `${name}: ${text}`,
          t100: t100FromLongtext(message?.link),
        };
      })
      .filter((m): m is AdtMessage => m !== null);

    const permitted = object?.[verdictAttribute] === 'true';
    if (permitted && !messages.some((m) => m.type === 'E')) continue;

    names.push(name);
    if (messages.length > 0) {
      refused.push(...messages);
      continue;
    }

    // SAP said no and gave no sentence. The reference counts are the only
    // reason the check document carries, so they stand in — and only then.
    const references =
      isCheck &&
      (object?.['@externalStrongReferences'] ||
        object?.['@externalWeakReferences'])
        ? `${object['@externalStrongReferences'] ?? 0} strong and ${object['@externalWeakReferences'] ?? 0} weak external references`
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
  for (const candidate of asArray(link as any)) {
    const href = candidate?.['@href'];
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
    parsed?.checkRunReports?.checkReport ?? parsed?.checkReport,
  );
  if (reports.length === 0) return null;

  const explanations: string[] = [];
  const messages: AdtMessage[] = [];

  for (const report of reports) {
    const status = String(report?.['@status'] ?? '');
    const statusText = String(report?.['@statusText'] ?? '');

    const reported: AdtMessage[] = asArray(
      report?.checkMessageList?.checkMessage,
    ).map((msg: any) => ({
      type: String(msg?.['@type'] ?? 'I'),
      text:
        textOf(msg?.['@shortText']) ||
        textOf(msg?.shortText) ||
        'check message',
      code: msg?.['@code'] !== undefined ? String(msg['@code']) : undefined,
    }));

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
 * Measured on the trial system, ours rather than taken from anyone's notes, and
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
  const data = parseXml(document)?.abap?.values?.DATA;
  if (!data || typeof data !== 'object') return null;

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
  const root = parseXml(document)?.runResult;
  if (!root) return null;

  const messages: AdtMessage[] = [];
  for (const program of asArray(root.program)) {
    for (const testClass of asArray(program?.testClasses?.testClass)) {
      for (const method of asArray(testClass?.testMethods?.testMethod)) {
        for (const alert of asArray(method?.alerts?.alert)) {
          const details = asArray(alert?.details?.detail)
            .map((d: any) => textOf(d?.['@text']))
            .filter(Boolean);
          messages.push({
            type: severity(alert?.['@severity']),
            text: textOf(alert?.title) || details[0] || 'unit test alert',
            code: textOf(alert?.['@kind']) || undefined,
            uri:
              typeof method?.['@uri'] === 'string' ? method['@uri'] : undefined,
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
 * Returns `null` for a document that is not a refusal **and** for one that is
 * none of the four forms. Those two are not the same thing, and a caller that
 * needs to tell them apart should call the specific reader.
 */
export function readAdtRefusal(document: unknown): AdtRefusal | null {
  return (
    readExceptionRefusal(document) ??
    readActivationRefusal(document) ??
    readDeletionRefusal(document) ??
    readCheckRunRefusal(document) ??
    readValidationRefusal(document) ??
    readUnitTestRefusal(document)
  );
}
