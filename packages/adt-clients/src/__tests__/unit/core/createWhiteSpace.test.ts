/**
 * A value a write puts into a document reaches SAP as given, white space
 * included.
 *
 * A conforming XML parser reads a literal LF, tab or CR in an attribute value
 * as a space (XML 1.0 §3.3.3) and a literal CR or CR LF in text as LF
 * (§2.11), so a description "a\nb" written literally reached SAP as "a b".
 * Every write escapes through the one function of its kind in
 * `src/utils/xml.ts`; each case reads the body back the way a conforming
 * parser does and compares the value exactly.
 */
import { buildAuthorizationFieldXml } from '../../../core/authorizationField/xmlBuilder';
import { buildFeatureToggleXml } from '../../../core/featureToggle/xmlBuilder';
import { buildFunctionIncludeXml } from '../../../core/functionInclude/xmlBuilder';
import { buildMessageClassXml } from '../../../core/messageClass/xml';
import { createTransport } from '../../../core/transport/create';
import { TEST_HEADERS } from '../../helpers/adtHeaders';
import { RecordingConnection } from '../../helpers/recordingConnection';
import { attributesNamed, conformingRead, readAt } from './conformingRead';
import {
  CREATES,
  type CreateCase,
  OTHER_LANGUAGE_CREATES,
  sent,
} from './createBodyCases';

const WHITE_SPACE = 'a\nb\tc\rd\r\ne';
const DESCRIPTION = '@_adtcore:description';

/** The first value of an attribute in a body, as a conforming parser reads it. */
function firstRead(body: string, name: string): string | undefined {
  return attributesNamed(conformingRead(body), name)[0];
}

const DESCRIBED = [...CREATES, ...OTHER_LANGUAGE_CREATES].filter(
  (c) => c.description,
);

describe.each(DESCRIBED.map((c): [string, CreateCase] => [c.label, c]))(
  '%s create',
  (_label, create) => {
    it('writes a description with LF, tab and CR as given', async () => {
      const { body } = await sent(create, { description: WHITE_SPACE });
      expect(firstRead(body, DESCRIPTION)).toBe(WHITE_SPACE);
    });
  },
);

describe('the other writers keep LF, tab and CR', () => {
  it('authorization field: the description and an element text', () => {
    const body = buildAuthorizationFieldXml({
      authorization_field_name: 'ZAUTH',
      package_name: 'ZPKG',
      description: WHITE_SPACE,
      field_name: WHITE_SPACE,
    });
    const parsed = conformingRead(body);
    expect(attributesNamed(parsed, DESCRIPTION)[0]).toBe(WHITE_SPACE);
    expect(
      readAt(parsed, ['auth:auth', 'auth:content', 'auth:fieldName']),
    ).toBe(WHITE_SPACE);
  });

  it('feature toggle: the description', () => {
    const body = buildFeatureToggleXml({
      feature_toggle_name: 'ZFT',
      package_name: 'ZPKG',
      description: WHITE_SPACE,
    });
    expect(firstRead(body, DESCRIPTION)).toBe(WHITE_SPACE);
  });

  it('function include: the description', () => {
    const body = buildFunctionIncludeXml({
      function_group_name: 'ZFG',
      include_name: 'LZFGF01',
      description: WHITE_SPACE,
    });
    expect(firstRead(body, DESCRIPTION)).toBe(WHITE_SPACE);
  });

  it('message class: the description and a message text', () => {
    const body = buildMessageClassXml({
      name: 'ZMSG',
      description: WHITE_SPACE,
      messages: [{ msgno: '001', msgtext: WHITE_SPACE }],
    });
    const parsed = conformingRead(body);
    expect(attributesNamed(parsed, DESCRIPTION)[0]).toBe(WHITE_SPACE);
    expect(attributesNamed(parsed, '@_mc:msgtext')[0]).toBe(WHITE_SPACE);
  });

  it('transport request: the description', async () => {
    const connection = new RecordingConnection();
    await createTransport(connection, TEST_HEADERS, {
      description: WHITE_SPACE,
      owner: 'USER',
    });
    const request = connection.sent.at(-1);
    const body = typeof request?.data === 'string' ? request.data : '';
    expect(firstRead(body, '@_tm:desc')).toBe(WHITE_SPACE);
  });
});
