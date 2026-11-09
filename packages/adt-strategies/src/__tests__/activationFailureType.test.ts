import { ADT_NO_FAILURE, type IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import {
  analyseActivation,
  type IAdtActivationFailure,
  type IAdtMessageFailure,
} from '../refusals/analyse';
import type { IAdtStillInactive } from '../refusals/read';
import { answerFor } from './corpus';

/**
 * The failure's shape is checked by the compiler (ts-jest type-checks this
 * file): `stillInactive` is read with no cast, an `IAdtActivationFailure` is an
 * `IAdtMessageFailure`, and `analyseActivation` is an `IAnalyse` of it.
 */
describe('IAdtActivationFailure, statically', () => {
  it('reads stillInactive without a cast', () => {
    const judged: IAnalyse<IAdtActivationFailure> = analyseActivation;
    const verdict = judged(
      ADT_NO_FAILURE,
      answerFor('activation-preaudit-still-inactive-751'),
    );
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a failure');
    const names: string[] = verdict.stillInactive.map(
      (o: IAdtStillInactive) => o.name,
    );
    const parent: string | undefined = verdict.stillInactive[1]?.parentUri;
    const asMessages: IAdtMessageFailure = verdict;
    expect(names).toContain('ZCL_AI_ACT_PROBE');
    expect(parent).toBe('/sap/bc/adt/oo/classes/zcl_ai_act_probe');
    expect(asMessages.messages.length).toBe(1);
  });

  it('refuses a stillInactive entry without a name', () => {
    // @ts-expect-error — `name` is required.
    const entry: IAdtStillInactive = { uri: '/x', type: 'CLAS/OC' };
    expect(entry.uri).toBe('/x');
  });
});
