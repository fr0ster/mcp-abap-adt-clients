import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  analyseActivation,
  type IAdtActivationFailure,
} from '../refusals/analyse';
import { readActivationRefusal } from '../refusals/read';
import { stepsOf } from './corpus';

/**
 * The rows of the activation table that fr0ster/mcp-abap-adt#360 changed
 * (fr0ster/mcp-abap-adt-clients#314): a checklist without
 * `activationExecuted` whose messages are warnings only is judged by the
 * inactive list. Every other row stays as it was.
 */

const CHECKLIST_NS = 'http://www.sap.com/abapxml/checklist';

/**
 * Built from the issue report (fr0ster/mcp-abap-adt#360, SAP_BASIS 7.52),
 * **not recorded**: the report quotes the refusal the reading built from it —
 * one `W` message whose text is its `objDescr` (so it carried no
 * `shortText`) on line 1, and no `activationExecuted`. Whether the 7.52
 * answer carried a `chkl:properties` without the attribute or none at all is
 * not in the report, so both are tried.
 */
const ISSUE_752_NO_PROPERTIES = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><msg objDescr="Program ZUNITTEST_MOCKUP_LOADER_EXMPL" type="W" line="1"/></chkl:messages>`;
const ISSUE_752_PROPERTIES = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true"/><msg objDescr="Program ZUNITTEST_MOCKUP_LOADER_EXMPL" type="W" line="1"/></chkl:messages>`;
const ISSUE_752 = [
  ['without chkl:properties', ISSUE_752_NO_PROPERTIES],
  ['with chkl:properties but no activationExecuted', ISSUE_752_PROPERTIES],
] as const;

/**
 * Recorded on onprem (SAP_BASIS 816), 2026-11-16: the body of
 * `POST /activation` for a program whose syntax check gives one warning.
 * The same shape was recorded on cloud for a class.
 */
const RECORDED_816_WARNING = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="true" generationExecuted="true"/><msg objDescr="Program ZMCP_I360_8614B7_P" type="W" line="1" href="/sap/bc/adt/programs/programs/zmcp_i360_8614b7_p/source/main#start=9,4;end=9,50" code="MESSAGE(G-Q)" forceSupported="true"><shortText><txt>The exception CX_UUID_ERROR is not caught or declared in the RAISING clause of "M".</txt></shortText><atom:link href="art.syntax:G-Q" rel="http://www.sap.com/adt/categories/quickfixes" xmlns:atom="http://www.w3.org/2005/Atom"/></msg></chkl:messages>`;

/**
 * Recorded on onprem (SAP_BASIS 816), 2026-11-16: a cancelled activation
 * (a syntax error) — `activationExecuted="false"`, a `W` "Activation was
 * cancelled." first, then the `E` and a `W`.
 */
const RECORDED_816_CANCELLED = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg objDescr="" type="W" line="0" href=""><shortText><txt>Activation was cancelled.</txt></shortText></msg><msg objDescr="Program ZMCP_I360_4666B4_P" type="E" line="1" href="/sap/bc/adt/programs/programs/zmcp_i360_4666b4_p/source/main#start=13,10" code="WRITE(100)" forceSupported="true"><shortText><txt>The specified formats "/" and "1" must be specified as one word: "/1".</txt></shortText><correctionHint number="-1" kind="E" line="0" column="0" word=""/><correctionHint number="1" kind="" line="0" column="0" word=""/><correctionHint number="1" kind="D" line="13" column="8" word="/"/><correctionHint number="1" kind="D" line="13" column="10" word="1"/><correctionHint number="1" kind="I" line="13" column="8" word="/1"/></msg><msg objDescr="Program ZMCP_I360_4666B4_P" type="W" line="2" href="/sap/bc/adt/programs/programs/zmcp_i360_4666b4_p/source/main#start=9,4;end=9,50" code="MESSAGE(G-Q)" forceSupported="true"><shortText><txt>The exception CX_UUID_ERROR is not caught or declared in the RAISING clause of "M".</txt></shortText><atom:link href="art.syntax:G-Q" rel="http://www.sap.com/adt/categories/quickfixes" xmlns:atom="http://www.w3.org/2005/Atom"/></msg></chkl:messages>`;

/**
 * The first message of {@link RECORDED_816_CANCELLED} alone: derived from the
 * recording, not recorded by itself. It is the `false` + warnings-only row.
 */
