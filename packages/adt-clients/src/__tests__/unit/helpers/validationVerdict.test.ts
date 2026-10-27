/**
 * A validation answer's errors, read by structure: SAP's severity envelope,
 * a message nested in an error table, a message table under another prefix.
 * A clean answer and a warning are no errors; text that is not XML throws.
 */
import { validationErrors } from '../../helpers/validationVerdict';

describe('validationErrors', () => {
  it('reads the asx:abap envelope with SEVERITY ERROR', () => {
    expect(
      validationErrors(
        '<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><SEVERITY>ERROR</SEVERITY><SHORT_TEXT>ZAC_DDL already exists</SHORT_TEXT></DATA></asx:values></asx:abap>',
      ),
    ).toEqual(['ZAC_DDL already exists']);
  });

  it('answers nothing for SEVERITY OK and for CHECK_RESULT X', () => {
    expect(
      validationErrors(
        '<asx:abap xmlns:asx="a"><asx:values><DATA><SEVERITY>OK</SEVERITY><SHORT_TEXT/></DATA></asx:values></asx:abap>',
      ),
    ).toEqual([]);
    expect(
      validationErrors(
        '<asx:abap xmlns:asx="a"><asx:values><DATA><CHECK_RESULT>X</CHECK_RESULT></DATA></asx:values></asx:abap>',
      ),
    ).toEqual([]);
  });

  it('finds a message nested inside an error table', () => {
    expect(
      validationErrors(
        '<adtcore:errorTable xmlns:adtcore="c"><adtcore:message adtcore:type="E" adtcore:text="Name is reserved"/></adtcore:errorTable>',
      ),
    ).toEqual(['Name is reserved']);
  });

  it('finds a message table under another prefix, its severity spelled out', () => {
    expect(
      validationErrors(
        '<x:messageTable xmlns:x="c"><x:message x:severity="ERROR"><x:text>Package missing</x:text></x:message><x:message x:severity="WARNING"><x:text>w</x:text></x:message></x:messageTable>',
      ),
    ).toEqual(['Package missing']);
  });

  it('answers nothing for an empty answer, and throws for one that is not XML', () => {
    expect(validationErrors('')).toEqual([]);
    expect(() => validationErrors('<a><b></a>')).toThrow(/not XML/);
  });
});
