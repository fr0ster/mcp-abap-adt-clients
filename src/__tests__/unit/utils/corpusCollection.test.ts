import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { answering, nothingIsARefusal } from '../../../utils/adtResponse';
import { wireItself } from '../../../utils/resultStrategy';

const refused = {
  status: 403,
  statusText: 'Forbidden',
  headers: {},
  data: '<exc><localizedMessage>locked</localizedMessage></exc>',
} as IAdtWireResponse;

it('hands back a refusal whole', async () => {
  const answer = await answering(
    async () => {
      const error = new Error('403') as Error & { response?: unknown };
      error.response = refused;
      throw error;
    },
    wireItself,
    nothingIsARefusal,
  );

  expect(answer.ok).toBe(true);
  if (!answer.ok) throw new Error('expected the exchange');
  expect(answer.getResult().value.status).toBe(403);
  expect(String(answer.getResult().value.data)).toContain('locked');
});

it('still fails when nothing came back at all', async () => {
  const answer = await answering(
    async () => {
      throw new Error('socket hang up');
    },
    wireItself,
    nothingIsARefusal,
  );

  expect(answer.ok).toBe(false);
});
