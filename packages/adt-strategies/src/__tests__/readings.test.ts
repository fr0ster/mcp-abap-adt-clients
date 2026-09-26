import {
  isIndeterminateWalkAnswer,
  readActivationRefusal,
  readAdtRefusal,
  readCheckRunRefusal,
  readDeletionRefusal,
  readExceptionRefusal,
  readUnitTestRefusal,
  readValidationRefusal,
} from '../refusals/read';
import { rawOf } from '../result';
import { answerFor, stepsOf } from './corpus';

/**
 * The readings, directly.
 *
 * They are exported because a caller assembling their own strategy needs them,
 * and an exported name that only runs through something else is an untested
 * surface: its signature can change and nothing goes red. The strategies above
 * exercise these — this file is what holds them to a shape.
 *
 * `null` means "not a refusal", never "unrecognised document". Both readings
 * and callers depend on that.
 */

const documentOf = (caseName: string): string => rawOf(answerFor(caseName));

describe('each reading, against its own pair', () => {
  it.each([
    [
      'activation',
      readActivationRefusal,
      'refusal-activation-fails',
      'activation-success-verdict',
      'activation',
    ],
    [
      'check run',
      readCheckRunRefusal,
      'refusal-syntax-check',
      'check-success-verdict',
      'checkrun',
    ],
    [
      'deletion',
      readDeletionRefusal,
      'refusal-delete-refused',
      'delete-success',
      'deletion',
    ],
    [
      'deletion check',
      readDeletionRefusal,
      'refusal-deletion-check-refuses',
      'deletion-check-allows',
      'deletion',
    ],
    [
      'validation',
      readValidationRefusal,
      'refusal-validation-name-taken-ddl',
      'validation-name-free-ddl',
      'validation',
    ],
    [
      'exception',
      readExceptionRefusal,
      'refusal-validation-name-taken-class',
      'validation-name-free-class',
      'exception',
    ],
  ])('%s', (_label, read, refused, allowed, form) => {
    const found = read(documentOf(refused));
    expect(found).not.toBeNull();
    expect(found?.form).toBe(form);
    expect(found?.message.length).toBeGreaterThan(0);
    expect(found?.messages.length).toBeGreaterThan(0);

    expect(read(documentOf(allowed))).toBeNull();
  });

  /**
   * The third activation document, and the row of the table in
   * `readActivationRefusal` that the other two cannot show:
   * `activationExecuted="false"` with no messages at all.
   *
   * Captured by activating an already-active class — SAP had nothing to do and
   * said so. Both other fixtures agree with a reading that treats the bare
   * attribute as a refusal, which is how that reading survived; this one does
   * not.
   */
  it('activation: nothing to activate is not a refusal', () => {
    const document = documentOf('activation-nothing-to-activate');
    expect(document).toContain('activationExecuted="false"');
    expect(document).not.toContain('<msg');

    expect(readActivationRefusal(document)).toBeNull();
  });

  /**
   * The attribute is not ignored either. A declined activation that explains
   * itself with anything at all is still a refusal — what changed is that the
   * explanation has to exist.
   */
  it('activation: not activated, and SAP said something — still a refusal', () => {
    const warned =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg type="W" objDescr="Class ZCL_X"><shortText><txt>Object is locked in another session</txt></shortText></msg></chkl:messages>';

    const found = readActivationRefusal(warned);
    expect(found).not.toBeNull();
    expect(found?.form).toBe('activation');
    // No `E` among them, so the message is built from what there was rather
    // than from a sentence about the attribute.
    expect(found?.message).toContain('Object is locked in another session');
    expect(found?.messages).toHaveLength(1);
  });

  it('the unit-test reading, whose refusal is three steps away', () => {
    const failing = stepsOf('refusal-unittest-run-failing');
    const passing = stepsOf('unittest-run-passing');

    const found = readUnitTestRefusal(rawOf(failing[failing.length - 1]));
    expect(found).not.toBeNull();
    expect(found?.messages.length).toBeGreaterThan(0);

    expect(readUnitTestRefusal(rawOf(passing[passing.length - 1]))).toBeNull();
  });
});

