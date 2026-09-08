/**
 * What a failed creation attempt is allowed to conclude.
 *
 * The probe is a script and would normally carry no test. This rule does,
 * because the failure it guards against is a **confident wrong answer**: the
 * probe's third question is whether this user may create a check variant, and
 * treating any non-2xx as "not allowed" would close it on evidence that says
 * something else entirely. That is not hypothetical — the first attempt against
 * the trial answered `400 "Parameter corrNr could not be found"`, a complaint
 * about the URL, with authorisation never reached.
 *
 * A live run cannot be relied on to produce a 400, a 409 and a dropped socket
 * on demand, so the rule is tested where it can be: on its own. It lives in
 * its own module for the same reason — importing the probe to reach it pulled
 * in dotenv, a logger and a connection factory, and printed a real dependency
 * error into a run that is supposed to touch nothing.
 */

import { classifyCreateOutcome } from '../../../../scripts/lib/atcCreateOutcome';

describe('classifyCreateOutcome', () => {
  it('reports a creation whenever the object is there afterwards', () => {
    // Whatever the client saw, the system shows the object: this run made it.
    expect(classifyCreateOutcome(201, 'present')).toBe('yes');
    expect(classifyCreateOutcome(null, 'present')).toBe('yes');
    expect(classifyCreateOutcome(500, 'present')).toBe('yes');
    expect(classifyCreateOutcome(403, 'present')).toBe('yes');
  });

  it('reports a refusal only where creation is not on offer at all', () => {
    // The verb is not implemented here, so nobody creates one this way.
    expect(classifyCreateOutcome(405, 'absent')).toBe('no');
    expect(classifyCreateOutcome(501, 'absent')).toBe('no');
  });

  it('does not read an authorization-shaped refusal as the answer', () => {
    // The 403 measured on the trial named S_ABPLNGVS — the ABAP language
    // version, not a role — and the payload sent carried a SAP-owned variant's
    // package and version. So it may be about the request. A 401 is weaker
    // still: an expired session says nothing about what its owner may do.
    expect(classifyCreateOutcome(403, 'absent')).toBe('unknown');
    expect(classifyCreateOutcome(401, 'absent')).toBe('unknown');
  });

  it('leaves the question open when the server complained about the request', () => {
    // The measured one: 400 "Parameter corrNr could not be found" says the URL
    // was wrong, not that this user may not create a variant.
    expect(classifyCreateOutcome(400, 'absent')).toBe('unknown');
    expect(classifyCreateOutcome(409, 'absent')).toBe('unknown');
    expect(classifyCreateOutcome(415, 'absent')).toBe('unknown');
    expect(classifyCreateOutcome(422, 'absent')).toBe('unknown');
  });

  it('leaves the question open on a server fault or a lost response', () => {
    expect(classifyCreateOutcome(500, 'absent')).toBe('unknown');
    expect(classifyCreateOutcome(503, 'absent')).toBe('unknown');
    // No response at all — the socket that dropped after SAP may have written.
    expect(classifyCreateOutcome(null, 'absent')).toBe('unknown');
  });

  it('leaves the question open when the read afterwards could not say', () => {
    // A refusal plus a blind read is still not proof that nothing was written.
    expect(classifyCreateOutcome(403, 'unknown')).toBe('unknown');
    expect(classifyCreateOutcome(201, 'unknown')).toBe('unknown');
    expect(classifyCreateOutcome(null, 'unknown')).toBe('unknown');
  });
});
