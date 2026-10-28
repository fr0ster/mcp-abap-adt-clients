/**
 * How a recorded XML body is kept in `corpus/adt/`: one element per line,
 * indented two spaces.
 *
 * Nothing is parsed or re-serialised. The text is split into markup and
 * text; whitespace standing alone between two tags is replaced by a line
 * break and indentation, and nothing else changes: every tag is kept as it
 * was written (`<x></x>` and `<x/>` alike), every attribute, entity and text
 * node as ADT sent it, and an element whose whole content is whitespace
 * (`<VALUE>       </VALUE>`, a value of spaces) keeps it. Formatting a
 * formatted body changes nothing.
 */

type Token = { kind: 'tag' | 'text'; value: string };

/** Markup and text, in order: a comment, a CDATA section, a declaration and a tag are one token each. */
function tokens(text: string): Token[] {
  const out: Token[] = [];
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('<', at);
    if (open < 0) {
      out.push({ kind: 'text', value: text.slice(at) });
      break;
    }
    if (open > at) out.push({ kind: 'text', value: text.slice(at, open) });
    const end = text.startsWith('<!--', open)
      ? text.indexOf('-->', open) + 3
      : text.startsWith('<![CDATA[', open)
        ? text.indexOf(']]>', open) + 3
        : text.indexOf('>', open) + 1;
    if (end <= open) {
      out.push({ kind: 'text', value: text.slice(open) });
      break;
    }
    out.push({ kind: 'tag', value: text.slice(open, end) });
    at = end;
  }
  return out;
}

const isClosing = (tag: string): boolean => tag.startsWith('</');
const isOpening = (tag: string): boolean =>
  !isClosing(tag) && !tag.endsWith('/>') && !/^<[?!]/.test(tag);
const isBlank = (value: string): boolean => value.trim() === '';

export function formatCorpusXml(text: string): string {
  const all = tokens(text);
  let out = '';
  let depth = 0;
  for (let i = 0; i < all.length; i += 1) {
    const token = all[i] as Token;
    if (token.kind === 'text') {
      const before = all[i - 1];
      const after = all[i + 1];
      const betweenTags = before?.kind === 'tag' && after?.kind === 'tag';
      // Whitespace alone between two tags is layout, unless it is the whole
      // content of an element (an opening tag, then its closing one).
      const leafContent =
        betweenTags &&
        isOpening(before.value) &&
        isClosing(after.value);
      if (isBlank(token.value) && (betweenTags || i === 0 || !after) && !leafContent) {
        continue;
      }
      out += token.value;
      continue;
    }
    const previous = all[i - 1];
    const previousKept =
      previous?.kind === 'text' &&
      !(isBlank(previous.value) && !(all[i - 2]?.kind === 'tag' && isOpening((all[i - 2] as Token).value) && isClosing(token.value)));
    const closesLeaf =
      isClosing(token.value) &&
      (previousKept ||
        (previous?.kind === 'tag' && isOpening(previous.value)));
    if (isClosing(token.value)) depth -= 1;
    if (out !== '' && !previousKept && !closesLeaf) {
      out += `\n${'  '.repeat(Math.max(depth, 0))}`;
    }
    out += token.value;
    if (isOpening(token.value)) depth += 1;
  }
  return `${out.trim()}\n`;
}
