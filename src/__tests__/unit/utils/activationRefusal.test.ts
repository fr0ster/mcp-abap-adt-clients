/**
 * One activation rule, applied by every object type.
 *
 * Nine object types each carried a private `parseActivationResponse` with the
 * same wrong shape — `activationExecuted && checkExecuted`, with the `<msg>`
 * list never read. Fixing the shared helper alone left those nine refusing
 * responses the shared path accepted, so the same SAP answer meant "activated"
 * for a class and "failed" for a scalar function.
 *
 * The rule is an error strategy now rather than an assertion. It used to throw
 * a plain `Error` from the writer, which `recogniseFailure` then classified
 * `origin: 'connection'` — a caller told to check the network over a syntax
 * error SAP had explained in the body. `activationRefusal` names it a refusal,
 * and every `activate` member defaults to it.
 *
 * These guard both halves: that the rule is right, and that it stays in one
 * place.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../../utils/activationUtils';

/** The answer an activation POST came back with, as `answering` hands it over. */
const answerWith = (data: string): IAdtWireResponse =>
  ({ status: 200, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

/** What the default verdict is before `analyse` is consulted: nothing wrong. */
const verdictFor = (data: string) =>
  activationRefusal(ADT_NO_FAILURE, answerWith(data));

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

describe('activationRefusal', () => {
  it('lets through a response for an object that needed no activation', () => {
    // `activationExecuted="false"` with an empty message list is what an
    // already-active object answers. It says ADT did no work, not that the
    // work failed.
    expect(verdictFor(ALREADY_ACTIVE)).toBe(ADT_NO_FAILURE);
  });

  it('names a response carrying an error message a refusal', () => {
    const verdict = verdictFor(REAL_FAILURE);
    expect(verdict).not.toBe(ADT_NO_FAILURE);
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a refusal');

    // `refusal`, not `connection`: SAP answered, and what it said is the
    // verdict. The old thrown `Error` was classified as the channel failing.
    expect(verdict.origin).toBe('refusal');
    expect(verdict.message).toMatch(/Activation failed/);
  });

  it("surfaces SAP's own wording instead of a fixed string", () => {
    // The nine private copies all replaced this with "Activation failed",
    // discarding the only part that says what to do about it.
    const verdict = verdictFor(REAL_FAILURE);
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a refusal');
    expect(verdict.message).toMatch(/does not have a TMDIR entry/);
  });

  it('keeps the document, so a caller can read what this did not', () => {
    const verdict = verdictFor(REAL_FAILURE);
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a refusal');
    expect(verdict.response?.data).toBe(REAL_FAILURE);
  });

  it('never overrules a verdict already reached', () => {
    // The contract's order: a failure named before this one — a status the
    // transport refused — stands, and is not re-judged from a body that may
    // not even be there.
    const existing = { origin: 'connection' as const, message: 'no route' };
    expect(activationRefusal(existing, answerWith(ALREADY_ACTIVE))).toBe(
      existing,
    );
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
