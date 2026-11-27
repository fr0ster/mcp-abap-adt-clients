import { answering, recogniseFailure } from '../../../utils/adtResponse';
import { rawDocument } from '../../../utils/resultStrategy';

/**
 * N of #304: a refusal a connection resolved (a non-2xx answer) is classified
 * from the typed answer, not handed to recogniseFailure through `unknown`. The
 * failure is the one recogniseFailure made of `{ message, response }`.
 */
describe('a resolved refusal', () => {
  it.each([404, 500, 199, 403.5])('with status %s', async (status) => {
    const wire = { status, statusText: 'S', headers: {}, data: '<x/>' };
    const answer = await answering(async () => wire, rawDocument);
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError()).toStrictEqual(
      recogniseFailure({
        message: `Request failed with status code ${status}`,
        response: wire,
      }),
    );
  });
});
