import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { at, field, isElement, leafText, listOf } from '../parsed';
import { feedEntries, feedGatewayErrorDetail } from '../results/feeds';

/**
 * The readers every reading of a parsed document goes through. A parsed
 * document is `unknown`; each reader answers nothing for a value that is not
 * what it reads, so a document of another shape reads as one without the
 * field, never as a throw.
 */
describe('the parsed-document readers', () => {
  it('isElement: objects and arrays are elements, null and leaves are not', () => {
    expect(isElement({})).toBe(true);
    expect(isElement([])).toBe(true);
    expect(isElement(null)).toBe(false);
    expect(isElement(undefined)).toBe(false);
    expect(isElement('text')).toBe(false);
    expect(isElement(1)).toBe(false);
  });

  it('field: a field of an element, undefined for anything else', () => {
    expect(field({ a: 'x' }, 'a')).toBe('x');
    expect(field({ a: 'x' }, 'b')).toBeUndefined();
    expect(field('text', 'length')).toBeUndefined();
    expect(field(null, 'a')).toBeUndefined();
    expect(field(undefined, 'a')).toBeUndefined();
  });

  it('at: a field several levels down, undefined where a level is missing', () => {
    expect(at({ a: { b: { c: 'x' } } }, 'a', 'b', 'c')).toBe('x');
    expect(at({ a: 'leaf' }, 'a', 'b')).toBeUndefined();
    expect(at({ a: { b: 1 } })).toEqual({ a: { b: 1 } });
  });

  it('listOf: nothing is none, an array is itself, anything else is one', () => {
    expect(listOf(undefined)).toEqual([]);
    expect(listOf(null)).toEqual([]);
    const list = [1, 2];
    expect(listOf(list)).toBe(list);
    expect(listOf({ a: 1 })).toEqual([{ a: 1 }]);
    expect(listOf('')).toEqual(['']);
  });

  it('leafText: text as it is, a coerced number or boolean as its text, else undefined', () => {
    expect(leafText('x')).toBe('x');
    expect(leafText(12)).toBe('12');
    expect(leafText(false)).toBe('false');
    expect(leafText({ '#text': 'x' })).toBeUndefined();
    expect(leafText(undefined)).toBeUndefined();
  });
});

describe('the feed readings answer their declared types', () => {
  const answer = (data: string): IAdtWireResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
  });

  it('an entry id the parser reads as a number is read back as its text', () => {
    const [entry] = feedEntries(
      answer(
        '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>123</id><title>T</title></entry></feed>',
      ),
    );
    expect(entry?.id).toBe('123');
  });

  it("a call-stack entry's number and line, kept as text by the parser, are read as numbers", () => {
    const detail = feedGatewayErrorDetail(
      answer(
        '<errorEntry type="X"><callStack><entry number="3" line="42" event="E"/></callStack></errorEntry>',
      ),
    );
    expect(detail.type).toBe('X');
    expect(detail.callStack).toEqual([
      { number: 3, event: 'E', program: '', name: '', line: 42 },
    ]);
  });
});
