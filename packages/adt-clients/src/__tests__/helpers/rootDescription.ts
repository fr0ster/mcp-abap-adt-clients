/**
 * The root element's `adtcore:description` of an ADT document, read and set
 * through the library's own document patching.
 *
 * The metadata-update step of the integration flow writes back the document it
 * read with this one value changed. The server gets the document byte for byte
 * as it was read, apart from that value: the root is found by the shipped
 * scanner, and the attribute is set on the root alone — a nested element's
 * `adtcore:description` (a package reference's) is somebody else's value. A
 * root that carries none gets it added, as the shipped patches do: SAP's
 * read-back of a fresh object (a transformation on onprem, among others)
 * carries no description on its root though the create sent one.
 */
import { patchDocument } from '../../core/shared/documentPatch';
import { scanDocument } from '../../utils/documentEdit';

const ATTRIBUTE = 'adtcore:description';

/** The root element's `adtcore:description`, or `undefined` when it has none. */
export function readRootDescription(document: string): string | undefined {
  const root = scanDocument(document);
  const found = root?.attributes.find(
    (attribute) => attribute.name === ATTRIBUTE,
  );
  return found === undefined
    ? undefined
    : document.slice(found.value.start, found.value.end);
}

/**
 * `document` with the root element's `adtcore:description` set to `value` —
 * replaced where the root carries one, added to its start tag where it does
 * not — every other byte as it was. A document that is not XML throws,
 * naming `what`.
 */
export function replaceRootDescription(
  document: string,
  value: string,
  what: string,
): string {
  const root = scanDocument(document);
  if (root === undefined) {
    throw new Error(
      `${what}: the metadata document is not a well-formed XML document, so its root has no description to set.`,
    );
  }
  const patched = patchDocument(document, root.name, [
    {
      field: 'description',
      path: [],
      kind: 'attribute',
      name: ATTRIBUTE,
      value,
    },
  ]);
  if (!patched.ok) {
    throw new Error(
      `${what}: the root's description could not be set (${patched.refusal.kind}).`,
    );
  }
  return patched.document;
}