describe('every reading answers null rather than guessing', () => {
  const readings = [
    readActivationRefusal,
    readCheckRunRefusal,
    readDeletionRefusal,
    readValidationRefusal,
    readExceptionRefusal,
    readUnitTestRefusal,
    readAdtRefusal,
  ];

  it.each([
    ['an empty document', ''],
    ['whitespace', '   \n  '],
    ['plain text that is not XML', 'CLASS zcl_x DEFINITION.'],
    [
      'XML of an unrelated shape',
      '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"/>',
    ],
  ])('on %s', (_label, document) => {
    for (const read of readings) {
      expect(read(document)).toBeNull();
    }
  });

  it('on a value that is not a string at all', () => {
    for (const read of readings) {
      expect(read(undefined)).toBeNull();
      expect(read(null)).toBeNull();
      expect(read(42)).toBeNull();
    }
  });
});

describe('the dispatcher picks the form', () => {
  it.each([
    ['refusal-activation-fails', 'activation'],
    ['refusal-syntax-check', 'checkrun'],
    ['refusal-delete-refused', 'deletion'],
    ['refusal-validation-name-taken-ddl', 'validation'],
    ['refusal-validation-name-taken-class', 'exception'],
  ])('%s is read as %s', (name, form) => {
    expect(readAdtRefusal(documentOf(name))?.form).toBe(form);
  });
});

describe('isIndeterminateWalkAnswer', () => {
  /**
   * The one measured in this repository twice over: `/repository/nodestructure`
   * answers `200` with an empty body both for a package that is empty and for
   * one that does not exist. The status cannot separate them and there is no
   * document to read, so this says so rather than choosing.
   */
  it('is true for the empty node structure both cases produce', () => {
    expect(isIndeterminateWalkAnswer('')).toBe(true);
    expect(isIndeterminateWalkAnswer('   ')).toBe(true);
    expect(
      isIndeterminateWalkAnswer(
        documentOf('refusal-package-not-found-objectslist-empty'),
      ),
    ).toBe(true);
  });

  it('is false once the server sent a tree', () => {
    expect(
      isIndeterminateWalkAnswer(documentOf('read-object-tree-structure')),
    ).toBe(false);
  });
});

/**
 * The branches the corpus does not reach.
 *
 * Nothing here is invented behaviour: each is a line that exists because a
 * server can send that value, and the recordings simply do not happen to
 * contain one. Testing them with a crafted document is honest as long as the
 * document is the shape the reading is written for — which is why each of
 * these is a real envelope with one attribute changed.
 */
describe('severities the recordings do not contain', () => {
  const runResult = (severity: string): string =>
    `<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/api/aunit"><program adtcore:name="ZX" xmlns:adtcore="http://www.sap.com/adt/core"><testClasses><testClass adtcore:name="LTC"><testMethods><testMethod adtcore:name="TEST" adtcore:uri="/x"><alerts><alert kind="failedAssertion" severity="${severity}"><title>an alert</title></alert></alerts></testMethod></testMethods></testClass></testClasses></program></aunit:runResult>`;

  it('grades TOLERABLE as a warning, so it is not a failure on its own', () => {
    // ABAP Unit's own scale. A run whose only alert is tolerable has no `E`,
    // and the reading answers null — the caller decides what a warning means.
    expect(readUnitTestRefusal(runResult('tolerable'))).toBeNull();
  });

  it('grades FATAL as an error', () => {
    const found = readUnitTestRefusal(runResult('fatal'));
    expect(found?.messages[0].type).toBe('E');
  });

  it('passes an unrecognised spelling through rather than guessing', () => {
    // `return s` — a severity this package has never seen keeps its own name,
    // so a caller matching on it sees what the server said instead of a
    // silent reclassification.
    const found = readUnitTestRefusal(runResult('critical'));
    expect(found?.messages[0].type).toBe('E');

    const odd = readUnitTestRefusal(runResult('blocker'));
    // No `E` among the messages, so not a refusal — but the spelling survived.
    expect(odd).toBeNull();
  });
});

describe('a document the parser cannot read', () => {
  it('is not a refusal, and does not throw', () => {
    const malformed = '<?xml version="1.0"?><chkl:messages><msg type="E"';
    expect(() => readActivationRefusal(malformed)).not.toThrow();
    expect(readActivationRefusal(malformed)).toBeNull();
    expect(readAdtRefusal(malformed)).toBeNull();
  });
});

