/**
 * What a creation attempt settled — the rule, with nothing else attached.
 *
 * Its own module because it is the one part of the probe worth a test, and a
 * test that has to import the probe imports a script: dotenv, a logger, a
 * connection factory. That printed a real dependency error into an otherwise
 * pure unit run and made the test's isolation a fiction. Nothing here reaches
 * outside itself.
 */

/**
 * Statuses that say creation is not on offer here at all.
 *
 * Deliberately short, and deliberately without 401 or 403. Question 3 asks
 * whether a check variant can be created; `405` and `501` answer it — the
 * resource does not implement the verb, so nobody creates one this way.
 *
 * An authorization-shaped refusal does NOT answer it, however much it looks
 * like the answer. The 403 measured here named `S_ABPLNGVS`, which is the ABAP
 * language version and not a role: an unresolvable version is reported as an
 * authorization failure, and the payload this probe sent was a copy of a
 * SAP-owned variant carrying neither our package nor our language version. So
 * that 403 may be about the request. A `401` is weaker still — an expired
 * session says nothing about what its owner may do.
 *
 * And a complaint about the request answers nothing either: the first attempt
 * here was `400 "Parameter corrNr could not be found"`, about the URL, with
 * authorisation never reached.
 *
 * Everything but this pair therefore leaves the question open, with the body on
 * disk for a human to read. An open question is cheap; a wrong answer to it
 * ends the enquiry.
 */
const REFUSES_CREATION = new Set([405, 501]);

/**
 * What a creation attempt settled, from the status and what the system shows
 * afterwards.
 *
 * Exported and pure so the rule can be tested without a SAP system: the danger
 * it guards against is a confident wrong answer, and that is exactly the kind
 * a live run cannot be relied on to produce on demand.
 */
export function classifyCreateOutcome(
  status: number | null,
  presenceAfter: 'present' | 'absent' | 'unknown',
): 'yes' | 'no' | 'unknown' {
  // The object is there. Whatever was said about it, this run made one.
  if (presenceAfter === 'present') return 'yes';
  // Nothing to see, and the server refused the operation itself.
  if (
    presenceAfter === 'absent' &&
    status !== null &&
    REFUSES_CREATION.has(status)
  ) {
    return 'no';
  }
  // Everything else: a complaint about the request, a server fault, a lost
  // response, or a read that could not say. None of them answers the question.
  return 'unknown';
}
