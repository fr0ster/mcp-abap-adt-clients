/**
 * What a metadata document SAP sent back holds at a path from its root — for
 * a live test asserting what SAP stored after a patch was written.
 *
 * Read with the same scanner the patches write with, so a test reads exactly
 * the element the patch wrote, never another of the same name.
 */
import { childAt, scanDocument } from '../../utils/documentEdit';

export interface IElementRead {
  /** The raw content between the tags; `''` for `<x/>`. */
  readonly content: string;
  /** Each attribute's raw value, by its qualified name. */
  readonly attributes: Readonly<Record<string, string>>;
  /** The names of the direct children, in order. */
  readonly children: readonly string[];
}

/** The element at `path` below the root (`[]`: the root), or `undefined`. */
export function documentAt(
  document: string,
  path: readonly string[],
): IElementRead | undefined {
  const root = scanDocument(document);
  if (root === undefined) return undefined;
  const element = childAt(root, path);
  if (element === undefined) return undefined;
  const attributes: Record<string, string> = {};
  for (const attribute of element.attributes) {
    attributes[attribute.name] = document.slice(
      attribute.value.start,
      attribute.value.end,
    );
  }
  return {
    content:
      element.content === undefined
        ? ''
        : document.slice(element.content.start, element.content.end),
    attributes,
    children: element.children.map((child) => child.name),
  };
}

/** The element's content, or a test failure naming the missing path. */
export function contentAt(document: string, path: readonly string[]): string {
  const found = documentAt(document, path);
  if (found === undefined) {
    throw new Error(`the read-back holds no ${path.join('/') || 'root'}`);
  }
  return found.content;
}

/** One attribute of the element at `path`, `undefined` when it has none. */
export function attributeAt(
  document: string,
  path: readonly string[],
  name: string,
): string | undefined {
  return documentAt(document, path)?.attributes[name];
}
