/**
 * One reading, and no sequence.
 *
 * `runs:status` out of an activation-run document, whatever namespace prefix
 * the server used. A reading over one answer — not a join, not a wait, and not
 * a policy about which value means what.
 *
 * **There is deliberately no `activateAndWait` here.** It existed for one
 * commit and was ninety lines: an outcome type, a deadline, a logger, and a
 * rule about which statuses end a wait. That is an operation, and an operation
 * belongs to whoever is performing it. Each caller writes its own four lines
 * below its own `activateObjectsGroup`, with its own deadline and its own idea
 * of what a failure costs it.
 *
 * The package walk beside this file is a different case and stays whole: it is
 * sixty lines of recursion and parsing, and four honest copies of it would be
 * four places to get it wrong. A wait is four lines.
 */

/** `runs:status` out of the run document, whatever prefix the server used. */
export function activationStatusIn(document: string): string {
  return document.match(/[\w:]*status="([^"]+)"/)?.[1] ?? '';
}