const CANCELLED_WARNING_ONLY = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg objDescr="" type="W" line="0" href=""><shortText><txt>Activation was cancelled.</txt></shortText></msg></chkl:messages>`;

/** A checklist of the given verdict attribute and one message of `type`. */
const withMessage = (executed: string | undefined, type: string): string =>
  `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true"${
    executed === undefined ? '' : ` activationExecuted="${executed}"`
  }/><msg objDescr="Program ZP" type="${type}" line="1"><shortText><txt>message of type ${type}</txt></shortText></msg></chkl:messages>`;

const wire = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

/**
 * The inactive lists are recorded (S/4HANA 2025): one naming the function
 * group `zact751p9325` and its main program, and an empty one. The named uris
 * are what the activation request sent, so the group's uri stands for the
 * object the activation named.
 */
const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';
const LIST_NAMING_GROUP = (): IAdtWireResponse =>
  stepsOf('activation-group-alone-s4-2025')[4];
const EMPTY_LIST = (): IAdtWireResponse =>
  stepsOf('activation-reactivate-active-s4-2025')[3];

const failure = (
  verdict: IAdtActivationFailure | typeof ADT_NO_FAILURE,
): IAdtActivationFailure => {
  if (verdict === ADT_NO_FAILURE) {
    throw new Error('expected a failure, got ADT_NO_FAILURE');
  }
  return verdict;
};

describe('no activationExecuted, warnings only: the inactive list decides', () => {
  describe.each(ISSUE_752)('the 7.52 shape %s', (_label, document) => {
    it('none of the named objects listed: activated', () => {
      expect(
        readActivationRefusal(document, {
          named: [GROUP],
          inactiveObjects: EMPTY_LIST(),
        }),
      ).toBeNull();
      expect(
        analyseActivation(ADT_NO_FAILURE, wire(document), {
          activation: { named: [GROUP], inactiveObjects: EMPTY_LIST() },
        }),
      ).toBe(ADT_NO_FAILURE);
    });

    it('a named object still listed: not activated, with stillInactive', () => {
      const verdict = failure(
        analyseActivation(ADT_NO_FAILURE, wire(document), {
          activation: { named: [GROUP], inactiveObjects: LIST_NAMING_GROUP() },
        }),
      );
      expect(verdict.message).toContain(
        'SAP answered no activationExecuted verdict and only warnings, and the inactive list still names 2 object(s)',
      );
      expect(verdict.stillInactive.map((o) => o.uri)).toEqual([
        GROUP,
        `${GROUP}/source/main`,
      ]);
      // SAP's warning is kept beside the sentence.
      expect(verdict.messages.map((m) => m.text)).toContain(
        'Program ZUNITTEST_MOCKUP_LOADER_EXMPL',
      );
    });

    it('without the inactive list: undecided', () => {
      const found = readActivationRefusal(document);
      expect(found?.message).toContain(
        "SAP answered no activationExecuted verdict and only warnings; without the list of inactive objects the activation's outcome could not be decided",
      );
      expect(found?.stillInactive).toEqual([]);
    });

    it('with a list that cannot be read: undecided', () => {
      const found = readActivationRefusal(document, {
        named: [GROUP],
        inactiveObjects: { ...EMPTY_LIST(), status: 500 },
      });
      expect(found?.message).toContain(
        "SAP answered no activationExecuted verdict and only warnings, and the inactive list could not be read; the activation's outcome could not be decided",
      );
    });
  });

  /**
   * The cancel note without a verdict: constructed from the recorded 816
   * note (`RECORDED_816_CANCELLED`'s first message) with no
   * `activationExecuted`. SAP leaves the object on the inactive list on
   * every failing warning path, the cancel note included, so the list
   * answers it: no rule keyed on the text.
   */
  it('the cancel note with the object still listed is not activated', () => {
    const document = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true"/><msg objDescr="" type="W" line="0" href=""><shortText><txt>Activation was cancelled.</txt></shortText></msg></chkl:messages>`;
    const verdict = failure(
      analyseActivation(ADT_NO_FAILURE, wire(document), {
        activation: { named: [GROUP], inactiveObjects: LIST_NAMING_GROUP() },
      }),
    );
    expect(verdict.message).toContain(
      'the inactive list still names 2 object(s)',
    );
    expect(verdict.stillInactive.map((o) => o.uri)).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
    expect(verdict.messages.map((m) => m.text)).toContain(
      'Activation was cancelled.',
    );
  });

  it.each(['I', 'S'])('a message of type %s counts as a warning', (type) => {
    expect(
      readActivationRefusal(withMessage(undefined, type), {
        named: [GROUP],
        inactiveObjects: EMPTY_LIST(),
      }),
    ).toBeNull();
  });

  it.each(['E', 'A', 'X'])(
    'a message of type %s stays refused, whatever the list says',
    (type) => {
      const document = withMessage(undefined, type);
      const facts = { named: [GROUP], inactiveObjects: EMPTY_LIST() };
      const found = readActivationRefusal(document, facts);
      expect(found?.message).toContain(`message of type ${type}`);
      // Exactly what it answered without the list: the list changes nothing.
      expect(found).toEqual(readActivationRefusal(document));
    },
  );

  it('no message and no attribute stays refused, whatever the list says', () => {
    const found = readActivationRefusal(
      `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true"/></chkl:messages>`,
      { named: [GROUP], inactiveObjects: EMPTY_LIST() },
    );
    expect(found?.message).toContain('neither an activationExecuted verdict');
  });
});

