/**
 * The class's default readings.
 *
 * A set is given to an implementation once, at the factory, rather than a
 * strategy per call: a consumer that wants documents whole wants them for every
 * member it touches, and none of them changes its mind between `create` and
 * `read` of the same object.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { classDocuments } from '../../../core/class/types';

const wire = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

describe('the class default result strategies', () => {
  it('answers the source as it arrived', () => {
    expect(classDocuments.source(wire('CLASS zcl_x.'))).toBe('CLASS zcl_x.');
  });

  it('answers an empty source as empty rather than as absence', () => {
    // ADT answers a read for a missing class with 200 and no body. Whether that
    // is absence is the error strategy's question, not this one's — and the two
    // readings of those same bytes are why the axes are separate.
    expect(classDocuments.source(wire(''))).toBe('');
  });

  it('answers nothing for an update', () => {
    // ADT answers a write with nothing worth reading. `void`, not a document
    // nobody asked for.
    expect(classDocuments.updated(wire(''))).toBeUndefined();
  });

  it('reads every member from the same answer, without parsing it', () => {
    // Decision 5: the document is the consumer's to parse, and this library does
    // not know which fields they need. Every default is that document.
    const document = '<class:abapClass adtcore:name="ZCL_X"/>';
    expect(classDocuments.created(wire(document))).toBe(document);
    expect(classDocuments.metadata(wire(document))).toBe(document);
    expect(classDocuments.check(wire(document))).toBe(document);
    expect(classDocuments.activation(wire(document))).toBe(document);
    expect(classDocuments.validation(wire(document))).toBe(document);
    expect(classDocuments.deletion(wire(document))).toBe(document);
  });

  it('answers a non-string body as its string, not as [object Object]', () => {
    // A connection that parsed JSON for us still owes the caller a document.
    expect(classDocuments.source(wire(undefined as never))).toBe('');
  });
});