/**
 * The group operations, which answer one `del:object` per object asked about.
 *
 * `deleteObjectsGroup` and `checkDeletionGroup` take a list, so two objects
 * come back as two elements and the parser gives an array. This reading took
 * `root.object` as a single element: every attribute then read `undefined`,
 * the explicit `"true"` was missing, and a **successful** deletion of two
 * objects was reported as a refusal.
 *
 * The envelope below is the recorded one, with a second object added.
 */
describe('a deletion answer naming several objects', () => {
  const deletionResult = (...objects: string[]): string =>
    `<?xml version="1.0" encoding="utf-8"?><del:deletionResult xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">${objects.join('')}</del:deletionResult>`;

  const deleted = (name: string, ok: boolean, text = ''): string =>
    `<del:object del:isDeleted="${ok}" adtcore:name="${name}" adtcore:type="CLAS/OC"><del:message del:priority="0" del:type="${ok ? 'S' : 'E'}"><del:text>${text}</del:text></del:message></del:object>`;

  it('is not a refusal when every object was deleted', () => {
    expect(
      readDeletionRefusal(
        deletionResult(deleted('ZCL_A', true), deleted('ZCL_B', true)),
      ),
    ).toBeNull();
  });

  it('is a refusal when one of them was not, and names that one', () => {
    const found = readDeletionRefusal(
      deletionResult(
        deleted('ZCL_A', true),
        deleted('ZCL_B', false, 'You are already editing ZCL_B'),
      ),
    );
    expect(found).not.toBeNull();
    expect(found?.messages).toHaveLength(1);
    expect(found?.message).toContain('ZCL_B');
    expect(found?.message).not.toContain('ZCL_A');
    expect(found?.messages[0].text).toContain('already editing');
  });

  it('reports each refused object when more than one was', () => {
    const found = readDeletionRefusal(
      deletionResult(
        deleted('ZCL_A', false, 'locked'),
        deleted('ZCL_B', false, 'in use'),
      ),
    );
    expect(found?.messages).toHaveLength(2);
    expect(found?.message).toContain('ZCL_A');
    expect(found?.message).toContain('ZCL_B');
  });

  it('still reads the single-object answer the corpus recorded', () => {
    expect(
      readDeletionRefusal(documentOf('refusal-delete-refused')),
    ).not.toBeNull();
    expect(readDeletionRefusal(documentOf('delete-success'))).toBeNull();
  });
});

/**
 * Several `del:message` elements inside one object — issue #172.
 *
 * The answers are E19's, 2026-09-26, as the consumer recorded them in
 * fr0ster/mcp-abap-adt#230 (`src/__tests__/unit/deletionRefusal.test.ts`):
 * **trimmed to the elements a reading looks at**, so they are held here rather
 * than in the corpus, which keeps answers as the system sent them.
 */
