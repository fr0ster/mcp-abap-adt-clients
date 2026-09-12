import { activationStatusIn } from '../../../../scripts/lib/activationRun';

/**
 * The one thing shared about an activation wait: reading the status.
 *
 * A reading over one document, which is a shape this repository ships as a
 * default elsewhere. The wait around it is not shared — each caller writes its
 * own deadline and its own idea of what a failure costs, because those are
 * decisions about their work rather than about ADT.
 */
describe('activationStatusIn', () => {
  it('reads the status whatever namespace prefix the server used', () => {
    expect(
      activationStatusIn(
        '<runs:run xmlns:runs="http://www.sap.com/adt/runs" runs:status="finished"/>',
      ),
    ).toBe('finished');
    expect(activationStatusIn('<r:run xmlns:r="x" r:status="error"/>')).toBe(
      'error',
    );
    expect(activationStatusIn('<run status="running"/>')).toBe('running');
  });

  it('answers empty for a document that carries none', () => {
    // Not a verdict about the server: this reading says it found nothing, and
    // what an absent status means is the caller's question — which is why the
    // waits around it keep polling rather than treating it as an ending.
    expect(activationStatusIn('<run/>')).toBe('');
    expect(activationStatusIn('')).toBe('');
  });
});
