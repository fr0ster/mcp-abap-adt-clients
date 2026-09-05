/**
 * A consumer's own failure type, back from `getError()` without a cast.
 *
 * The contract has always carried the parameter — `IAdtFailure<TError extends
 * IAdtError>` — and it was the options that stopped it flowing:
 * `IAdtOperationOptions.analyse` pins its return to `IAdtError`, so a strategy
 * answering something richer got it back narrowed, and the one thing a
 * parameterised failure exists to prevent is exactly the cast that then
 * followed.
 *
 * These are type assertions first and runtime assertions second. If `E` stops
 * flowing, `npm run test:check` fails on this file before any of it runs — which
 * is the point, since nothing at runtime can tell a narrowed type from a wide
 * one.
 */
import type {
  IAbapConnection,
  IAdtError,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import type { IAnalyse } from '../../../utils/adtResponse';

/**
 * What a consumer who reads T100 keys would declare. The library ships no field
 * for this on purpose: a message id is one caller's special case, and a
 * contract that grows a field per special case is the thing being avoided.
 */
interface IT100Failure extends IAdtError {
  readonly t100: { readonly msgid: string; readonly msgno: string };
}

/** The refusal ADT answers for a class that is not there. Measured on trial. */
const REFUSED = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="true"/>
  <msg objDescr="CLAS ZZ_NO_SUCH_OBJECT_ZZ" type="E" line="1" code="OO(045)">
    <shortText><txt>Class ZZ_NO_SUCH_OBJECT_ZZ does not have a TMDIR entry</txt></shortText>
    <t100Key msgid="OO" msgno="045"/>
  </msg>
</chkl:messages>`;

/** The consumer's strategy: the whole document is theirs to read. */
const t100: IAnalyse<IT100Failure> = (_verdict, answer) => {
  const document = String(answer?.data ?? '');
  const key = /<t100Key msgid="([^"]*)" msgno="([^"]*)"/.exec(document);
  if (!key) return ADT_NO_FAILURE;
  return {
    origin: 'refusal',
    message:
      /<txt>([^<]*)<\/txt>/.exec(document)?.[1] ?? 'refused without a text',
    t100: { msgid: key[1], msgno: key[2] },
  };
};

const answering = (data: string): IAbapConnection =>
  ({
    makeAdtRequest: async () =>
      ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data,
      }) as IAdtWireResponse,
  }) as unknown as IAbapConnection;

describe('the failure type a caller injected', () => {
  it('comes back as itself, with no cast at the call site', async () => {
    const client = new AdtClient(answering(REFUSED));

    const answer = await client
      .getClass()
      .activate({ className: 'ZZ_NO_SUCH_OBJECT_ZZ' }, { analyse: t100 });

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a refusal');

    // No cast, no `as`, no guard: `getError()` is typed `IT100Failure` because
    // `analyse` said so. `.t100` not compiling here is the regression this file
    // exists to catch.
    const failure = answer.getError();
    expect(failure.t100).toEqual({ msgid: 'OO', msgno: '045' });
    expect(failure.origin).toBe('refusal');
    expect(failure.message).toMatch(/TMDIR/);
  });

  it('leaves the shipped default in place when nobody injects one', async () => {
    const client = new AdtClient(answering(REFUSED));

    const answer = await client
      .getClass()
      .activate({ className: 'ZZ_NO_SUCH_OBJECT_ZZ' });

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a refusal');
    // `activationRefusal` reads the same document its own way, and the failure
    // is the plain contract — which is what `E` defaults to.
    const failure: IAdtError = answer.getError();
    expect(failure.message).toMatch(/does not have a TMDIR entry/);
  });

  it('can clear a verdict the shipped default would have raised', async () => {
    const client = new AdtClient(answering(REFUSED));

    const answer = await client
      .getClass()
      .activate(
        { className: 'ZZ_NO_SUCH_OBJECT_ZZ' },
        { analyse: () => ADT_NO_FAILURE },
      );

    // Overruling in the other direction still works: a caller who considers
    // this answer fine gets the result half.
    expect(answer.ok).toBe(true);
  });
});