describe('a deletion answer carrying several messages per object', () => {
  const NS =
    'xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"';

  /** Check of a service binding that did not exist: a W and an E, siblings. */
  const SRVB_CHECK_TWO_MESSAGES =
    `<?xml version="1.0" encoding="utf-8"?><del:checkResponse ${NS}>` +
    '<del:object del:externalStrongReferences="0" del:externalWeakReferences="0" del:isDeletable="false" adtcore:type="SRVB/SVB" adtcore:name="ZMCP_BLD_SRVB01">' +
    '<del:lockingTransport><del:recording>false</del:recording></del:lockingTransport>' +
    '<del:message del:priority="0" del:type="W"><del:text>ZMCP_BLD_SRVB01 does not exist</del:text></del:message>' +
    '<del:message del:priority="0" del:type="E"><del:text>The Service Binding does not exist</del:text>' +
    '<atom:link href="/sap/bc/adt/messageclass/SDDIC_ADT_SRVB/messages/006/longtext?language=E" rel="http://www.sap.com/adt/relations/longtext" type="text/html" xmlns:atom="http://www.w3.org/2005/Atom"/>' +
    '</del:message></del:object></del:checkResponse>';

  /** Delete of a table whose directory entry waits for the release. */
  const TABL_DELETE_TWO_OBJECTS =
    `<?xml version="1.0" encoding="utf-8"?><del:deletionResult ${NS}>` +
    '<del:object del:isDeleted="true" adtcore:type="TABT/DTT" adtcore:name="ZMCP_BLD_TAB_H1"><del:message del:priority="0" del:type="S"><del:text/></del:message></del:object>' +
    '<del:object del:isDeleted="false" adtcore:type="TABL/DT" adtcore:name="ZMCP_BLD_TAB_H1"><del:message del:priority="0" del:type="W"><del:text>Release transport E19K905876 to remove the object directory entry</del:text></del:message></del:object>' +
    '</del:deletionResult>';

  /** Delete of a behavior definition refused with SWB_TOOL 029. */
  const BDEF_DELETE_T100 =
    `<?xml version="1.0" encoding="utf-8"?><del:deletionResult ${NS}>` +
    '<del:object del:isDeleted="false" adtcore:type="BDEF/BDO" adtcore:name="ZMCP_BLD_I_BDEF">' +
    '<del:message del:priority="0" del:type="E"><del:text>Error while deleting object ZMCP_BLD_I_BDEF from the database</del:text>' +
    '<atom:link href="/sap/bc/adt/messageclass/SWB_TOOL/messages/029/longtext?language=E&amp;msgv1=ZMCP_BLD_I_BDEF" rel="http://www.sap.com/adt/relations/longtext" type="text/html" xmlns:atom="http://www.w3.org/2005/Atom"/>' +
    '</del:message></del:object></del:deletionResult>';

  const CHECK_DELETABLE = `<del:checkResponse ${NS}><del:object del:isDeletable="true" adtcore:name="ZX"/></del:checkResponse>`;

  const CHECK_REFUSED_BY_REFERENCES = `<del:checkResponse ${NS}><del:object del:externalStrongReferences="5" del:externalWeakReferences="3" del:isDeletable="false" adtcore:name="ZMCP_SHR_RTABL"/></del:checkResponse>`;

  it('keeps every message SAP sent, in its order, instead of the reference counts', () => {
    expect(readDeletionRefusal(SRVB_CHECK_TWO_MESSAGES)).toEqual({
      form: 'deletion',
      message: 'ADT refuses to delete ZMCP_BLD_SRVB01',
      messages: [
        {
          type: 'W',
          text: 'ZMCP_BLD_SRVB01: ZMCP_BLD_SRVB01 does not exist',
          t100: undefined,
        },
        {
          type: 'E',
          text: 'ZMCP_BLD_SRVB01: The Service Binding does not exist',
          t100: { id: 'SDDIC_ADT_SRVB', no: '006', values: undefined },
        },
      ],
    });
  });

  it('refuses only the object not deleted, with its own message', () => {
    const found = readDeletionRefusal(TABL_DELETE_TWO_OBJECTS);
    expect(found?.message).toBe('ADT refuses to delete ZMCP_BLD_TAB_H1');
    expect(found?.messages).toEqual([
      {
        type: 'W',
        text: 'ZMCP_BLD_TAB_H1: Release transport E19K905876 to remove the object directory entry',
        t100: undefined,
      },
    ]);
  });

  it('carries the T100 key and its values from the long-text link', () => {
    expect(readDeletionRefusal(BDEF_DELETE_T100)?.messages).toEqual([
      {
        type: 'E',
        text: 'ZMCP_BLD_I_BDEF: Error while deleting object ZMCP_BLD_I_BDEF from the database',
        t100: { id: 'SWB_TOOL', no: '029', values: ['ZMCP_BLD_I_BDEF'] },
      },
    ]);
  });

  it('falls back to the reference counts only when SAP gave no text', () => {
    expect(readDeletionRefusal(CHECK_REFUSED_BY_REFERENCES)?.messages).toEqual([
      {
        type: 'E',
        text: 'ZMCP_SHR_RTABL: 5 strong and 3 weak external references',
      },
    ]);
  });

  it('a permitted object is no refusal, and an E message on it is one', () => {
    expect(readDeletionRefusal(CHECK_DELETABLE)).toBeNull();
    const withError = CHECK_DELETABLE.replace(
      '/>',
      '><del:message del:type="E"><del:text>locked</del:text></del:message></del:object>',
    );
    expect(readDeletionRefusal(withError)?.messages).toEqual([
      { type: 'E', text: 'ZX: locked', t100: undefined },
    ]);
  });

  it('an E among several messages on a permitted object is not missed', () => {
    // The second half of #172: with two messages the `E` read as no type at
    // all, so the object passed as permitted.
    const permitted = SRVB_CHECK_TWO_MESSAGES.replace(
      'del:isDeletable="false"',
      'del:isDeletable="true"',
    );
    expect(readDeletionRefusal(permitted)).not.toBeNull();
  });
});

