import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getWhereUsed,
  modifyWhereUsedScope,
} from '../../../core/shared/whereUsed';
import {
  isSelectedAttribute,
  nameAttribute,
  replaceTypeTags,
  scopeResultAsScope,
  typeTagNameEnd,
  withoutXmlDeclaration,
} from '../../../utils/scan';
import { differences, inputSets } from '../../helpers/differential';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');

/** The where-used regexes (#304), as they were. */
const TYPE_TAG = /<[A-Za-z][\w-]*:type\b[^>]*?\/>/g;
const NAME = /\bname="([^"]*)"/;
const IS_SELECTED = /\bisSelected="(?:true|false)"/;
const TAG_NAME = /<([A-Za-z][\w-]*:type)\b/;
const XML_DECLARATION = /<\?xml[^>]*\?>/;
const SCOPE_OPEN = /<([A-Za-z][\w-]*):usageScopeResult\b([^>]*)>/;
const SCOPE_CLOSE = /<\/([A-Za-z][\w-]*):usageScopeResult>/;

const sets = inputSets({
  edges: [
    '',
    '<usagereferences:type isDefault="true" isSelected="false" name="CLAS"/>',
    '<usageReferences:type name="X"/><a:type/>',
    '<a:types name="x"/>',
    '<a:type-x/>',
    '<a:type name="a>b"/>',
    '<a:type name="x" xname="y"/>',
    '<a:type isSelected="maybe" isSelected="true"/>',
    '<a:type xisSelected="true"/>',
    '<1a:type/>',
    '<a-b_c:type/>',
    '<?xml version="1.0"?><u:usageScopeResult xmlns:u="x"><u:type name="A"/></u:usageScopeResult>',
    '<?xml a>?><?xml?>',
    '<u:usageScopeResultX>',
    '<u:usageScopeResult>',
    '</u:usageScopeResult></v:usageScopeResult>',
  ],
  alphabet: ['<', 'a:type', '/', '>', ' ', 'name="', '"', 'x'],
  maxLength: 5,
  tokens: [
    '<',
    '</',
    'a',
    'a:type',
    'a:types',
    ':type',
    '/>',
    '/',
    '>',
    ' ',
    'name="',
    'xname="',
    'isSelected="',
    'true',
    'false',
    '"',
    'x',
    '-',
    '_',
    '<?xml',
    '?>',
    '?',
    ':usageScopeResult',
    'u:usageScopeResult',
    '\n',
  ],
  maxTokens: 20,
});

const mark = (tag: string) => `[${tag}]`;

describe('the where-used scanners answer what their regexes answered', () => {
  for (const [name, inputs] of Object.entries(sets)) {
    it(`the type tags on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => s.replace(TYPE_TAG, mark),
          (s) => replaceTypeTags(s, mark),
        ),
      ).toEqual([]);
    });
    it(`name= on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => s.match(NAME)?.[1], nameAttribute),
      ).toEqual([]);
    });
    it(`isSelected= on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => {
            const m = IS_SELECTED.exec(s);
            return m ? { index: m.index, length: m[0].length } : undefined;
          },
          isSelectedAttribute,
        ),
      ).toEqual([]);
    });
    it(`the tag name on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => {
            const m = TAG_NAME.exec(s);
            return m
              ? { index: m.index, end: m.index + m[0].length }
              : undefined;
          },
          typeTagNameEnd,
        ),
      ).toEqual([]);
    });
    it(`the XML declaration on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => s.replace(XML_DECLARATION, ''),
          withoutXmlDeclaration,
        ),
      ).toEqual([]);
    });
    it(`the scope rewrap on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) =>
            s
              .replace(SCOPE_OPEN, '<$1:scope$2>')
              .replace(SCOPE_CLOSE, '</$1:scope>'),
          scopeResultAsScope,
        ),
      ).toEqual([]);
    });
  }
});

/** The two where-used rewrites before #304, copied whole, as oracles. */
function oldModify(
  scopeXml: string,
  options: {
    enableAll?: boolean;
    enableOnly?: string[];
    enable?: string[];
    disable?: string[];
  },
): string {
  const setIsSelected = (typeTag: string, selected: boolean): string => {
    const value = selected ? 'true' : 'false';
    if (/\bisSelected="(?:true|false)"/.test(typeTag))
      return typeTag.replace(
        /\bisSelected="(?:true|false)"/,
        `isSelected="${value}"`,
      );
    return typeTag.replace(
      /<([A-Za-z][\w-]*:type)\b/,
      `<$1 isSelected="${value}"`,
    );
  };
  return scopeXml.replace(/<[A-Za-z][\w-]*:type\b[^>]*?\/>/g, (tag) => {
    const nameMatch = tag.match(/\bname="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : '';
    let selected: boolean | undefined;
    if (options.enableAll) selected = true;
    else if (options.enableOnly)
      selected = options.enableOnly.includes(name ?? '');
    else {
      if (options.enable?.includes(name ?? '')) selected = true;
      if (options.disable?.includes(name ?? '')) selected = false;
    }
    if (selected === undefined) return tag;
    return setIsSelected(tag, selected);
  });
}

describe('modifyWhereUsedScope and the scope sent rewrite as before', () => {
  const recorded = readdirSync(ANSWERS)
    .filter((f) => f.startsWith('where-used-scope-') && f.includes('.body.'))
    .map((f) => readFileSync(join(ANSWERS, f), 'utf-8'));
  const documents = [
    ...recorded,
    '<a:type name="CLAS/OC"/><a:type isSelected="true" name="PROG/P"/><b:type name="X" isSelected="false" />',
    '<a:type name="A"><a:type name="B"/>',
  ];
  const optionSets = [
    { enableAll: true },
    { enableOnly: ['CLAS/OC', 'X'] },
    { enable: ['PROG/P'], disable: ['CLAS/OC'] },
    { enable: ['A', 'B'] },
    {},
  ];
  it('modifies every recorded scope as the regexes did', () => {
    expect(recorded.length).toBeGreaterThan(0);
    for (const document of documents)
      for (const options of optionSets)
        expect(modifyWhereUsedScope(document, options)).toBe(
          oldModify(document, options),
        );
  });

  it('sends every recorded scope rewrapped as the regexes did', async () => {
    for (const scopeXml of documents) {
      const sent: unknown[] = [];
      const connection = {
        makeAdtRequest: async (request: { data?: unknown }) => {
          sent.push(request.data);
          return { status: 200, statusText: '', headers: {}, data: '' };
        },
        getBaseUrl: async () => '',
        getSessionId: () => null,
        setSessionType: () => undefined,
        connect: async () => undefined,
      };
      await getWhereUsed(
        connection,
        { accept: 'a', contentType: 'c' } as never,
        {
          object_name: 'ZCL_X',
          object_type: 'CLAS/OC',
          scopeXml,
        } as never,
      );
      const old = scopeXml
        .replace(XML_DECLARATION, '')
        .replace(SCOPE_OPEN, '<$1:scope$2>')
        .replace(SCOPE_CLOSE, '</$1:scope>');
      expect(sent[0]).toContain(old);
    }
  });
});
