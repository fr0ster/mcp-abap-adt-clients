/**
 * A validation that refuses inside a 200.
 *
 * `validate()` asks whether a name is admissible and whether something is
 * already there. Most types answer a collision with a failing status, which
 * needs no strategy at all — but a function group and a DDL source answer `200`
 * and put the verdict in the body, and only the function group was reading it.
 * So `getDdl().validate()` answered "fine" for a name the system had already
 * rejected, and a caller who validates before creating was waved through.
 *
 * These guard the reading and, as much, its restraint: a 200 that says nothing
 * about severity has to stay a success, or every type whose validation answers
 * some other shape would start failing.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { validationRefusal } from '../../../utils/validationRefusal';

const answerWith = (data: string): IAdtWireResponse =>
  ({ status: 200, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

/** What a DDL validation answers for a name already taken. Measured on trial. */
const TAKEN = `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><SEVERITY>ERROR</SEVERITY><SHORT_TEXT>Data definition ZAC_SHR_BIMP_DDLS already exists</SHORT_TEXT><LONG_TEXT/></DATA></asx:values></asx:abap>`;

/** And for a free one. */
const FREE = `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><SEVERITY>OK</SEVERITY><SHORT_TEXT/><LONG_TEXT/></DATA></asx:values></asx:abap>`;

describe('validationRefusal', () => {
  it('reads a refusal that arrived with a 200', () => {
    const verdict = validationRefusal(ADT_NO_FAILURE, answerWith(TAKEN));

    expect(verdict).not.toBe(ADT_NO_FAILURE);
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a refusal');
    expect(verdict.origin).toBe('refusal');
    // SAP's own sentence, not one this library invented.
    expect(verdict.message).toBe(
      'Data definition ZAC_SHR_BIMP_DDLS already exists',
    );
    expect(verdict.response).toBeDefined();
  });

  it('leaves a validation that passed alone', () => {
    expect(validationRefusal(ADT_NO_FAILURE, answerWith(FREE))).toBe(
      ADT_NO_FAILURE,
    );
  });

  it('leaves a body it does not recognise alone', () => {
    // The restraint that makes this safe as every type's default: most
    // validations answer some other shape entirely, and none of them should
    // start failing because this became the default.
    expect(
      validationRefusal(ADT_NO_FAILURE, answerWith('<something:else/>')),
    ).toBe(ADT_NO_FAILURE);
    expect(validationRefusal(ADT_NO_FAILURE, answerWith(''))).toBe(
      ADT_NO_FAILURE,
    );
    expect(validationRefusal(ADT_NO_FAILURE, undefined)).toBe(ADT_NO_FAILURE);
  });

  it('keeps a failure the transport already named', () => {
    const carried = { origin: 'refusal' as const, message: 'already exists' };
    expect(validationRefusal(carried, answerWith(FREE))).toBe(carried);
  });

  it('clears the trial system talking about its own Kerberos library', () => {
    // Not a workaround for SAP: this is a trial system unable to reach its own
    // authentication library, and it says nothing about the name being asked
    // about. A consumer who disagrees passes their own `analyse`.
    const carried = {
      origin: 'connection' as const,
      message: 'Kerberos library not loaded',
    };
    expect(validationRefusal(carried, answerWith(FREE))).toBe(ADT_NO_FAILURE);
  });
});
