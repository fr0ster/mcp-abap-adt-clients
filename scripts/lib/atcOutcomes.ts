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
 * Two things have to hold before this says `no`, and neither is enough alone.
 *
 * **It must be a verdict.** `origin` is the contract's own judgement:
 * `refusal` is "SAP answered, about this object, and said no"; `connection` is
 * "no usable answer exists" — a timeout after the server accepted the run, a
 * dropped socket, an expired session. A 5xx is kept out too: a server fault is
 * not a statement about anything. An exception thrown by the implementation
 * reading the reply says even less.
 *
 * **And it must be about the variant.** One `run()` is not one request: the
 * client resolves a check variant, creates a worklist with it, and only then
 * submits the run against the target objects. A refusal can therefore come
 * from the target URI, from authorization, or from the worklist — and reading
 * any of them as "the variant was rejected" answers a question nobody asked.
 * The only evidence tying a refusal to the variant is SAP naming it, so that
 * is what is required; everything else leaves the question open.
 *
 * This is deliberately hard to satisfy. An open question costs a re-run on a
 * system that can create variants; a wrong `no` ends the enquiry with the
 * wrong conclusion recorded as measured.
 */
export function classifyRunOutcome(
  origin: 'connection' | 'refusal' | 'thrown',
  status: number | undefined,
  message: string,
  variant: string,
): 'no' | 'unknown' {
  if (origin !== 'refusal') return 'unknown';
  if (status !== undefined && status >= 500) return 'unknown';
  if (!variant) return 'unknown';
  return message.toLowerCase().includes(variant.toLowerCase())
    ? 'no'
    : 'unknown';
}
