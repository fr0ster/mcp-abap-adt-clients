/**
 * How a recorded XML body is kept in `corpus/adt/`: one element per line,
 * indented two spaces.
 *
 * Nothing is parsed or re-serialised. The text is split into markup and
 * text; whitespace standing alone between two tags of an element that holds
 * only elements is replaced by a line break and indentation, and nothing else
 * changes: an element holding text or CDATA beside its children keeps its
 * whole content as it came, and every tag is kept as it
 * was written (`<x></x>` and `<x/>` alike), every attribute, entity and text
 * node as ADT sent it, and an element whose whole content is whitespace
 * (`<VALUE>       </VALUE>`, a value of spaces) keeps it. Formatting a
 * formatted body changes nothing.
 */

type Token = { kind: 'tag' | 'text'; value: string };

/** Just past the `>` that closes the tag at `open`; a `>` inside a quoted attribute value is not it. */
function tagEnd(text: string, open: number): number {
  let quote = '';
  for (let at = open + 1; at < text.length; at += 1) {
    const char = text[at];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return at + 1;
    }
  }
  return 0;
}

/**
 * Markup and text, in order: a comment, a processing instruction and a tag
 * are one markup token each; a CDATA section is text.
 */
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
    const cdata = text.startsWith('<![CDATA[', open);
    const end = text.startsWith('<!--', open)
      ? text.indexOf('-->', open) + 3
      : cdata
        ? text.indexOf(']]>', open) + 3
        : text.startsWith('<?', open)
          ? text.indexOf('?>', open) + 2
          : tagEnd(text, open);
    if (end <= open) {
      out.push({ kind: 'text', value: text.slice(open) });
      break;
    }
    out.push({ kind: cdata ? 'text' : 'tag', value: text.slice(open, end) });
    at = end;
  }
  return out;
}

const isClosing = (tag: string): boolean => tag.startsWith('</');
const isOpening = (tag: string): boolean =>
  !isClosing(tag) && !tag.endsWith('/>') && !/^<[?!]/.test(tag);
/** XML whitespace only — space, tab, CR, LF; a no-break space is character data. */
const isBlank = (value: string): boolean => /^[ \t\r\n]*$/.test(value);

/** The opening tags whose element holds text (or CDATA) beside its children. */
function mixedElements(all: Token[]): Set<number> {
  const mixed = new Set<number>();
  const open: number[] = [];
  all.forEach((token, index) => {
    if (token.kind === 'text') {
      const parent = open[open.length - 1];
      if (parent !== undefined && !isBlank(token.value)) mixed.add(parent);
    } else if (isClosing(token.value)) {
      open.pop();
    } else if (isOpening(token.value)) {
      open.push(index);
    }
  });
  return mixed;
}

export function formatCorpusXml(text: string): string {
  const all = tokens(text);
  const mixed = mixedElements(all);
  // One entry per open element: whether its content is kept as it came.
  const verbatim: boolean[] = [];
  const inside = (): boolean => verbatim.includes(true);
  let out = '';
  let depth = 0;
  const newline = (): void => {
    if (out !== '') out += `\n${'  '.repeat(Math.max(depth, 0))}`;
  };
  for (let i = 0; i < all.length; i += 1) {
    const token = all[i] as Token;
    const previous = all[i - 1];
    if (token.kind === 'text') {
      const next = all[i + 1];
      // The whole content of an element is whitespace: a value, kept.
      const leaf =
        isBlank(token.value) &&
        previous?.kind === 'tag' &&
        isOpening(previous.value) &&
        next?.kind === 'tag' &&
        isClosing(next.value);
      if (inside() || leaf || !isBlank(token.value)) out += token.value;
      continue;
    }
    if (isClosing(token.value)) {
      const kept = inside();
      verbatim.pop();
      depth -= 1;
      const emptyOrLeaf =
        previous !== undefined &&
        ((previous.kind === 'tag' && isOpening(previous.value)) ||
          (previous.kind === 'text' && isBlank(previous.value) &&
            all[i - 2]?.kind === 'tag' && isOpening((all[i - 2] as Token).value)));
      if (!kept && !emptyOrLeaf) newline();
      out += token.value;
      continue;
    }
    if (!inside()) newline();
    out += token.value;
    if (isOpening(token.value)) {
      depth += 1;
      verbatim.push(mixed.has(i));
    }
  }
  return `${out.trim()}\n`;
}