/**
 * One `checkReport` per object. No capture of a several-object run exists, so
 * the envelope is the recorded single-report one with a second report added.
 */
describe('a check run answering several reports', () => {
  const reports = (...inner: string[]): string =>
    `<?xml version="1.0" encoding="utf-8"?><chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun">${inner.join('')}</chkrun:checkRunReports>`;
  const clean =
    '<chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:triggeringUri="/x" chkrun:status="processed" chkrun:statusText="Object checked"/>';
  const failing =
    '<chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:triggeringUri="/y" chkrun:status="processed" chkrun:statusText="Object checked"><chkrun:checkMessageList><chkrun:checkMessage chkrun:type="E" chkrun:shortText="Syntax error"/></chkrun:checkMessageList></chkrun:checkReport>';

  it('two clean reports are not a check that never ran', () => {
    expect(readCheckRunRefusal(reports(clean, clean))).toBeNull();
  });

  it('one failing report among clean ones is a refusal, with its message', () => {
    const found = readCheckRunRefusal(reports(clean, failing));
    expect(found?.message).toBe('Syntax error');
    expect(found?.messages).toEqual([
      { type: 'E', text: 'Syntax error', code: undefined },
    ]);
  });
});

describe('an activation that reports no reason', () => {
  /**
   * This used to assert the opposite, and it is worth saying why it flipped.
   *
   * `messages` is documented as never empty, and `activationExecuted="false"`
   * with no `<msg>` at all was the one branch that could leave it bare — so
   * the reading filled it with a sentence of its own ("SAP reported
   * activationExecuted=false and gave no reason") to keep the promise. That
   * fixed the type and left the verdict wrong: the document means SAP had
   * nothing to activate, and the invented `E` announced a failure that had not
   * happened.
   *
   * The promise is kept a better way now. The branch that could produce an
   * empty list answers `null` instead, so nothing reaching the refusal path
   * carries fewer than one message and none of them is composed here.
   */
  it('is not a refusal, and so has no message to promise', () => {
    const silent =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/></chkl:messages>';

    expect(readActivationRefusal(silent)).toBeNull();
  });

  /**
   * Absent is not `false`, and the distinction is the whole reason the no-op
   * branch is safe.
   *
   * `activationExecuted="false"` is measured: SAP wrote it, with nothing
   * beside it, for an object that needed no activation. A checklist that
   * carries no `activationExecuted` has been measured for nothing. Reading
   * the attribute as a boolean collapses the two and hands the second the
   * verdict earned by the first.
   */
  it('activation: a properties element without the attribute is not a no-op', () => {
    const noVerdict =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="true"/></chkl:messages>';

    const found = readActivationRefusal(noVerdict);

    expect(found).not.toBeNull();
    expect(found?.form).toBe('activation');
    // Nothing is quoted because nothing was said. The sentence describes the
    // document, and this is the one place this reading composes one rather
    // than repeating SAP.
    expect(found?.message).toContain('neither an activationExecuted verdict');
    expect(found?.messages).toHaveLength(1);
    expect(found?.messages[0].type).toBe('E');
  });

  it('activation: no verdict but a message — the message is the account', () => {
    const noProperties =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><msg type="E"><shortText><txt>Object is locked in another session</txt></shortText></msg></chkl:messages>';

    const found = readActivationRefusal(noProperties);

    expect(found?.message).toContain('Object is locked in another session');
    expect(found?.message).not.toContain('neither an activationExecuted');
    expect(found?.messages).toHaveLength(1);
  });

  it('every refusal this reading builds carries the messages it read', () => {
    for (const document of [
      documentOf('refusal-activation-fails'),
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties activationExecuted="false"/><msg type="W"><shortText><txt>Locked elsewhere</txt></shortText></msg></chkl:messages>',
    ]) {
      const found = readActivationRefusal(document);
      expect(found?.messages.length).toBeGreaterThan(0);
      // Read, not composed: every message text is in the document it came from.
      for (const message of found?.messages ?? []) {
        expect(document).toContain(message.text);
      }
    }
  });
});
