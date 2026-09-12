/**
 * ADT refuses inside a `200`. Your `analyse` is what makes that a failure.
 *
 * An activation that did not happen comes back as HTTP 200 with a checklist
 * carrying `<msg type="E">`. A validation that says no, and a deletion check
 * that says no, do the same. **No error strategy ships from this package** —
 * it read those bodies until 19.0.0 and threw, which is the consumer's
 * judgement taken before the consumer saw it.
 *
 * So an answer arrives whole, and `analyse` — per call, because whether an
 * answer is a failure depends on what you were doing — turns it into one.
 * Build yours from your own corpus of answers; the one below is deliberately
 * crude, because its shape is not the point.
 */

import type { IAdtError, IAnalyse } from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../src/clients/AdtClient';

export const activationRefusal: IAnalyse<IAdtError> = (verdict, answer) => {
  const document = String(answer?.data ?? '');
  return /<\w*:?msg[^>]*type="E"/.test(document)
    ? { origin: 'refusal', message: document }
    : verdict;
};

export async function judgeARefusal(
  client: AdtClient,
  className: string,
): Promise<{ unjudged: boolean; judged: boolean }> {
  const cls = client.getClass();

  // Without a strategy: the exchange, as it happened. A checklist saying the
  // class was not activated is still an answer, and `ok` is true.
  const unjudged = await cls.activate({ className });

  // With yours: the same exchange, now a failure carrying the document.
  const judged = await cls.activate(
    { className },
    { analyse: activationRefusal },
  );

  return { unjudged: unjudged.ok, judged: judged.ok };
}
