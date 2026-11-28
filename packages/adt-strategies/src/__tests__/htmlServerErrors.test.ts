/**
 * The failure path on an HTML `500` (spec of fr0ster/mcp-abap-adt#404, §4.4):
 * SAP answers some refused reads with an ICF error page and no
 * `exc:exception` — measured on ABAP cloud (2026-11-28) for an absent
 * application log object name of 21 characters, both reads, and on both kinds
 * for `version=1` of the keyword documentation ("Invalid enumeration value"
 * on both). `analyseException` keeps the
 * library's verdict (its status sentence) and the wire answer whole, so a
 * consumer gets SAP's page, SAP's text inside it, unchanged. Nothing is added
 * to the failure path for it.
 */
import type { IAdtError } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { analyseException } from '../refusals/analyse';
import { stepTagged } from './corpus';

const CASES = [
  [
    'refusal-application-log-name-21-abap-cloud',
    'object',
    'Data was lost while copying a value',
  ],
  [
    'refusal-application-log-name-21-abap-cloud',
    'source',
    'Data was lost while copying a value',
  ],
  [
    'refusal-keyword-documentation-version-1-abap-cloud',
    'topic',
    'Invalid enumeration value',
  ],
  [
    'refusal-keyword-documentation-version-1-s4-2025',
    'topic',
    'Invalid enumeration value',
  ],
] as const;

describe('analyseException on an HTML 500', () => {
  it.each(CASES)(
    '%s (%s): the verdict, the status and the page kept whole',
    (name, tag, text) => {
      const answer: IAdtWireResponse = stepTagged(name, tag);
      expect(answer.status).toBe(500);
      const verdict: IAdtError = {
        origin: 'refusal',
        message: 'Request failed with status code 500',
        response: answer,
      };
      const judged = analyseException(verdict, answer);
      if (judged === undefined || typeof judged !== 'object') {
        throw new Error('expected a failure');
      }
      expect(judged).toEqual(
        expect.objectContaining({
          message: 'Request failed with status code 500',
        }),
      );
      const response = (judged as IAdtError).response as IAdtWireResponse;
      expect(response.status).toBe(500);
      expect(response.data).toBe(answer.data);
      expect(String(response.data)).toContain(text);
      expect(String(response.data)).toContain('Application Server Error');
    },
  );
});
