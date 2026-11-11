/**
 * What every shipped document patch answers, and the one place it is applied.
 *
 * A patch (`patch<Type>Document(document, changes)`) takes the metadata
 * document a caller read and the fields the caller changes, and returns that
 * document with exactly those changes. It sends no request and keeps nothing
 * between calls; the caller reads, patches and writes in three calls.
 *
 * Its refusals are returned, never thrown: the cause is SAP's document, and a
 * failure SAP's answer causes is the caller's to read (decision 15). A patch
 * is all or nothing — one refusal and no document comes back, so nothing half
 * patched can be written.
 */
import {
  applySplices,
  childAt,
  type ElementLocation,
  type Splice,
  scanDocument,
} from '../../utils/documentEdit';
import { escapeXmlAttr, escapeXmlText } from '../../utils/xml';

/** Why a patch returned no document. */
export type DocumentPatchRefusal<F extends string> =
  /** Empty, blank, not XML, or not well-formed (a read cut short). */
  | { readonly kind: 'not-a-document' }
  /** The root is another element: another type's document. */
  | { readonly kind: 'not-this-type'; readonly root: string }
  /** A changed field's element is not where SAP writes it. */
  | {
      readonly kind: 'element-missing';
      readonly field: F;
      readonly path: string;
    };

/** The patched document, or why there is none. */
export type DocumentPatch<F extends string> =
  | { readonly ok: true; readonly document: string }
  | { readonly ok: false; readonly refusal: DocumentPatchRefusal<F> };

/**
 * One change, located by its path from the root (each step a direct child;
 * `[]` is the root itself).
 */
export type DocumentEdit<F extends string> = {
  readonly field: F;
  readonly path: readonly string[];
} & (
  | /** An attribute set on the element, appended to its start tag when absent. */
  { readonly kind: 'attribute'; readonly name: string; readonly value: string }
  /** The element's text, escaped; `''` writes `<x/>`. */
  | { readonly kind: 'text'; readonly value: string }
  /** The element's content as XML the patch built; `''` writes `<x/>`. */
  | { readonly kind: 'content'; readonly xml: string }
  /** The element's attributes replaced by a single `adtcore:name`. */
  | { readonly kind: 'reference'; readonly name: string }
);

/** `n` in SAP's fixed-width form: `000010`. */
export function digits(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * The edits of one patch, collected in the order the changes type declares
 * its fields; a value left `undefined` adds nothing.
 */
export class DocumentEdits<F extends string> {
  readonly list: DocumentEdit<F>[] = [];

  /** An attribute of the element at `path` (`[]`: the root). */
  attribute(
    field: F,
    path: readonly string[],
    name: string,
    value: string | undefined,
  ): this {
    if (value !== undefined) {
      this.list.push({ field, path, kind: 'attribute', name, value });
    }
    return this;
  }

  /** The element's text. */
  text(field: F, path: readonly string[], value: string | undefined): this {
    if (value !== undefined) {
      this.list.push({ field, path, kind: 'text', value });
    }
    return this;
  }

  /** A number in SAP's fixed width. */
  digits(
    field: F,
    path: readonly string[],
    value: number | undefined,
    width: number,
  ): this {
    return this.text(
      field,
      path,
      value === undefined ? undefined : digits(value, width),
    );
  }

  /** A flag as SAP writes it: `true` / `false`. */
  flag(field: F, path: readonly string[], value: boolean | undefined): this {
    return this.text(
      field,
      path,
      value === undefined ? undefined : String(value),
    );
  }

  /** A reference to another object, changed by its name alone. */
  reference(field: F, path: readonly string[], name: string | undefined): this {
    if (name !== undefined) {
      this.list.push({ field, path, kind: 'reference', name });
    }
    return this;
  }

  /** The element's content as XML the patch built. */
  content(field: F, path: readonly string[], xml: string | undefined): this {
    if (xml !== undefined) {
      this.list.push({ field, path, kind: 'content', xml });
    }
    return this;
  }
}

/** The element's content replaced, in SAP's form for an empty one. */
function contentSplice(element: ElementLocation, xml: string): Splice[] {
  const selfClosing = element.content === undefined;
  if (xml === '') {
    return selfClosing
      ? []
      : [{ start: element.tagClose.start, end: element.end, text: '/>' }];
  }
  if (element.content === undefined) {
    return [
      {
        ...element.tagClose,
        text: `>${xml}</${element.name}>`,
      },
    ];
  }
  return [{ ...element.content, text: xml }];
}

function splicesFor<F extends string>(
  element: ElementLocation,
  edit: DocumentEdit<F>,
): Splice[] {
  switch (edit.kind) {
    case 'attribute': {
      const found = element.attributes.find(
        (attribute) => attribute.name === edit.name,
      );
      if (found !== undefined) {
        return [{ ...found.value, text: escapeXmlAttr(edit.value) }];
      }
      const at = element.tagClose.start;
      return [
        {
          start: at,
          end: at,
          text: ` ${edit.name}="${escapeXmlAttr(edit.value)}"`,
        },
      ];
    }
    case 'text':
      return contentSplice(element, escapeXmlText(edit.value));
    case 'content':
      return contentSplice(element, edit.xml);
    case 'reference':
      return [
        {
          start: element.nameEnd,
          end: element.tagClose.start,
          text: ` adtcore:name="${escapeXmlAttr(edit.name)}"`,
        },
      ];
  }
}

/**
 * Apply `edits` to `document`, whose root must be `root`. The edits come in
 * the order of the changes type's declaration, so the first missing one is
 * the one named.
 */
export function patchDocument<F extends string>(
  document: string,
  root: string,
  edits: readonly DocumentEdit<F>[],
): DocumentPatch<F> {
  const scanned = scanDocument(document);
  if (scanned === undefined) {
    return { ok: false, refusal: { kind: 'not-a-document' } };
  }
  if (scanned.name !== root) {
    return {
      ok: false,
      refusal: { kind: 'not-this-type', root: scanned.name },
    };
  }
  const splices: Splice[] = [];
  for (const edit of edits) {
    const element = childAt(scanned, edit.path);
    if (element === undefined) {
      return {
        ok: false,
        refusal: {
          kind: 'element-missing',
          field: edit.field,
          path: [root, ...edit.path].join('/'),
        },
      };
    }
    splices.push(...splicesFor(element, edit));
  }
  return { ok: true, document: applySplices(document, splices) };
}