describe('activationExecuted="true" stays as it was', () => {
  it('recorded (816): one warning is activated', () => {
    expect(readActivationRefusal(RECORDED_816_WARNING)).toBeNull();
  });
});

describe('activationExecuted="false" with messages stays refused', () => {
  it('recorded (816): a cancelled activation is refused, its E explains it', () => {
    const found = readActivationRefusal(RECORDED_816_CANCELLED);
    expect(found?.message).toBe(
      'Activation failed: The specified formats "/" and "1" must be specified as one word: "/1".',
    );
    expect(found?.messages.map((m) => m.type)).toEqual(['W', 'E', 'W']);
  });

  it('its warning alone is refused too, and the list is not asked', () => {
    // An empty list beside it must not turn it into a success.
    const found = readActivationRefusal(CANCELLED_WARNING_ONLY, {
      named: [GROUP],
      inactiveObjects: EMPTY_LIST(),
    });
    expect(found?.message).toBe(
      'Activation failed: Activation did not run and SAP attached no error: W: Activation was cancelled.',
    );
  });
});

/**
 * A namespaced object's address in two spellings: the client builds
 * `%2Fabc%2Fzp` (encodeURIComponent's uppercase hex), and ADT writes
 * `%2fabc%2fzp` (recorded in the 7.40 quick search's `adtcore:uri`s). RFC 3986
 * makes them the same address, so the inactive list naming one counts for an
 * activation that named the other. The list is constructed: no recorded
 * inactive list names a namespaced object.
 */
describe('a namespaced object counts however its escapes are cased', () => {
  const NAMED = '/sap/bc/adt/programs/programs/%2Fabc%2Fzp';
  const LISTED = '/sap/bc/adt/programs/programs/%2fabc%2fzp';
  const LIST = wire(
    `<?xml version="1.0" encoding="utf-8"?><ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects"><ioc:entry><ioc:object ioc:user="" ioc:deleted="false"><ioc:ref adtcore:uri="${LISTED}" adtcore:type="PROG/P" adtcore:name="/ABC/ZP" xmlns:adtcore="http://www.sap.com/adt/core"/></ioc:object><ioc:transport/></ioc:entry></ioc:inactiveObjects>`,
  );
  const SILENT = `<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="${CHECKLIST_NS}"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/></chkl:messages>`;

  it.each([
    ['no verdict, warnings alone', ISSUE_752_PROPERTIES],
    ['the silent checklist', SILENT],
  ])('%s: still listed in lowercase escapes is not activated', (_row, document) => {
    const verdict = failure(
      analyseActivation(ADT_NO_FAILURE, wire(document), {
        activation: { named: [NAMED], inactiveObjects: LIST },
      }),
    );
    expect(verdict.stillInactive.map((o) => o.uri)).toEqual([LISTED]);
  });

  it('an escape is not a letter: %2F does not match a literal "2f"', () => {
    const other = wire(
      `<?xml version="1.0" encoding="utf-8"?><ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects"><ioc:entry><ioc:object ioc:user="" ioc:deleted="false"><ioc:ref adtcore:uri="/sap/bc/adt/programs/programs/%2fabc%2fzq" adtcore:type="PROG/P" adtcore:name="/ABC/ZQ" xmlns:adtcore="http://www.sap.com/adt/core"/></ioc:object><ioc:transport/></ioc:entry></ioc:inactiveObjects>`,
    );
    expect(
      analyseActivation(ADT_NO_FAILURE, wire(SILENT), {
        activation: { named: [NAMED], inactiveObjects: other },
      }),
    ).toBe(ADT_NO_FAILURE);
  });
});
