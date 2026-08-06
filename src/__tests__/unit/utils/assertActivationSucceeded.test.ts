/**
 * One activation rule, applied by every object type.
 *
 * Nine object types each carried a private `parseActivationResponse` with the
 * same wrong shape — `activationExecuted && checkExecuted`, with the `<msg>`
 * list never read. Fixing the shared helper alone left those nine refusing
 * responses the shared path accepted, so the same SAP answer meant "activated"
 * for a class and "failed" for a scalar function.
 *
 * These guard both halves: that the rule is right, and that it stays in one
 * place.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertActivationSucceeded } from '../../../utils/activationUtils';

const CORE_ROOT = resolve(__dirname, '../../../core');

/** What ADT answers for an object that needed no activation. Probed on trial. */
const ALREADY_ACTIVE = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="true"/>
</chkl:messages>`;

/** What ADT answers when the object cannot be activated. Probed on trial. */
const REAL_FAILURE = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="true"/>
  <msg objDescr="CLAS ZAC_NO_SUCH_CLS_XY" type="E" line="1" code="OO(045)">
    <shortText>
      <txt>Class ZAC_NO_SUCH_CLS_XY does not have a TMDIR entry</txt>
    </shortText>
  </msg>
</chkl:messages>`;

describe('assertActivationSucceeded', () => {
  it('accepts a response for an object that needed no activation', () => {
    expect(() =>
      assertActivationSucceeded('Scalar function', ALREADY_ACTIVE),
    ).not.toThrow();
  });

  it('rejects a response carrying an error message', () => {
    expect(() =>
      assertActivationSucceeded('Scalar function', REAL_FAILURE),
    ).toThrow(/Scalar function activation failed/);
  });

  it("surfaces SAP's own wording instead of a fixed string", () => {
    // The nine private copies all replaced this with "Activation failed",
    // discarding the only part that says what to do about it.
    expect(() =>
      assertActivationSucceeded('Scalar function', REAL_FAILURE),
    ).toThrow(/does not have a TMDIR entry/);
  });

  it('keeps the caller-supplied label, which was the only type-specific part', () => {
    expect(() =>
      assertActivationSucceeded('Append structure', REAL_FAILURE),
    ).toThrow(/^Append structure activation failed: /);
  });
});

describe('the activation rule lives in one place', () => {
  const activationFiles = readdirSync(CORE_ROOT)
    .map((mod) => join(CORE_ROOT, mod, 'activation.ts'))
    .filter((file) => {
      try {
        readFileSync(file, 'utf8');
        return true;
      } catch {
        return false;
      }
    });

  it('finds the files to check, so the guard cannot pass by looking nowhere', () => {
    expect(activationFiles.length).toBeGreaterThan(0);
  });

  it('leaves no core module deciding activation success on its own', () => {
    const offenders = activationFiles
      .filter((file) => /activationExecuted/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(`${CORE_ROOT}/`, ''));

    expect(offenders).toEqual([]);
  });
});
