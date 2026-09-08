/**
 * What an attempt settled — the rules, with nothing else attached.
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

/**
 * What a failed check run settled about the variant it was given.
 *
 * The same distinction the creation rule makes, for the same reason: an
 * exception is not a verdict. `atc.run` rejecting can mean SAP looked at the
 * request and refused it — an answer — or that no answer exists at all: a
 * timeout after the server accepted the run, a dropped connection, an expired
 * session, a fault inside the implementation reading the reply. Calling those
 * "the variant was rejected" is the confident wrong answer this probe keeps
 * being caught giving.
 *
 * `origin` is the contract's own judgement and the one worth trusting:
 * `refusal` is "SAP answered, about this object, and said no"; `connection` is
 * "no usable answer exists". A 5xx is kept out of the first: a server fault is
 * not a statement about the variant.
 */
export function classifyRunOutcome(
  origin: 'connection' | 'refusal' | 'thrown',
  status: number | undefined,
): 'no' | 'unknown' {
  if (origin !== 'refusal') return 'unknown';
  return status !== undefined && status >= 500 ? 'unknown' : 'no';
}
